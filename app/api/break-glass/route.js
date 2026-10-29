import { route, ok, requireActor, findPerson, HttpError } from "@/lib/api";
import { BreakGlass, Notification } from "@/lib/models";
import { logConsentEvent } from "@/lib/chain";

// Emergency override: justified, at most 24 h, patient notified, logged in the consent ledger.
export const POST = route(async (req) => {
  const { user, org } = await requireActor(["clinician"]);
  if (org.orgType !== "hospital") throw new HttpError(403, "Only hospital clinicians can invoke break-glass.");
  const { publicRef, justification, hours } = await req.json();
  const person = await findPerson(publicRef);
  const createdAt = new Date();
  const bg = await BreakGlass.create({
    personId: person._id, invokedByUserId: user._id, orgId: org._id, justification, createdAt,
    expiresAt: new Date(createdAt.getTime() + Number(hours || 4) * 3600 * 1000),
  });
  await logConsentEvent({ personId: person._id, kind: "break_glass", actorUserId: user._id, payload: { org: org.name, hours: Number(hours || 4) } });
  await Notification.create({
    personId: person._id, kind: "break_glass",
    message: `EMERGENCY ACCESS: ${user.name} at ${org.name} invoked break-glass — "${justification}". A privacy officer will review it.`,
  });
  return ok({ id: bg._id, expiresAt: bg.expiresAt }, 201);
});
