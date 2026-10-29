// Shared by server and client code.

export const CATEGORIES = [
  "lab_result",
  "diagnosis",
  "prescription",
  "discharge_summary",
  "imaging_study",
  "procedure",
  "mental_health",
  "insurance_claim",
];

export const PURPOSES = ["treatment", "emergency", "claims_adjudication", "research"];

export const SENSITIVITY = ["normal", "sensitive", "restricted"];

export const PERSONAS = [
  { code: "U1", name: "Anita Das", title: "Patient (data subject)", home: "/patient" },
  { code: "U2", name: "Dr. Rahul Sharma", title: "Attending physician · Brahmaputra General Hospital", home: "/console" },
  { code: "U3", name: "Kabir Deka", title: "Lab scientist · Northeast Diagnostics Lab", home: "/console" },
  { code: "U4", name: "Priya Nair", title: "Claims adjuster · Aegis Health Insurance", home: "/console" },
];

// Fictional national health ID (ABHA) of the demo patient.
export const DEMO_HEALTH_ID = "91-2345-6789-0123";

export const pretty = (s) => (s ? String(s).replaceAll("_", " ") : "");

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
