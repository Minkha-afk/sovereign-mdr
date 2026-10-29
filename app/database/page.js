"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../components/api";
import { Card, Button, Alert, ChainStatus } from "../components/ui";
import { SeedButton } from "../components/LandingActions";

export default function DatabaseView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api("/api/admin/inspect"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function tamper() {
    try {
      const out = await api("/api/admin/tamper", {});
      setFlash(`Audit entry #${out.tamperedSeq} was silently changed from "deny" to "allow" with the raw driver.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Database view</p>
        <h1 className="text-2xl font-bold text-slate-900">What a DBA — or a leaked dump — would see</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Raw MongoDB documents. There are no patient names, no birth dates, no health IDs and no clinical values here. The key that unwraps
          the data keys (the KEK) lives in the server environment, standing in for a KMS/HSM.
        </p>
      </div>

      <Alert>{error}</Alert>
      <Alert tone="green">{flash}</Alert>

      <Card title="Tamper evidence" subtitle="Audit and consent rows are hash-chained per person. Edit any row and verification fails.">
        <div className="flex flex-wrap items-center gap-3">
          {data?.chains.map((c) => (
            <div key={c.publicRef} className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm">{c.publicRef}</code>
              <ChainStatus chain={c.access} label="Access-log" />
              <ChainStatus chain={c.consent} label="Consent" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="danger" onClick={tamper}>Simulate a rogue DBA edit</Button>
          <Button variant="secondary" onClick={load}>Re-verify</Button>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <SeedButton label="Reset demo data" />
        </div>
      </Card>

      {data?.collections.map((c) => (
        <Card key={c.name} title={<code className="font-mono">{c.name}</code>} subtitle={c.note}>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
            {c.rows.length ? JSON.stringify(c.rows, null, 2) : "[]"}
          </pre>
        </Card>
      ))}
    </div>
  );
}
