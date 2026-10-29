import { route, ok, requireActor, HttpError } from "@/lib/api";
import { Grant } from "@/lib/models";
import { logConsentEvent } from "@/lib/chain";

// Revocation changes the grant and appends an immutable ledger event.
export const POST = route(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireActor(["patient"]);
  const { reason } = await req.json().catch(() => ({}));
  const grant = await Grant.findOne({ _id: id, personId: user.personId });
  if (!grant) throw new HttpError(404, "Grant not found.");
  if (grant.status === "revoked") throw new HttpError(409, "Already revoked.");

  grant.status = "revoked";
  grant.revokedAt = new Date();
  grant.revocationReason = reason || "Revoked by patient";
  await grant.save();
  await logConsentEvent({ personId: user.personId, kind: "revoked", grantId: grant._id, actorUserId: user._id, payload: { reason: grant.revocationReason } });
  return ok({ status: "revoked" });
});
