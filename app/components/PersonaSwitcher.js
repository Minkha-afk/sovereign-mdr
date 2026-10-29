"use client";

import { useRouter } from "next/navigation";
import { PERSONAS } from "@/lib/constants";
import { api } from "./api";

export async function switchPersona(code, router) {
  const persona = await api("/api/session", { code });
  router.push(persona.home);
  router.refresh();
}

export default function PersonaSwitcher({ current }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-slate-500 sm:inline">Acting as</span>
      <select
        value={current}
        onChange={(e) => switchPersona(e.target.value, router)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800"
      >
        <option value="" disabled>Choose a persona…</option>
        {PERSONAS.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name} — {p.title.split(" · ")[0]}
          </option>
        ))}
      </select>
    </label>
  );
}
