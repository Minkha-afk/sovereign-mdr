import { NextResponse } from "next/server";
import { PERSONAS } from "@/lib/constants";
import { route, ok, requireActor } from "@/lib/api";

// Who am I acting as, and what is my organisation allowed to do?
export const GET = route(async () => {
  const { user, org } = await requireActor();
  return ok({
    user: { code: user.code, name: user.name, kind: user.kind, role: user.role, licence: user.licence },
    org: org && {
      name: org.name, orgType: org.orgType, registrationNumber: org.registrationNumber,
      permittedCategories: org.permittedCategories, permittedPurposes: org.permittedPurposes,
    },
  });
});

export async function POST(req) {
  const { code } = await req.json();
  const persona = PERSONAS.find((p) => p.code === code);
  if (!persona) return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  const res = NextResponse.json(persona);
  res.cookies.set("sov_user", code, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return res;
}
