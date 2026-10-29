import { route, ok, HttpError, requireDemoPassword } from "@/lib/api";
import { AccessLog } from "@/lib/models";

// Demo only: a rogue DBA edits an audit row with the raw driver, bypassing the append-only guard.
// The hash chain no longer verifies, so the tampering is evident.
export const POST = route(async (req) => {
  requireDemoPassword(req);
  const row = await AccessLog.findOne({ decision: "deny" }).sort({ seq: -1 }).lean();
  if (!row) throw new HttpError(404, "No denied access to tamper with yet.");
  await AccessLog.collection.updateOne({ _id: row._id }, { $set: { decision: "allow" }, $unset: { denyReason: 1 } });
  return ok({ tamperedSeq: row.seq });
});
