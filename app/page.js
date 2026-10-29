import { SeedButton, PersonaCards } from "./components/LandingActions";
import { Card } from "./components/ui";
import { DEMO_HEALTH_ID } from "@/lib/constants";

const PRINCIPLES = [
  ["Zero plaintext in the DB", "Only ciphertext references and metadata. Persons have no name, DOB or address; the health ID is an HMAC blind index."],
  ["Consent is an append-only ledger", "Requests, grants, revocations and break-glass are immutable, hash-chained events."],
  ["Log before release", "An audit row is chained and written before any record is decrypted and returned."],
  ["The person is the root of authority", "Organisations hold scoped, expiring, revocable capabilities — never ownership."],
  ["Two gates must both pass", "Org ceiling: may this kind of org read labs at all? Consent: may it read THIS person's labs, now, for this purpose?"],
];

const FLOW = [
  "Portal",
  "API resolves user · org · purpose",
  "Ceiling + consent check",
  "Hash-chained audit row",
  "Unwrap DEK with KEK",
  "AES-256-GCM decrypt",
  "Return",
];

const STEPS = [
  "Load the demo data (resets the local MongoDB database).",
  `Act as Priya Nair (insurer). Find the patient with health ID ${DEMO_HEALTH_ID} and fetch records: the lab result and discharge summary come back; mental-health and prescription records are withheld.`,
  "Act as Anita Das. See every access in the hash-chained log, approve or trim the hospital's pending request, and revoke the insurer's grant.",
  "Act as Priya again: nothing is released any more.",
  "Act as Dr. Rahul Sharma: read under the new grant, add a record, or invoke break-glass in an emergency — Anita is notified.",
  "Open Database view: only ciphertext and metadata. Tamper with an audit row and watch the chain verification fail.",
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Prototype · Sovereign Medical Data Record System</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Your health record. Your rules.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            Records from hospitals, labs and insurers are unified under the patient&apos;s authority, stored encrypted, and released
            only under a patient-approved, purpose-bound, expiring consent — with every access provably logged.
          </p>
          <div className="mt-6"><SeedButton /></div>
        </div>
        <Card title="How a read works">
          <ol className="space-y-2">
            {FLOW.map((f, i) => (
              <li key={f} className="flex items-center gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-700 text-xs font-semibold text-white">{i + 1}</span>
                {f}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-500">If the audit write fails, nothing is decrypted.</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Choose who you are</h2>
        <PersonaCards />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map(([t, d]) => (
          <Card key={t}>
            <h3 className="font-semibold text-slate-900">{t}</h3>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </Card>
        ))}
      </section>

      <Card title="Suggested demo walkthrough">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </Card>
    </div>
  );
}
