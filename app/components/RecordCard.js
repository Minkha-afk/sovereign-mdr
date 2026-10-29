import { pretty, fmtDate } from "@/lib/constants";
import { Badge, sensitivityTone } from "./ui";

export default function RecordCard({ record: r, showBasis }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium capitalize text-slate-900">{pretty(r.category)}</span>
        <Badge tone={sensitivityTone(r.sensitivity)}>{r.sensitivity}</Badge>
        {showBasis && r.basis && <Badge tone={r.basis === "break_glass" ? "red" : "green"}>via {pretty(r.basis)}</Badge>}
        <span className="ml-auto text-xs text-slate-400">{fmtDate(r.effectiveAt)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {r.authorOrg}
        {r.author ? ` · ${r.author}` : ""}
        {r.encounter ? ` · ${r.encounter}` : ""}
      </p>
      {r.code && <p className="mt-1 font-mono text-xs text-slate-500">{r.code}</p>}
      <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        {r.shredded ? (
          <span className="text-rose-700">Data key destroyed — this payload can never be decrypted.</span>
        ) : r.error ? (
          <span className="text-rose-700">{r.error}</span>
        ) : (
          Object.entries(r.data || {}).map(([k, v]) => (
            <p key={k}>
              <span className="font-medium capitalize text-slate-500">{pretty(k)}:</span> {v}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
