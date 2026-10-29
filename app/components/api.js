"use client";

const KEY = "demoPassword";

function storedPassword() {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export async function api(path, body, retried = false) {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-demo-password": storedPassword() },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));

  // Reset / tamper / database view are protected by a demo password on the hosted version.
  if (res.status === 401 && data.code === "demo_password" && !retried) {
    const password = prompt("Enter the demo admin password:");
    if (password) {
      try {
        sessionStorage.setItem(KEY, password);
      } catch {}
      return api(path, body, true);
    }
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
