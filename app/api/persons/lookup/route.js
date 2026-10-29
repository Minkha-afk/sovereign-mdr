import { route, ok, requireActor, HttpError } from "@/lib/api";
import { Person } from "@/lib/models";
import { blindIndex } from "@/lib/crypto";

// Find a patient by national health ID via its HMAC blind index; the ID itself is never stored.
export const POST = route(async (req) => {
  await requireActor(["clinician", "insurer"]);
  const { healthId } = await req.json();
  const index = blindIndex(healthId || "");
  const person = await Person.findOne({ primaryIdBlindIndex: index }).lean();
  if (!person) throw new HttpError(404, "No patient matches that health ID.");
  return ok({ publicRef: person.publicRef, region: person.dataResidencyRegion, blindIndex: index });
});
