// Loads the freshly-created detail page, clicks the "Specs" tab, and confirms
// every specifications field round-trips end-to-end from DB → page render.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const SLUG = process.argv[2];
if (!SLUG) { console.error("usage: node scripts/verify-specs-tab.mjs <slug>"); process.exit(1); }
const BASE = "http://localhost:3000";
const PORT = 9311;

const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  "--no-default-browser-check", "--disable-gpu",
  "--user-data-dir=" + process.env.TEMP + "/specs-verify", "about:blank",
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
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)).result?.value;

await send("Page.navigate", { url: `${BASE}/cars/${SLUG}` }, sessionId);
await sleep(2500);

// Click the "Specs" tab.
const clicked = await ev(`
  [...document.querySelectorAll('button')].find(b => /^\\s*Specs\\s*$/i.test(b.textContent || ''))?.click();
  true
`);
await sleep(500);

const txt = await ev(`document.body.innerText`);
let pass = 0, fail = 0;
function check(label, ok) { if (ok) { pass++; console.log(`  PASS  ${label}`); } else { fail++; console.log(`  FAIL  ${label}`); } }

console.log("\nDetail page → Specs tab:");
check("'219 hp' visible",           /219\s*hp/i.test(txt));
check("'220 Nm' visible",           /220\s*Nm/i.test(txt));
check("'2,500 cc' visible",         /2,?500\s*cc/i.test(txt));
check("'18.4 km/L' visible",        /18\.4\s*km\/L/i.test(txt));
check("'1.6 kWh' visible",          /1\.6\s*kWh/i.test(txt));
check("'65 km' (EV range) visible", /65\s*km/i.test(txt));
check("'All-wheel drive' visible",  /All-wheel drive/i.test(txt));
check("'Pearl White' visible",      /Pearl White/i.test(txt));
check("'Black leather' visible",    /Black leather/i.test(txt));
check("Group heading 'Battery & range' visible", /Battery & range/i.test(txt));
check("Group heading 'Engine & drivetrain' visible", /Engine & drivetrain/i.test(txt));
check("Group heading 'Capacity' visible", /Capacity/i.test(txt));

ws.close(); chrome.kill();
console.log(`\n${fail === 0 ? "ALL SPECS RENDER" : `${fail} FAILURE(S), ${pass} passed`}`);
process.exit(fail === 0 ? 0 : 1);
