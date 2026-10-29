import { pretty } from "@/lib/constants";

export function Card({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700",
  teal: "bg-teal-50 text-teal-800 ring-teal-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
};

export function Badge({ tone = "slate", children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/5 ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-teal-700 text-white hover:bg-teal-800",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Empty({ children }) {
  return <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">{children}</p>;
}

export function Alert({ tone = "red", children }) {
  if (!children) return null;
  const s = tone === "red" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${s}`}>{children}</div>;
}

export const sensitivityTone = (s) => (s === "normal" ? "slate" : s === "sensitive" ? "amber" : "red");

export function CategoryChip({ category, exclude }) {
  return <Badge tone={exclude ? "red" : "teal"}>{exclude ? "except " : ""}{pretty(category)}</Badge>;
}

export function Hash({ value }) {
  return <code className="font-mono text-[11px] text-slate-500">{value ? `${value.slice(0, 10)}…` : "genesis"}</code>;
}

export function ChainStatus({ chain, label }) {
  if (!chain) return null;
  return chain.ok ? (
    <Badge tone="green">✓ {label} chain verified · {chain.length} entries</Badge>
  ) : (
    <Badge tone="red">✗ {label} chain BROKEN at entry #{chain.brokenAt}</Badge>
  );
}
