import { route, ok, requireActor, findPerson, HttpError } from "@/lib/api";
import { ConsentRequest, Notification } from "@/lib/models";
import { logConsentEvent } from "@/lib/chain";

// An organisation asks the patient for purpose-bound, time-boxed access.
export const POST = route(async (req) => {
  const { user, org } = await requireActor(["clinician", "insurer"]);
  const { publicRef, purpose, justification, categories = [], durationDays } = await req.json();
  const person = await findPerson(publicRef);

  if (!org.permittedPurposes.includes(purpose)) throw new HttpError(403, `${org.name} may not request for purpose "${purpose}".`);
  const outside = categories.filter((c) => !org.permittedCategories.includes(c));
  if (outside.length) throw new HttpError(403, `Outside your organisation's ceiling: ${outside.join(", ")}`);

  const request = await ConsentRequest.create({
    personId: person._id, requesterOrgId: org._id, requesterUserId: user._id, purpose, justification,
    requestedCategories: categories, durationDays: Number(durationDays) || 30,
  });
  await logConsentEvent({ personId: person._id, kind: "requested", requestId: request._id, actorUserId: user._id, payload: { org: org.name, purpose } });
  await Notification.create({ personId: person._id, kind: "request", message: `${org.name} requested access for ${purpose.replaceAll("_", " ")}.` });
  return ok({ id: request._id }, 201);
});
