import { route, ok, requireActor, HttpError } from "@/lib/api";
import { Person, DataKey, VaultObject, Notification } from "@/lib/models";
import { logConsentEvent } from "@/lib/chain";

// Right to erasure = crypto-shredding: destroy the wrapped DEK, so the ciphertext can never be decrypted again.
export const POST = route(async () => {
  const { user } = await requireActor(["patient"]);
  const person = await Person.findById(user.personId).lean();
  if (person.legalHold) throw new HttpError(409, "A legal hold blocks erasure.");
  const at = new Date();
  await DataKey.updateMany({ personId: person._id }, { $set: { state: "shredded", shreddedAt: at }, $unset: { wrapped: 1 } });
  const { modifiedCount } = await VaultObject.updateMany({ personId: person._id, shreddedAt: null }, { $set: { shreddedAt: at } });
  await logConsentEvent({ personId: person._id, kind: "erasure", actorUserId: user._id, payload: { shreddedObjects: modifiedCount } });
  await Notification.create({ personId: person._id, kind: "erasure", message: `Your data key was destroyed; ${modifiedCount} encrypted payloads are now unreadable.` });
  return ok({ shreddedObjects: modifiedCount });
});
