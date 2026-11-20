// Starts `next start` against the STAGING database.
//
// Next loads .env.local, which holds the PRODUCTION DATABASE_URL — but it
// does not overwrite variables already present in process.env. Passing
// DATABASE_URL in the child's environment therefore wins, and the staging
// connection string never appears on a command line or in shell history.
//
//   node scripts/staging/serve-staging.mjs [port]
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const staging = env.STAGING_DATABASE_URL;
if (!staging) {
  console.error("REFUSED: STAGING_DATABASE_URL is not set in .env.local.");
  process.exit(1);
}
if (env.DATABASE_URL && new URL(staging).hostname === new URL(env.DATABASE_URL).hostname) {
  console.error("REFUSED: STAGING_DATABASE_URL points at the same endpoint as DATABASE_URL.");
  process.exit(1);
}

const port = process.argv[2] ?? "3200";
console.log("serving on :%s against %s", port, new URL(staging).hostname.split("-pooler")[0]);

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", port],
  { env: { ...process.env, DATABASE_URL: staging }, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
