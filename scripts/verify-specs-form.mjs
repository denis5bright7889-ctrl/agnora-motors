// Verifies the collapsible Technical specifications card in /sell/new:
//   - collapsed by default
//   - expands on click
//   - "Why this matters" hints visible for HP + torque
//   - EV-only fields appear when fuel=electric
//   - Pickup-only fields appear when bodyType=pickup
//   - Engine cc hides when fuel=electric
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = "http://localhost:3000";
const PORT = 9312;
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  "--no-default-browser-check", "--disable-gpu",
  "--user-data-dir=" + process.env.TEMP + "/specs-form-verify", "about:blank",
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
await send("Page.navigate", { url: BASE + "/sell/new" }, sessionId);
await sleep(2500);
await ev(`localStorage.removeItem("agnora:sell-new:images"); true`);

let pass = 0, fail = 0;
function check(label, ok) { if (ok) { pass++; console.log(`  PASS  ${label}`); } else { fail++; console.log(`  FAIL  ${label}`); } }

console.log("\n[1] Collapsed by default");
const collapsedHeading = await ev(`document.body.innerText.includes('Technical specifications')`);
check("Header 'Technical specifications' visible", collapsedHeading);
const hpHidden = await ev(`!document.querySelector('input[name="specifications.horsepower"]')`);
check("Horsepower input is NOT in DOM yet (collapsed)", hpHidden);

console.log("\n[2] Expand on click");
await ev(`
  [...document.querySelectorAll('button')].find(b => /Technical specifications/.test(b.textContent || ''))?.click();
  true
`);
await sleep(400);
const hpVisible = await ev(`!!document.querySelector('input[name="specifications.horsepower"]')`);
check("Horsepower input present after expand", hpVisible);
const torqueVisible = await ev(`!!document.querySelector('input[name="specifications.torqueNm"]')`);
check("Torque input present", torqueVisible);
const drivetrainVisible = await ev(`!!document.querySelector('select[name="drivetrain"]')`);
check("Drivetrain select present", drivetrainVisible);
const engineCCVisible = await ev(`!!document.querySelector('input[name="specifications.engineCC"]')`);
check("Engine cc visible (fuel=petrol default)", engineCCVisible);
const hintHP = await ev(`document.body.innerText.includes('Higher horsepower generally means')`);
check("'Why this matters' hint for HP visible", hintHP);
const hintTorque = await ev(`document.body.innerText.includes('Higher torque improves towing')`);
check("'Why this matters' hint for Torque visible", hintTorque);

console.log("\n[3] Switch fuel to Electric — engine cc hides, battery fields appear");
await ev(`(() => {
  const el = document.querySelector('select[name="fuel"]');
  const proto = window.HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, 'electric');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await sleep(400);
const engineCCHidden = await ev(`!document.querySelector('input[name="specifications.engineCC"]')`);
check("Engine cc hidden when fuel=electric", engineCCHidden);
const batteryVisible = await ev(`!!document.querySelector('input[name="specifications.batteryCapacityKwh"]')`);
check("Battery capacity (kWh) appears", batteryVisible);
const rangeVisible = await ev(`!!document.querySelector('input[name="specifications.batteryRangeKm"]')`);
check("Range (km) appears", rangeVisible);
const chargingVisible = await ev(`!!document.querySelector('input[name="specifications.chargingTimeHours"]')`);
check("Charging time appears (Electric-only)", chargingVisible);

console.log("\n[4] Switch body to Pickup — payload + towing appear");
await ev(`(() => {
  const el = document.querySelector('select[name="bodyType"]');
  const proto = window.HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, 'pickup');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await sleep(400);
const payloadVisible = await ev(`!!document.querySelector('input[name="specifications.payloadKg"]')`);
check("Payload (kg) appears when bodyType=pickup", payloadVisible);
const towingVisible = await ev(`!!document.querySelector('input[name="specifications.towingKg"]')`);
check("Towing capacity (kg) appears", towingVisible);

ws.close(); chrome.kill();
console.log(`\n${fail === 0 ? "ALL FORM CHECKS PASSED" : `${fail} FAILURE(S), ${pass} passed`}`);
process.exit(fail === 0 ? 0 : 1);
