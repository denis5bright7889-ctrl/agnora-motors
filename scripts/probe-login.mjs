// Probe the live /api/auth/callback/credentials endpoint to see which error
// codes actually surface to the client. NextAuth v5 returns them via a 302
// Location with `?code=<x>` for redirect-based clients, or via the JSON
// response body for redirect:false clients.
//
// Usage: node scripts/probe-login.mjs <email> <password>
import { readFileSync } from "node:fs";
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {}

const BASE = process.env.PROBE_BASE_URL ?? "http://localhost:3000";
const email = process.argv[2] ?? "denis5bright7889@gmail.com"; // known Google-only user
const password = process.argv[3] ?? "anything";

// Step 1: fetch CSRF token.
const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
const { csrfToken } = await csrfRes.json();
const cookies = csrfRes.headers.getSetCookie().join("; ");
console.log("CSRF token:", csrfToken?.slice(0, 12) + "…");

// Step 2: post credentials. redirect=false makes NextAuth return JSON.
const body = new URLSearchParams({
  email, password,
  csrfToken,
  callbackUrl: `${BASE}/login`,
  json: "true",
});
const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method:  "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
  body,
  redirect: "manual",
});
console.log("\nStatus:", res.status);
const location = res.headers.get("location");
console.log("Location:", location);
if (location) {
  try {
    const u = new URL(location, BASE);
    console.log("  ?error =", u.searchParams.get("error"));
    console.log("  ?code  =", u.searchParams.get("code"));
  } catch { /* nope */ }
}
const text = await res.text().catch(() => "");
if (text) console.log("\nBody (first 400):", text.slice(0, 400));
