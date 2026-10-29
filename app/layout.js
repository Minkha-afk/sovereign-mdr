import Link from "next/link";
import { cookies } from "next/headers";
import { PERSONAS } from "@/lib/constants";
import PersonaSwitcher from "./components/PersonaSwitcher";
import "./globals.css";

export const metadata = {
  title: "Sovereign MDR — prototype",
  description: "Consent-driven, encrypted health records where the patient is the root of authority.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/patient", label: "Patient portal" },
  { href: "/console", label: "Organisation console" },
  { href: "/database", label: "Database view" },
];

export default async function RootLayout({ children }) {
  const code = (await cookies()).get("sov_user")?.value;
  const current = PERSONAS.find((p) => p.code === code) || null;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-sm text-white">S</span>
              Sovereign MDR
            </Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <PersonaSwitcher current={current?.code || ""} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-400">
          Prototype for CSBT302 Database Lab · Names and clinical values are fictional · Clinical payloads are AES-256-GCM encrypted at rest.
        </footer>
      </body>
    </html>
  );
}
