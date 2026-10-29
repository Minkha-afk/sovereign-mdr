import { route, ok, requireDemoPassword } from "@/lib/api";
import { Person, User, Organization, DataKey, VaultObject, Record, Grant, ConsentEvent, AccessLog } from "@/lib/models";
import { verifyAccessChain, verifyConsentChain } from "@/lib/chain";

const clip = (v) => (typeof v === "string" && v.length > 44 ? `${v.slice(0, 44)}…` : v);

// Turn a raw document into display-friendly JSON with long values clipped.
function raw(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === "__v") continue;
    if (v && typeof v === "object" && !(v instanceof Date) && !v._bsontype && !Array.isArray(v)) out[k] = raw(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => (x && typeof x === "object" && !x._bsontype ? raw(x) : String(x)));
    else out[k] = v instanceof Date ? v.toISOString() : v?._bsontype ? String(v) : clip(v);
  }
  return out;
}

// What a database administrator (or a leaked dump) would see. No KEK, no plaintext clinical data.
export const GET = route(async (req) => {
  requireDemoPassword(req);
  const [persons, users, orgs, dataKeys, objects, records, grants, events, log] = await Promise.all([
    Person.find().lean(), User.find().lean(), Organization.find().lean(), DataKey.find().lean(),
    VaultObject.find().sort({ _id: -1 }).limit(6).lean(), Record.find().sort({ _id: -1 }).limit(6).lean(),
    Grant.find().sort({ _id: -1 }).limit(3).lean(), ConsentEvent.find().sort({ _id: -1 }).limit(4).lean(),
    AccessLog.find().sort({ _id: -1 }).limit(6).lean(),
  ]);
  const chains = await Promise.all(
    persons.map(async (p) => ({ publicRef: p.publicRef, access: await verifyAccessChain(p._id), consent: await verifyConsentChain(p._id) }))
  );
  return ok({
    chains,
    collections: [
      { name: "identity.persons", note: "No name, DOB or address — only a public handle and an HMAC blind index of the health ID.", rows: persons.map(raw) },
      { name: "identity.organizations", note: "Each org has a hard ceiling of categories and purposes it may ever request.", rows: orgs.map(raw) },
      { name: "identity.users", note: "Login accounts. Clinicians and adjusters belong to an organisation.", rows: users.map(raw) },
      { name: "vault.data_keys", note: "Per-person data keys, stored only wrapped by the KEK (which lives outside the DB).", rows: dataKeys.map(raw) },
      { name: "vault.objects", note: "AES-256-GCM ciphertext + nonce + auth tag. Unreadable without the KEK.", rows: objects.map(raw) },
      { name: "clinical.records", note: "Searchable metadata only (category, author, code). The clinical content is a vault reference.", rows: records.map(raw) },
      { name: "consent.grants", note: "Scoped, expiring capabilities. Exclusion scopes beat inclusions.", rows: grants.map(raw) },
      { name: "consent.events", note: "Append-only, hash-chained consent ledger.", rows: events.map(raw) },
      { name: "audit.access_log", note: "Append-only, hash-chained; written before any plaintext is released.", rows: log.map(raw) },
    ],
  });
});
