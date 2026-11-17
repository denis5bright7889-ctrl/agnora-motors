// Drives /sell/new headless and confirms:
//   1. Pasting a real US VIN + clicking Decode auto-fills the form fields.
//   2. The confirmation banner shows the count of fields filled.
//   3. A field already filled manually is preserved (never overwritten).
//   4. Gibberish VIN shows the "no public record" banner.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT   = 9321;
const BASE   = "http://localhost:3000";

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  "--no-default-browser-check", "--disable-gpu",
  "--user-data-dir=" + process.env.TEMP + "/vin-autofill", "about:blank",
], { stdio: "ignore" });
process.on("exit", () => chrome.kill());

let wsUrl;
for (let i = 0; i < 40; i++) {
  try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); wsUrl = j.webSocketDebuggerUrl; if (wsUrl) break; } catch {}
  await sleep(250);
}
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 1; const pend = new Map();
function send(m, p = {}, s) { const i = id++; ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); return new Promise((res, rej) => pend.set(i, { res, rej })); }
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)).result?.value;

let pass = 0, fail = 0;
function check(label, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`); }
  else    { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); }
}

await send("Page.navigate", { url: BASE + "/sell/new" }, sessionId);
await sleep(2500);

// 1. Paste real US VIN into the VIN input, click Decode VIN.
console.log("\n[1] Real US VIN auto-fills empty fields");
const vinSet = await ev(`(() => {
  const el = document.querySelector('input[name="vin"]');
  if (!el) return false;
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  d.call(el, '1HGCM82633A123456');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
check("VIN input populated", vinSet);

await ev(`[...document.querySelectorAll('button')].find(b => /Decode VIN/.test(b.textContent || ''))?.click(); true`);
await sleep(3500);  // NHTSA round-trip

const fieldsAfter = await ev(`JSON.stringify({
  make:         document.querySelector('select[name="make"]')?.value,
  model:        document.querySelector('input[name="model"]')?.value,
  year:         document.querySelector('select[name="year"]')?.value,
  bodyType:     document.querySelector('select[name="bodyType"]')?.value,
  fuel:         document.querySelector('select[name="fuel"]')?.value,
  transmission: document.querySelector('select[name="transmission"]')?.value,
  trim:         document.querySelector('input[name="trim"]')?.value,
})`);
console.log("    form snapshot:", fieldsAfter);
const f = JSON.parse(fieldsAfter);
check("model auto-filled to 'Accord'",       f.model === "Accord", `got "${f.model}"`);
check("year auto-filled to '2003'",          f.year === "2003");
check("make auto-filled to 'Honda'",         f.make === "Honda");
check("bodyType auto-filled to 'coupe'",     f.bodyType === "coupe");
check("fuel auto-filled to 'petrol'",        f.fuel === "petrol");
check("transmission auto-filled to 'auto'",  f.transmission === "auto");
check("trim auto-filled to 'EX-V6'",         f.trim === "EX-V6");

// 2. Confirmation banner shows the count
const banner = await ev(`document.body.textContent.match(/(\\d+) fields? filled from your VIN/)?.[0] ?? ''`);
check("Confirmation banner shows count", /fields? filled from your VIN/.test(banner), banner);

// 3. Manual edit is preserved — change model BEFORE next decode
console.log("\n[2] Re-decode keeps manual edit intact");
await ev(`(() => {
  const el = document.querySelector('input[name="model"]');
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  d.call(el, 'Accord Custom');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
// Hit Decode again — cache hit, applied count should be 0 (everything already filled)
await ev(`[...document.querySelectorAll('button')].find(b => /Decode VIN/.test(b.textContent || ''))?.click(); true`);
await sleep(1500);
const modelAfter = await ev(`document.querySelector('input[name="model"]')?.value`);
check("Manual edit 'Accord Custom' preserved across re-decode", modelAfter === "Accord Custom", `got "${modelAfter}"`);
const reBanner = await ev(`document.body.textContent.includes("You'd already filled these fields manually") ? 'preserve-message' : (document.body.textContent.match(/0 fields/)?.[0] ?? '')`);
check("Banner explains nothing was overwritten", /preserve|0 field/i.test(reBanner), reBanner);

// 4. Gibberish VIN → no-match banner
console.log("\n[3] Gibberish VIN → 'No public record found' banner");
await ev(`(() => {
  const el = document.querySelector('input[name="vin"]');
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  d.call(el, 'ZZZZZZZZZZZZZZZZZ');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await ev(`[...document.querySelectorAll('button')].find(b => /Decode VIN/.test(b.textContent || ''))?.click(); true`);
await sleep(3500);
const noMatch = await ev(`/No public record found/.test(document.body.textContent)`);
check("'No public record found' banner present", noMatch);

ws.close(); chrome.kill();
console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : `${fail} FAILURE(S), ${pass} passed`}`);
process.exit(fail === 0 ? 0 : 1);
