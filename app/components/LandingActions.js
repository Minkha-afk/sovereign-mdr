"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONAS } from "@/lib/constants";
import { api } from "./api";
import { switchPersona } from "./PersonaSwitcher";
import { Button, Alert } from "./ui";

export function SeedButton({ label = "Load demo data" }) {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, msg: "", err: "" });
  async function seed() {
    if (!confirm("This wipes the local database and reloads the demo scenario. Continue?")) return;
    setState({ busy: true, msg: "", err: "" });
    try {
      await api("/api/seed", {});
      setState({ busy: false, msg: "Demo data loaded. Pick a persona to begin.", err: "" });
      router.refresh();
    } catch (e) {
      setState({ busy: false, msg: "", err: e.message });
    }
  }
  return (
    <div className="space-y-2">
      <Button onClick={seed} disabled={state.busy}>{state.busy ? "Loading…" : label}</Button>
      <Alert tone="green">{state.msg}</Alert>
      <Alert>{state.err}</Alert>
    </div>
  );
}

const ICONS = { U1: "🧑", U2: "🩺", U3: "🧪", U4: "🛡️" };

export function PersonaCards() {
  const router = useRouter();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PERSONAS.map((p) => (
        <button
          key={p.code}
          onClick={() => switchPersona(p.code, router)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-500 hover:shadow"
        >
          <div className="text-2xl">{ICONS[p.code]}</div>
          <div className="mt-2 font-semibold text-slate-900">{p.name}</div>
          <div className="text-sm text-slate-500">{p.title}</div>
          <div className="mt-3 text-sm font-medium text-teal-700">Act as {p.name.split(" ").at(-1)} →</div>
        </button>
      ))}
    </div>
  );
}
