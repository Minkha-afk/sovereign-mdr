"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, pretty, fmtDate, fmtDateTime } from "@/lib/constants";
import { api } from "../components/api";
import { Card, Badge, Button, Empty, Alert, CategoryChip, Hash, ChainStatus } from "../components/ui";
import { SeedButton } from "../components/LandingActions";
import RecordCard from "../components/RecordCard";

export default function PatientPortal() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api("/api/patient"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn, message) {
    try {
      await fn();
      setFlash(message);
      await load();
    } catch (e) {
      setFlash("");
      setError(e.message);
    }
  }

  if (error && !data)
    return (
      <Card title="Patient portal">
        <div className="space-y-3">
          <Alert>{error}</Alert>
          <p className="text-sm text-slate-600">Choose “Anita Das” in the persona picker at the top. If the database is empty, load the demo data first.</p>
          <SeedButton />
        </div>
      </Card>
    );
  if (!data) return <p className="text-slate-500">Loading…</p>;

  const pending = data.requests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Patient portal</p>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {data.me.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Public reference <code className="font-mono text-slate-700">{data.me.publicRef}</code> · data residency {data.me.region}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChainStatus chain={data.chains.access} label="Access-log" />
          <ChainStatus chain={data.chains.consent} label="Consent" />
        </div>
      </div>

      <Alert tone="green">{flash}</Alert>
      {data && <Alert>{error}</Alert>}

      {data.breakGlass.some((b) => b.active) && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <strong>Emergency access is active.</strong>{" "}
          {data.breakGlass.filter((b) => b.active).map((b) => `${b.by} (${b.org}) until ${fmtDateTime(b.expiresAt)} — “${b.justification}”`).join("; ")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title={`Consent inbox (${pending.length})`} subtitle="Organisations must ask you before they can read anything.">
          {pending.length === 0 ? (
            <Empty>No pending requests.</Empty>
          ) : (
            <div className="space-y-4">
              {pending.map((r) => (
                <RequestDecision key={r.id} request={r} onDone={(fn, msg) => run(fn, msg)} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Notifications">
          {data.notifications.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.notifications.map((n) => (
                <li key={n._id} className={`rounded-lg px-3 py-2 text-sm ${n.kind === "break_glass" ? "bg-rose-50 text-rose-900" : "bg-slate-50 text-slate-700"}`}>
                  <div>{n.message}</div>
                  <div className="text-xs text-slate-400">{fmtDateTime(n.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Who can see my data" subtitle="Grants are scoped, expiring and revocable. Red chips are explicit exclusions.">
        {data.grants.length === 0 ? (
          <Empty>You have not granted access to anyone.</Empty>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.grants.map((g) => (
              <div key={g.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{g.org}</span>
                    <Badge tone={g.status === "active" ? "green" : "slate"}>{g.status}</Badge>
                    <Badge tone="indigo">{pretty(g.purpose)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.scopes.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <CategoryChip category={s.category || "any"} exclude={s.isExclusion} />
                        {s.authorOrg && <span className="text-xs text-slate-500">by {s.authorOrg}</span>}
                        {(s.from || s.to) && <span className="text-xs text-slate-500">{fmtDate(s.from)} – {fmtDate(s.to)}</span>}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    {fmtDate(g.validFrom)} → {fmtDate(g.validUntil)} · used {g.useCount}
                    {g.maxUses ? ` of ${g.maxUses}` : ""} times
                    {g.revokedAt && ` · revoked ${fmtDateTime(g.revokedAt)} (${g.revocationReason})`}
                  </p>
                </div>
                {g.status === "active" && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      const reason = prompt("Reason for revoking (optional):", "No longer needed");
                      if (reason === null) return;
                      run(() => api(`/api/consent/grants/${g.id}/revoke`, { reason }), `Access for ${g.org} revoked.`);
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="My records" subtitle="Decrypted for you on demand. In the database these are only ciphertext.">
        <div className="grid gap-3 md:grid-cols-2">
          {data.records.map((r) => (
            <RecordCard key={r.id} record={r} />
          ))}
        </div>
      </Card>

      <Card
        title="Access log"
        subtitle="Every attempt by an organisation to read your records — allowed or denied. Each row is hash-chained to the previous one."
        actions={<ChainStatus chain={data.chains.access} label="Access-log" />}
      >
        <AccessTable rows={data.accessLog} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Consent ledger" subtitle="Append-only history of every consent decision.">
          <ul className="space-y-1.5 text-sm">
            {data.events.map((e) => (
              <li key={e.seq} className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-slate-400">#{e.seq}</span> <Badge tone={e.kind === "break_glass" ? "red" : "slate"}>{pretty(e.kind)}</Badge>{" "}
                  by {e.actor} · {fmtDateTime(e.at)}
                </span>
                <Hash value={e.entryHash} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Right to erasure" subtitle="Crypto-shredding destroys your data key. The ciphertext stays, but nobody can ever decrypt it again.">
          <Button
            variant="danger"
            disabled={data.me.legalHold}
            onClick={() => {
              if (!confirm("Destroy your data key? Every record becomes permanently unreadable (reload the demo data to undo).")) return;
              run(() => api("/api/patient/erase", {}), "Your data key was destroyed.");
            }}
          >
            Erase my data (crypto-shred)
          </Button>
          {data.me.legalHold && <p className="mt-2 text-sm text-amber-700">A legal hold currently blocks erasure.</p>}
        </Card>
      </div>
    </div>
  );
}

function RequestDecision({ request, onDone }) {
  const [include, setInclude] = useState(request.categories);
  const [exclude, setExclude] = useState(["mental_health"]);
  const [days, setDays] = useState(request.durationDays);
  const [maxUses, setMaxUses] = useState(5);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const toggle = (list, setList, c) => setList(list.includes(c) ? list.filter((x) => x !== c) : [...list, c]);

  function approve() {
    if (!confirm("Step-up confirmation (simulated): sign this grant with your second factor?")) return;
    onDone(
      () => api(`/api/consent/requests/${request.id}`, { action: "approve", categories: include, exclude, days, maxUses, from, to }),
      `Access granted to ${request.org}.`
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{request.org}</span>
        <Badge tone="indigo">{pretty(request.purpose)}</Badge>
        <span className="text-xs text-slate-400">by {request.requester} · {fmtDateTime(request.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm italic text-slate-600">“{request.justification}”</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <span className="label">Share these categories</span>
          {request.categories.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={include.includes(c)} onChange={() => toggle(include, setInclude, c)} />
              {pretty(c)}
            </label>
          ))}
        </div>
        <div>
          <span className="label">Always exclude</span>
          {CATEGORIES.filter((c) => !include.includes(c)).map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={exclude.includes(c)} onChange={() => toggle(exclude, setExclude, c)} />
              {pretty(c)}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <span className="label">Days</span>
          <input className="input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
        <div>
          <span className="label">Max uses</span>
          <input className="input" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
        </div>
        <div>
          <span className="label">Records from</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <span className="label">Records to</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={approve} disabled={!include.length}>Approve</Button>
        <Button
          variant="secondary"
          onClick={() => onDone(() => api(`/api/consent/requests/${request.id}`, { action: "deny" }), `Request from ${request.org} denied.`)}
        >
          Deny
        </Button>
      </div>
    </div>
  );
}

function AccessTable({ rows }) {
  if (!rows.length) return <Empty>No organisation has touched your records yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">When</th>
            <th className="py-2 pr-3">Who</th>
            <th className="py-2 pr-3">Record</th>
            <th className="py-2 pr-3">Purpose</th>
            <th className="py-2 pr-3">Decision</th>
            <th className="py-2 pr-3">prev → entry hash</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((a) => (
            <tr key={a.seq}>
              <td className="py-2 pr-3 text-slate-400">{a.seq}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(a.at)}</td>
              <td className="py-2 pr-3">
                {a.actor}
                <div className="text-xs text-slate-400">{a.actorOrg}</div>
              </td>
              <td className="py-2 pr-3">{pretty(a.category)}</td>
              <td className="py-2 pr-3">{pretty(a.purpose)}</td>
              <td className="py-2 pr-3">
                {a.decision === "allow" ? (
                  <Badge tone={a.basis === "break-glass" ? "red" : "green"}>allow · {a.basis}</Badge>
                ) : (
                  <Badge tone="red">deny · {pretty(a.denyReason)}</Badge>
                )}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                <Hash value={a.prevHash} /> → <Hash value={a.entryHash} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
