import { route, ok, requireActor, nameMaps } from "@/lib/api";
import { Person, Record, ConsentRequest, Grant, AccessLog, ConsentEvent, BreakGlass, Notification } from "@/lib/models";
import { openPayload } from "@/lib/vault";
import { verifyAccessChain, verifyConsentChain } from "@/lib/chain";

// Everything the patient portal shows. The patient reads their own records (basis: self).
export const GET = route(async () => {
  const { user } = await requireActor(["patient"]);
  const personId = user.personId;
  const [person, records, requests, grants, log, events, breakGlass, notifications, names] = await Promise.all([
    Person.findById(personId).lean(),
    Record.find({ personId }).sort({ effectiveAt: -1 }).lean(),
    ConsentRequest.find({ personId }).sort({ createdAt: -1 }).lean(),
    Grant.find({ personId }).sort({ createdAt: -1 }).lean(),
    AccessLog.find({ personId }).sort({ seq: -1 }).limit(60).lean(),
    ConsentEvent.find({ personId }).sort({ seq: -1 }).limit(30).lean(),
    BreakGlass.find({ personId }).sort({ createdAt: -1 }).lean(),
    Notification.find({ personId }).sort({ createdAt: -1 }).limit(10).lean(),
    nameMaps(),
  ]);

  const keyCache = new Map();
  const org = (id) => names.org[String(id)] || "—";
  const who = (id) => names.user[String(id)] || "—";
  const now = new Date();

  return ok({
    me: {
      name: user.name, email: user.email, publicRef: person.publicRef,
      region: person.dataResidencyRegion, legalHold: person.legalHold, status: person.status,
    },
    records: await Promise.all(
      records.map(async (r) => ({
        id: r._id, category: r.category, sensitivity: r.sensitivity, encounter: r.encounter,
        authorOrg: org(r.authorOrgId), author: who(r.authorUserId),
        code: r.codeDisplay ? `${r.codeSystem} ${r.codeValue} · ${r.codeDisplay}` : null,
        effectiveAt: r.effectiveAt, ...(await openPayload(r.payloadVaultObjectId, keyCache)),
      }))
    ),
    requests: requests.map((q) => ({
      id: q._id, org: org(q.requesterOrgId), requester: who(q.requesterUserId), purpose: q.purpose,
      justification: q.justification, categories: q.requestedCategories, durationDays: q.durationDays,
      status: q.status, createdAt: q.createdAt,
    })),
    grants: grants.map((g) => ({
      id: g._id, org: org(g.granteeOrgId), purpose: g.purpose, validFrom: g.validFrom, validUntil: g.validUntil,
      maxUses: g.maxUses, useCount: g.useCount, revokedAt: g.revokedAt, revocationReason: g.revocationReason,
      status: g.status === "revoked" ? "revoked" : g.validUntil < now ? "expired" : "active",
      scopes: g.scopes.map((s) => ({ ...s, authorOrg: s.authorOrgId ? org(s.authorOrgId) : null })),
    })),
    accessLog: log.map((a) => ({
      seq: a.seq, at: a.createdAt, actor: who(a.actorUserId), actorOrg: org(a.actorOrgId), category: a.category,
      action: a.action, purpose: a.purpose, decision: a.decision, denyReason: a.denyReason,
      basis: a.breakGlassId ? "break-glass" : a.grantId ? "consent grant" : null,
      prevHash: a.prevHash, entryHash: a.entryHash,
    })),
    events: events.map((e) => ({ seq: e.seq, kind: e.kind, actor: who(e.actorUserId), at: e.createdAt, entryHash: e.entryHash })),
    breakGlass: breakGlass.map((b) => ({
      id: b._id, by: who(b.invokedByUserId), org: org(b.orgId), justification: b.justification,
      createdAt: b.createdAt, expiresAt: b.expiresAt, active: b.expiresAt > now,
    })),
    notifications,
    chains: { access: await verifyAccessChain(personId), consent: await verifyConsentChain(personId) },
  });
});
