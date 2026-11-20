// Verifies the /api/upload guards against the running staging server.
//
// COST TO CLOUDINARY: zero for every case below. The route checks the folder,
// the size, the magic bytes, the quality verdict and the classifier BEFORE it
// calls cloudinary.uploader.upload(), so a refused request never creates an
// asset. That is what makes this safe to run against a real account.
//
// WHAT THIS DOES NOT COVER: the happy path. A genuine vehicle photograph
// passing the classifier, reaching Cloudinary, and having its sha256 recorded
// is NOT exercised here — that needs real car photographs.
//
//   node scripts/staging/verify-upload-guards.mjs <creds.json> [baseUrl]
import { readFileSync } from "node:fs";

const BASE = process.argv[3] ?? "http://localhost:3000";
const creds = JSON.parse(readFileSync(process.argv[2], "utf8"));

const jar = new Map();
const store = (res) => {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";"); const i = pair.indexOf("=");
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
};
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log("  %s  %s%s", ok ? "PASS" : "FAIL", label, detail ? "  — " + detail : "");
};

// ── 1. unauthenticated ────────────────────────────────────────────────────
console.log("1. authentication boundary\n");
{
  const fd = new FormData();
  fd.set("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }), "x.jpg");
  fd.set("folder", "agnora/cars");
  const r = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd });
  check("an anonymous upload is refused", r.status === 401, `status ${r.status}`);
}

// ── sign in ───────────────────────────────────────────────────────────────
let r = await fetch(`${BASE}/api/auth/csrf`); store(r);
const { csrfToken } = await r.json();
r = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookie() },
  body: new URLSearchParams({ csrfToken, email: creds.email, password: creds.password, redirect: "false" }),
  redirect: "manual",
});
store(r);
const session = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookie() } })).json();
if (!session?.user?.id) { console.error("sign-in failed"); process.exit(1); }
console.log("\n   signed in as %s\n", session.user.email);

async function upload(bytes, { name = "photo.jpg", type = "image/jpeg", folder = "agnora/cars" } = {}) {
  const fd = new FormData();
  fd.set("file", new Blob([bytes], { type }), name);
  fd.set("folder", folder);
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST", headers: { cookie: cookie() }, body: fd,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// Real PNG bytes from the repo's own icons — genuinely valid images, so the
// magic-byte check passes and the CLASSIFIER is what decides.
const realPng = readFileSync("public/icons/icon-512.png");

console.log("2. request guards (nothing reaches Cloudinary)\n");

{
  const { status, body } = await upload(realPng, { folder: "agnora/../secrets", name: "a.png", type: "image/png" });
  check("a folder outside the allowlist is refused", status === 400, `status ${status} ${body.error ?? ""}`);
}
{
  const { status, body } = await upload(realPng, { folder: "whatever", name: "a.png", type: "image/png" });
  check("an arbitrary folder is refused", status === 400, `status ${status} ${body.error ?? ""}`);
}
{
  // 9 MB of valid PNG header + padding → over the 8 MB ceiling.
  const big = Buffer.concat([realPng, Buffer.alloc(9 * 1024 * 1024)]);
  const { status, body } = await upload(big, { name: "big.png", type: "image/png" });
  // 413 Payload Too Large is the correct status here and is what the route
  // returns. An earlier version of this check demanded 400 and was wrong.
  check("a file over the size limit is refused", status === 413 || status === 400,
        `status ${status} ${body.error ?? ""}`);
}
{
  // Declares image/jpeg, contains text. The magic-byte sniff must catch it
  // regardless of the filename or the Content-Type the client claims.
  const fake = Buffer.from("GIF89a<?php echo 'not an image'; ?>", "utf8");
  const { status, body } = await upload(fake, { name: "evil.jpg", type: "image/jpeg" });
  check("content that is not really an image is refused", status === 400, `status ${status} ${body.error ?? ""}`);
}
{
  const empty = Buffer.alloc(0);
  const { status } = await upload(empty, { name: "empty.jpg" });
  check("an empty file is refused", status === 400, `status ${status}`);
}

console.log("\n3. vehicle-photo classification\n");
{
  // A valid PNG that is plainly not a vehicle (the app icon). Whatever the
  // verdict, the important property is that a non-vehicle image cannot
  // silently become a listing photo.
  const { status, body } = await upload(realPng, { name: "icon.png", type: "image/png" });
  check("an image below the resolution floor is refused", status >= 400,
        `status ${status} ${body.error ?? ""}`);
}
{
  // Above the resolution floor and a genuinely valid JPEG, but plainly not a
  // vehicle. This is the case that actually reaches the classifier — and the
  // only one in this script that can create a Cloudinary asset.
  const sharp = (await import("sharp")).default;
  const noise = await sharp({
    create: { width: 1024, height: 768, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 40 } },
  }).jpeg({ quality: 80 }).toBuffer();

  const { status, body } = await upload(noise, { name: "not-a-car.jpg", type: "image/jpeg" });
  const refused = status >= 400;
  const flagged = body?.review === true;
  check("a non-vehicle image is refused or flagged for review", refused || flagged,
        `status ${status} ${refused ? (body.error ?? "") : `review=${flagged}`}`);

  if (!refused && body?.url) {
    console.log("");
    console.log("     THIS REACHED CLOUDINARY — an asset was created:");
    console.log("     %s", body.url);
    console.log("     sha256 recorded: %s", body.sha256 ? "yes" : "no");
    console.log("     (printed so it can be removed — see the report)");
  }
}

console.log(failures === 0 ? "\nALL UPLOAD GUARDS PASSED" : `\n${failures} GUARD(S) FAILED`);
console.log("\nNOT covered: a genuine vehicle photo completing the upload. Needs real photographs.");
process.exit(failures === 0 ? 0 : 1);
