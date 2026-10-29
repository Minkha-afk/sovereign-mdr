# Sovereign MDR — prototype

A small Next.js + MongoDB prototype of the **Sovereign Medical Data Record System** (CSBT302 Database Lab).
Clinical data is encrypted, the patient approves scoped and expiring consent, and every access is written to a
hash-chained audit log before anything is decrypted.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Then click **Load demo data** on the home page and pick a persona.

MongoDB defaults to the local server (`mongodb://127.0.0.1:27017/sovereign_docs`). To use Atlas, change
`MONGODB_URI` in `.env.local`. `VAULT_KEK` (the simulated KMS key) and `BLIND_INDEX_PEPPER` are also set there.

## Pages

| Page | Who | What it shows |
| --- | --- | --- |
| `/` | everyone | idea, read flow, persona picker, demo walkthrough |
| `/patient` | Anita Das | consent inbox, grants + revoke, decrypted records, access log, consent ledger, crypto-shred erasure |
| `/console` | doctor, lab, insurer | find patient by health ID, consent-enforced read, request consent, add record, break-glass |
| `/database` | anyone | raw MongoDB documents (only ciphertext + metadata), chain verification, tamper demo |

## How the report maps to this prototype

| Report (PostgreSQL) | Prototype (MongoDB) |
| --- | --- |
| 7 schemas | collections named `identity.*`, `vault.*`, `clinical.*`, `consent.*`, `audit.*`, `ops.*` |
| `authz.can_access_record()` + RLS | [lib/access.js](lib/access.js), called by every read in the API |
| `append_only()` trigger | Mongoose hooks rejecting updates/deletes ([lib/models.js](lib/models.js)) |
| `chain_entry()` trigger | [lib/chain.js](lib/chain.js) |
| AES-256-GCM envelope encryption, KMS-held KEK | [lib/crypto.js](lib/crypto.js), [lib/vault.js](lib/vault.js) (KEK from env) |
| Object storage for ciphertext | ciphertext stored in `vault.objects` |

Simplified for the prototype: login is a persona cookie (no passwords/MFA), step-up auth and signatures are
simulated, and guardians/delegations, RBAC tables and subject-request tracking are left out.
