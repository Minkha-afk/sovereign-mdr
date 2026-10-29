import { route, ok } from "@/lib/api";
import { seedDemo } from "@/lib/seed";

export const POST = route(async () => {
  return ok(await seedDemo());
});
