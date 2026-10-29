import { route, ok, requireActor, findPerson, nameMaps, HttpError } from "@/lib/api";
import { Record, Grant, Notification } from "@/lib/models";
import { loadAccessContext, decideAccess } from "@/lib/access";
import { logAccess } from "@/lib/chain";
import { openPayload, sealPayload } from "@/lib/vault";
import { SENSITIVITY } from "@/lib/constants";

// Consent-enforced read: decide per record -> write the hash-chained audit row -> only then decrypt.
export const GET = route(async (req, { params }) => {
  const { ref } = await params;
  const actor = await requireActor(["clinician", "insurer"]);
  const purpose = new URL(req.url).searchParams.get("purpose") || "treatment";
  const person = await findPerson(ref);
  const [records, ctx, names] = await Promise.all([
    Record.find({ personId: person._id }).sort({ effectiveAt: -1 }).lean(),
    loadAccessContext(actor, person._id),
    nameMaps(),
  ]);

  const keyCache = new Map();
  const grantsUsed = new Set();
  const released = [];
  let withheld = 0;
  let usedBreakGlass = false;

  for (const r of records) {
    const d = decideAccess(actor, r, purpose, ctx);
    await logAccess({
      personId: person._id, recordId: r._id, category: r.category, actorUserId: actor.user._id,
      actorOrgId: actor.org._id, action: "read", purpose: d.basis === "break_glass" ? "emergency" : purpose,
      decision: d.decision, grantId: d.grantId, breakGlassId: d.breakGlassId, denyReason: d.denyReason,
    });
    if (d.decision !== "allow") {
      withheld++;
      continue;
    }
    if (d.grantId) grantsUsed.add(String(d.grantId));
    if (d.breakGlassId) usedBreakGlass = true;
    released.push({
      id: r._id, category: r.category, sensitivity: r.sensitivity, encounter: r.encounter,
      authorOrg: names.org[String(r.authorOrgId)],
      code: r.codeDisplay ? `${r.codeSystem} ${r.codeValue} · ${r.codeDisplay}` : null,
      effectiveAt: r.effectiveAt, basis: d.basis, ...(await openPayload(r.payloadVaultObjectId, keyCache)),
    });
  }

  // N-use grants: one use per consent-backed read.
  if (grantsUsed.size) await Grant.updateMany({ _id: { $in: [...grantsUsed] } }, { $inc: { useCount: 1 } });
  if (released.length || withheld) {
    await Notification.create({
      personId: person._id, kind: usedBreakGlass ? "break_glass" : "access",
      message: `${actor.org.name} (${actor.user.name}) read ${released.length} record(s)${withheld ? `; ${withheld} withheld` : ""}${usedBreakGlass ? " under BREAK-GLASS" : ""}.`,
    });
  }
  return ok({ purpose, released, withheld });
});

// Clinicians author new records. The payload is encrypted before it touches the database.
export const POST = route(async (req, { params }) => {
  const { ref } = await params;
  const { user, org } = await requireActor(["clinician"]);
  const person = await findPerson(ref);
  const b = await req.json();
  if (!org.permittedCategories.includes(b.category)) throw new HttpError(403, `${org.name} cannot author ${b.category} records.`);
  if (!b.content?.trim()) throw new HttpError(400, "Clinical content is required.");
  const sensitivity = SENSITIVITY.includes(b.sensitivity) ? b.sensitivity : "normal";

  const vault = await sealPayload(person._id, { note: b.content.trim() });
  const record = await Record.create({
    personId: person._id, category: b.category, sensitivity, encounter: b.encounter || null,
    authorOrgId: org._id, authorUserId: user._id,
    // Codes are hidden for non-normal sensitivity tiers.
    ...(sensitivity === "normal" && { codeSystem: b.codeSystem, codeValue: b.codeValue, codeDisplay: b.codeDisplay }),
    payloadVaultObjectId: vault._id, effectiveAt: b.effectiveAt ? new Date(b.effectiveAt) : new Date(),
    contentDigest: vault.plaintextSha256,
  });
  await Notification.create({ personId: person._id, kind: "record", message: `${org.name} added a new ${b.category.replaceAll("_", " ")} record.` });
  return ok({ id: record._id }, 201);
});
