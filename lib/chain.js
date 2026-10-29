import { sha256 } from "./crypto";
import { AccessLog, ConsentEvent } from "./models";

const ACCESS_FIELDS = [
  "personId", "seq", "recordId", "category", "actorUserId", "actorOrgId",
  "action", "purpose", "decision", "grantId", "breakGlassId", "denyReason", "createdAt",
];
const EVENT_FIELDS = ["personId", "seq", "kind", "grantId", "requestId", "actorUserId", "payload", "createdAt"];

function canonical(doc, fields) {
  return fields
    .map((f) => {
      const v = doc[f];
      if (v == null) return "";
      if (v instanceof Date) return v.toISOString();
      return String(v);
    })
    .join("|");
}

const computeHash = (prevHash, doc, fields) => sha256(`${prevHash || ""}|${canonical(doc, fields)}`);

// Per-person hash chain: entry_hash = SHA-256(prev_hash ‖ row fields).
async function appendChained(Model, fields, data) {
  const last = await Model.findOne({ personId: data.personId }).sort({ seq: -1 }).lean();
  const doc = {
    ...data,
    seq: last ? last.seq + 1 : 1,
    prevHash: last ? last.entryHash : null,
    createdAt: data.createdAt || new Date(),
  };
  doc.entryHash = computeHash(doc.prevHash, doc, fields);
  return Model.create(doc);
}

async function verify(Model, fields, personId) {
  const rows = await Model.find({ personId }).sort({ seq: 1 }).lean();
  let prev = null;
  for (const row of rows) {
    if ((row.prevHash || null) !== prev || computeHash(prev, row, fields) !== row.entryHash) {
      return { ok: false, length: rows.length, brokenAt: row.seq };
    }
    prev = row.entryHash;
  }
  return { ok: true, length: rows.length, head: prev };
}

export const logAccess = (data) => appendChained(AccessLog, ACCESS_FIELDS, data);

export const logConsentEvent = ({ payload, ...data }) =>
  appendChained(ConsentEvent, EVENT_FIELDS, { ...data, payload: payload ? JSON.stringify(payload) : undefined });

export const verifyAccessChain = (personId) => verify(AccessLog, ACCESS_FIELDS, personId);
export const verifyConsentChain = (personId) => verify(ConsentEvent, EVENT_FIELDS, personId);
