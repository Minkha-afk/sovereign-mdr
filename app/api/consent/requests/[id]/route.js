import { route, ok, requireActor, HttpError } from "@/lib/api";
import { ConsentRequest, Grant } from "@/lib/models";
import { logConsentEvent } from "@/lib/chain";
import { sha256 } from "@/lib/crypto";

const DAY = 24 * 3600 * 1000;

// The patient approves (producing a scoped grant) or denies a pending request.
export const POST = route(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireActor(["patient"]);
  const body = await req.json();
  const request = await ConsentRequest.findOne({ _id: id, personId: user.personId });
  if (!request) throw new HttpError(404, "Request not found.");
  if (request.status !== "pending") throw new HttpError(409, "This request was already decided.");

  if (body.action === "deny") {
    request.status = "denied";
    request.decidedAt = new Date();
    await request.save();
    await logConsentEvent({ personId: user.personId, kind: "denied", requestId: request._id, actorUserId: user._id });
    return ok({ status: "denied" });
  }

  const include = (body.categories || []).filter((c) => request.requestedCategories.includes(c));
  if (!include.length) throw new HttpError(400, "Select at least one category to share.");
  const from = body.from ? new Date(body.from) : undefined;
  const to = body.to ? new Date(`${body.to}T23:59:59Z`) : undefined;
  const scopes = [
    ...include.map((category) => ({ category, from, to })),
    ...(body.exclude || []).map((category) => ({ category, isExclusion: true })),
  ];

  const now = new Date();
  const days = Math.min(Math.max(Number(body.days) || request.durationDays, 1), 365);
  const grant = await Grant.create({
    personId: user.personId, requestId: request._id, granteeOrgId: request.requesterOrgId, purpose: request.purpose,
    actions: ["read"], validFrom: now, validUntil: new Date(now.getTime() + days * DAY),
    maxUses: body.maxUses ? Number(body.maxUses) : undefined, scopes,
    // Simulated step-up signature over the grant terms (non-repudiation).
    subjectAuthAal: 2, subjectSignature: sha256(JSON.stringify({ request: request._id, scopes, days, by: user._id })),
  });

  request.status = "approved";
  request.decidedAt = now;
  request.grantId = grant._id;
  await request.save();
  await logConsentEvent({
    personId: user.personId, kind: "granted", requestId: request._id, grantId: grant._id, actorUserId: user._id,
    payload: { include, exclude: body.exclude || [], days, maxUses: body.maxUses || null },
  });
  return ok({ status: "approved", grantId: grant._id });
});
