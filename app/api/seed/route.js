import { route, ok, requireDemoPassword } from "@/lib/api";
import { seedDemo } from "@/lib/seed";

export const POST = route(async (req) => {
  requireDemoPassword(req);
  return ok(await seedDemo());
});
