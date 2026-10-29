import { route, ok, requireActor, findPerson } from "@/lib/api";
import { ConsentRequest, Grant, BreakGlass } from "@/lib/models";

// What the acting organisation holds for this patient: its requests, grants and break-glass sessions.
export const GET = route(async (req, { params }) => {
  const { ref } = await params;
  const { org } = await requireActor(["clinician", "insurer"]);
  const person = await findPerson(ref);
  const filter = { personId: person._id };
  const [requests, grants, breakGlass] = await Promise.all([
    ConsentRequest.find({ ...filter, requesterOrgId: org._id }).sort({ createdAt: -1 }).lean(),
    Grant.find({ ...filter, granteeOrgId: org._id }).sort({ createdAt: -1 }).lean(),
    BreakGlass.find({ ...filter, orgId: org._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const now = new Date();
  return ok({
    requests: requests.map((q) => ({ id: q._id, purpose: q.purpose, categories: q.requestedCategories, status: q.status, createdAt: q.createdAt })),
    grants: grants.map((g) => ({
      id: g._id, purpose: g.purpose, validUntil: g.validUntil, maxUses: g.maxUses, useCount: g.useCount, scopes: g.scopes,
      status: g.status === "revoked" ? "revoked" : g.validUntil < now ? "expired" : "active",
    })),
    breakGlass: breakGlass.map((b) => ({ id: b._id, expiresAt: b.expiresAt, active: b.expiresAt > now, justification: b.justification })),
  });
});
