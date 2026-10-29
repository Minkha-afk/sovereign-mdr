"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_HEALTH_ID, SENSITIVITY, pretty, fmtDate, fmtDateTime } from "@/lib/constants";
import { api } from "../components/api";
import { Card, Badge, Button, Empty, Alert, CategoryChip } from "../components/ui";
import RecordCard from "../components/RecordCard";

export default function OrgConsole() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [healthId, setHealthId] = useState(DEMO_HEALTH_ID);
  const [patient, setPatient] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api("/api/session").then(setMe).catch((e) => setError(e.message));
  }, []);

  const refreshInfo = useCallback(async (ref) => setInfo(await api(`/api/persons/${ref}`)), []);

  async function run(fn, message) {
    setError("");
    setFlash("");
    try {
      const out = await fn();
      if (message) setFlash(message);
      if (patient) await refreshInfo(patient.publicRef);
      return out;
    } catch (e) {
      setError(e.message);
    }
  }

  async function lookup(e) {
    e.preventDefault();
    setPatient(null);
    setInfo(null);
    const found = await run(() => api("/api/persons/lookup", { healthId }));
    if (found) {
      setPatient(found);
      await refreshInfo(found.publicRef);
    }
  }

  if (!me)
    return (
      <Card title="Organisation console">
        {error ? <Alert>{error}</Alert> : <p className="text-slate-500">Loading…</p>}
      </Card>
    );
  if (me.user.kind === "patient")
    return (
      <Card title="Organisation console">
        <p className="text-sm text-slate-600">You are acting as a patient. Pick a doctor, lab scientist or insurer in the persona picker.</p>
      </Card>
    );

  const isClinician = me.user.kind === "clinician";
  const isHospital = me.org.orgType === "hospital";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{pretty(me.org.orgType)} console · {me.org.registrationNumber}</p>
          <h1 className="text-2xl font-bold text-slate-900">{me.org.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as {me.user.name} · {pretty(me.user.role)}
            {me.user.licence ? ` · licence ${me.user.licence}` : ""}
          </p>
        </div>
        <div className="max-w-md text-right">
          <span className="label">Organisation ceiling</span>
          <div className="flex flex-wrap justify-end gap-1">
            {me.org.permittedCategories.map((c) => <CategoryChip key={c} category={c} />)}
          </div>
        </div>
      </div>

      <Card title="Find a patient" subtitle="Search by national health ID. The ID is never stored — only its HMAC blind index.">
        <form onSubmit={lookup} className="flex flex-wrap gap-2">
          <input className="input max-w-xs" value={healthId} onChange={(e) => setHealthId(e.target.value)} placeholder="e.g. 91-2345-6789-0123" />
          <Button type="submit">Look up</Button>
        </form>
        {patient && (
          <p className="mt-3 text-sm text-slate-600">
            Found patient <code className="font-mono font-semibold text-slate-900">{patient.publicRef}</code> (region {patient.region}). Blind
            index <code className="font-mono text-xs text-slate-500">{patient.blindIndex.slice(0, 16)}…</code>
          </p>
        )}
      </Card>

      <Alert tone="green">{flash}</Alert>
      <Alert>{error}</Alert>

      {patient && info && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <ReadRecords me={me} publicRef={patient.publicRef} run={run} />
            {isClinician && <AuthorRecord me={me} publicRef={patient.publicRef} run={run} />}
          </div>
          <div className="space-y-6">
            <AccessSummary info={info} />
            <RequestConsent me={me} publicRef={patient.publicRef} run={run} />
            {isHospital && <BreakGlass publicRef={patient.publicRef} run={run} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadRecords({ me, publicRef, run }) {
  const [purpose, setPurpose] = useState(me.org.permittedPurposes[0]);
  const [result, setResult] = useState(null);

  async function fetchRecords() {
    const out = await run(() => api(`/api/persons/${publicRef}/records?purpose=${purpose}`));
    if (out) setResult(out);
  }

  return (
    <Card
      title="Patient records"
      subtitle="Every record is checked against your org ceiling and the patient's consent. Each attempt is logged before anything is decrypted."
    >
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="label">Purpose of use</span>
          <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {me.org.permittedPurposes.map((p) => <option key={p} value={p}>{pretty(p)}</option>)}
          </select>
        </div>
        <Button onClick={fetchRecords}>Fetch records</Button>
      </div>
      {result && (
        <div className="mt-4 space-y-3">
          {result.withheld > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {result.withheld} record(s) withheld by the patient&apos;s consent or your organisation&apos;s ceiling. The patient can see these attempts.
            </div>
          )}
          {result.released.length === 0 ? (
            <Empty>Nothing was released to you.</Empty>
          ) : (
            result.released.map((r) => <RecordCard key={r.id} record={r} showBasis />)
          )}
        </div>
      )}
    </Card>
  );
}

function AccessSummary({ info }) {
  return (
    <Card title="Your access to this patient">
      <div className="space-y-4 text-sm">
        <div>
          <span className="label">Grants</span>
          {info.grants.length === 0 ? (
            <p className="text-slate-400">None.</p>
          ) : (
            info.grants.map((g) => (
              <div key={g.id} className="mb-2 rounded-lg bg-slate-50 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={g.status === "active" ? "green" : "slate"}>{g.status}</Badge>
                  <Badge tone="indigo">{pretty(g.purpose)}</Badge>
                  <span className="text-xs text-slate-500">
                    until {fmtDate(g.validUntil)} · used {g.useCount}{g.maxUses ? `/${g.maxUses}` : ""}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {g.scopes.map((s, i) => <CategoryChip key={i} category={s.category || "any"} exclude={s.isExclusion} />)}
                </div>
              </div>
            ))
          )}
        </div>
        <div>
          <span className="label">Requests</span>
          {info.requests.length === 0 ? (
            <p className="text-slate-400">None.</p>
          ) : (
            <ul className="space-y-1">
              {info.requests.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={q.status === "approved" ? "green" : q.status === "denied" ? "red" : "amber"}>{q.status}</Badge>
                  {pretty(q.purpose)} · {q.categories.map(pretty).join(", ")}
                  <span className="text-xs text-slate-400">{fmtDateTime(q.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {info.breakGlass.length > 0 && (
          <div>
            <span className="label">Break-glass sessions</span>
            {info.breakGlass.map((b) => (
              <p key={b.id}>
                <Badge tone={b.active ? "red" : "slate"}>{b.active ? "active" : "expired"}</Badge> until {fmtDateTime(b.expiresAt)}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function RequestConsent({ me, publicRef, run }) {
  const [purpose, setPurpose] = useState(me.org.permittedPurposes[0]);
  const [categories, setCategories] = useState([]);
  const [justification, setJustification] = useState("");
  const [durationDays, setDurationDays] = useState(30);

  async function submit(e) {
    e.preventDefault();
    const out = await run(
      () => api("/api/consent/requests", { publicRef, purpose, categories, justification, durationDays }),
      "Request sent. The patient decides in their portal."
    );
    if (out) {
      setCategories([]);
      setJustification("");
    }
  }

  return (
    <Card title="Request consent" subtitle="You can only ask for categories and purposes inside your organisation's ceiling.">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">Purpose</span>
            <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {me.org.permittedPurposes.map((p) => <option key={p} value={p}>{pretty(p)}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Days</span>
            <input className="input" type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          </div>
        </div>
        <div>
          <span className="label">Categories</span>
          <div className="grid grid-cols-2 gap-1">
            {me.org.permittedCategories.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={categories.includes(c)}
                  onChange={() => setCategories(categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c])}
                />
                {pretty(c)}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Justification (min. 20 characters)</span>
          <textarea className="input" rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </div>
        <Button type="submit" disabled={!categories.length}>Send request</Button>
      </form>
    </Card>
  );
}

function AuthorRecord({ me, publicRef, run }) {
  const empty = { category: me.org.permittedCategories[0], sensitivity: "normal", codeSystem: "", codeValue: "", codeDisplay: "", effectiveAt: "", content: "" };
  const [form, setForm] = useState(empty);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const out = await run(() => api(`/api/persons/${publicRef}/records`, form), "Record encrypted and saved. You still need consent to read it back.");
    if (out) setForm(empty);
  }

  return (
    <Card title="Add a clinical record" subtitle="The content is encrypted with the patient's data key before it reaches the database. Records are append-only.">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <span className="label">Category</span>
            <select className="input" value={form.category} onChange={set("category")}>
              {me.org.permittedCategories.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Sensitivity</span>
            <select className="input" value={form.sensitivity} onChange={set("sensitivity")}>
              {SENSITIVITY.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Effective date</span>
            <input className="input" type="date" value={form.effectiveAt} onChange={set("effectiveAt")} />
          </div>
        </div>
        {form.sensitivity === "normal" && (
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Code system (LOINC)" value={form.codeSystem} onChange={set("codeSystem")} />
            <input className="input" placeholder="Code (2345-7)" value={form.codeValue} onChange={set("codeValue")} />
            <input className="input" placeholder="Display (Glucose)" value={form.codeDisplay} onChange={set("codeDisplay")} />
          </div>
        )}
        <textarea className="input" rows={3} placeholder="Clinical content — this is what gets encrypted" value={form.content} onChange={set("content")} />
        <Button type="submit" disabled={!form.content.trim()}>Encrypt &amp; save</Button>
      </form>
    </Card>
  );
}

function BreakGlass({ publicRef, run }) {
  const [justification, setJustification] = useState("");
  const [hours, setHours] = useState(4);

  async function submit(e) {
    e.preventDefault();
    if (!confirm("Break-glass overrides the patient's consent. The patient is notified and a privacy officer will review it. Continue?")) return;
    const out = await run(() => api("/api/break-glass", { publicRef, justification, hours }), "Break-glass active. Fetch records to read everything.");
    if (out) setJustification("");
  }

  return (
    <Card title="Emergency break-glass" subtitle="For an unconscious or unreachable patient. Max 24 hours." className="border-rose-200">
      <form onSubmit={submit} className="space-y-3">
        <textarea
          className="input"
          rows={2}
          placeholder="Justification (min. 30 characters), e.g. Unconscious in ED after road accident, need allergies"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
        <div className="flex items-end gap-2">
          <div className="w-24">
            <span className="label">Hours</span>
            <input className="input" type="number" min={1} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <Button variant="danger" type="submit">Break the glass</Button>
        </div>
      </form>
    </Card>
  );
}
