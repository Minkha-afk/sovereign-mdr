import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "./db";
import { User, Organization, Person } from "./models";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const ok = (data, status = 200) => NextResponse.json(data, { status });

// Wraps a route handler: connects to MongoDB and turns thrown errors into JSON responses.
export function route(fn) {
  return async (req, ctx) => {
    try {
      await connectDB();
      return await fn(req, ctx);
    } catch (err) {
      const status = err.status || (err.name === "ValidationError" ? 400 : 500);
      if (status === 500) console.error(err);
      const message =
        err.name === "ValidationError" ? Object.values(err.errors).map((e) => e.message).join("; ") : err.message;
      return NextResponse.json({ error: message || "Server error", code: err.code }, { status });
    }
  };
}

// Guards the destructive demo tools (reset, tamper, raw DB view) when DEMO_ADMIN_PASSWORD is set.
export function requireDemoPassword(req) {
  const expected = process.env.DEMO_ADMIN_PASSWORD;
  if (!expected || req.headers.get("x-demo-password") === expected) return;
  throw Object.assign(new HttpError(401, "Demo admin password required."), { code: "demo_password" });
}

// The demo "session": a cookie naming the persona. A real build would use MFA + opaque session tokens.
export async function requireActor(kinds) {
  const code = (await cookies()).get("sov_user")?.value;
  const user = code ? await User.findOne({ code }).lean() : null;
  if (!user) throw new HttpError(401, "Pick a persona first (and load the demo data if you have not).");
  if (kinds && !kinds.includes(user.kind)) throw new HttpError(403, `This action is not available to a ${user.kind}.`);
  const org = user.orgId ? await Organization.findById(user.orgId).lean() : null;
  return { user, org };
}

export async function findPerson(publicRef) {
  const person = await Person.findOne({ publicRef }).lean();
  if (!person) throw new HttpError(404, "No person with that reference.");
  return person;
}

export const nameMaps = async () => {
  const [users, orgs] = await Promise.all([User.find().lean(), Organization.find().lean()]);
  return {
    user: Object.fromEntries(users.map((u) => [String(u._id), u.name])),
    org: Object.fromEntries(orgs.map((o) => [String(o._id), o.name])),
  };
};
