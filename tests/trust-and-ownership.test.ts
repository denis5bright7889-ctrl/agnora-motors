import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildVehicleClaims, isIndependentlyVerified, isDecodedSpecSource,
  provenanceClass, PROVENANCE_LABEL,
} from "../lib/claim-provenance.ts";

// Regression tests for three findings raised in the pre-commit audit:
//   A  seller-ticked checkboxes rendered as independent verification
//   B  images attachable to a listing by someone who did not upload them
//   C  email addresses written to authentication logs

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ── A. verification badges ────────────────────────────────────────────────

const SELLER_TICKED_EVERYTHING = {
  verified: false,
  vinVerified: true,
  mileageVerified: true,
  logbookVerified: true,
  ownershipVerified: true,
  inspectionAvailable: true,
  serviceHistoryAvailable: true,
  specifications: { source: "manual" as const },
};

test("a seller ticking every box produces NO independently-verified claim", () => {
  // This is the finding, stated as a test: self-assertion must not become
  // verification no matter how many boxes are ticked.
  const claims = buildVehicleClaims(SELLER_TICKED_EVERYTHING);
  assert.ok(claims.length > 0, "the claims should still be shown, just honestly");
  assert.equal(
    claims.filter((c) => c.provenance === "verified").length, 0,
    "a ticked checkbox produced an 'independently verified' claim",
  );
  assert.equal(
    claims.every((c) => c.provenance === "seller"), true,
    "every claim here comes from the seller and must say so",
  );
});

test("seller claims are worded as claims, never as findings", () => {
  const claims = buildVehicleClaims(SELLER_TICKED_EVERYTHING);
  for (const c of claims.filter((x) => x.provenance === "seller")) {
    assert.ok(
      !/\bverified\b/i.test(c.label),
      `"${c.label}" reads as a verification but is only the seller's statement`,
    );
    assert.match(c.detail, /seller|independent|not been checked|Agnora has not/i);
  }
  // And the specific wording that caused the complaint is gone.
  const labels = claims.map((c) => c.label);
  for (const banned of ["VIN verified", "Mileage verified", "Logbook verified", "Ownership OK"]) {
    assert.ok(!labels.includes(banned), `"${banned}" is back`);
  }
});

test("only a completed verification process yields the verified provenance", () => {
  assert.equal(isIndependentlyVerified({ verified: true }), true);
  assert.equal(isIndependentlyVerified({ verified: false }), false);
  assert.equal(isIndependentlyVerified({ verified: undefined as unknown as boolean }), false);

  const verified = buildVehicleClaims({ ...SELLER_TICKED_EVERYTHING, verified: true });
  const v = verified.filter((c) => c.provenance === "verified");
  assert.equal(v.length, 1);
  assert.equal(v[0].label, "Verified by Agnora");
});

test("VIN-decoded specifications are their own tier, distinct from both", () => {
  assert.equal(isDecodedSpecSource("vin_decoder"), true);
  assert.equal(isDecodedSpecSource("manual"), false);
  assert.equal(isDecodedSpecSource(undefined), false);

  const decoded = buildVehicleClaims({
    ...SELLER_TICKED_EVERYTHING,
    specifications: { source: "vin_decoder" },
  });
  const d = decoded.filter((c) => c.provenance === "decoded");
  assert.equal(d.length, 1, "a VIN-decoded spec set should be surfaced as decoded");
  assert.ok(!/seller/i.test(d[0].label));
});

test("seller claims do not wear the colour buyers read as 'checked'", () => {
  const green = provenanceClass("verified");
  assert.match(green, /emerald/);
  assert.ok(!/emerald/.test(provenanceClass("seller")), "a seller claim is styled as verified");
  assert.notEqual(provenanceClass("seller"), provenanceClass("decoded"));
  assert.equal(Object.keys(PROVENANCE_LABEL).length, 3);
});

test("historical records are described accurately, not upgraded", () => {
  // Existing rows keep their stored values; nothing is migrated and nothing
  // is promoted. A legacy row with every seller flag set still yields zero
  // verified claims (asserted above) and its data is untouched here.
  const before = JSON.parse(JSON.stringify(SELLER_TICKED_EVERYTHING));
  buildVehicleClaims(SELLER_TICKED_EVERYTHING);
  assert.deepEqual(SELLER_TICKED_EVERYTHING, before, "claim building mutated the record");
});

test("the listing page renders claims through the provenance helper", () => {
  const src = code("app/cars/[slug]/car-detail-client.tsx");
  assert.match(src, /buildVehicleClaims\(car\)/, "the page must build claims with provenance");
  assert.match(src, /provenanceClass\(provenance\)/, "styling must follow provenance");
  assert.ok(
    !/label: "VIN verified"/.test(src) && !/label: "Mileage verified"/.test(src),
    "the old undifferentiated badge list is back",
  );
});

test("`verified` is never accepted from a client request body", () => {
  // It is the one flag reserved for a completed verification process.
  for (const path of ["app/api/cars/route.ts", "app/api/dealer/listings/route.ts"]) {
    const src = code(path);
    assert.ok(
      !/\bverified:\s*z\.boolean\(\)/.test(src),
      `${path} accepts 'verified' from the request body`,
    );
  }
  const dealer = code("app/api/dealer/listings/route.ts");
  assert.match(dealer, /verified:\s*false/, "the dealer path must pin verified to false");
});

// ── B. image ownership ────────────────────────────────────────────────────

test("both listing paths check image ownership before creating", () => {
  const cases: [string, string][] = [
    ["app/api/cars/route.ts", "createPublicCar"],
    ["app/api/dealer/listings/route.ts", "createDealerCar"],
  ];
  for (const [path, createFn] of cases) {
    const src = code(path);
    assert.match(src, /assertImagesOwnedBy\(session\.user\.id/, `${path} must check ownership`);
    assert.ok(
      src.indexOf("assertImagesOwnedBy") < src.indexOf(`${createFn}(`),
      `${path} must check ownership BEFORE inserting`,
    );
  }
});

test("the ownership query refuses only images owned by someone else", () => {
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function assertImagesOwnedBy"));
  const body = fn.slice(0, fn.indexOf("\n}"));

  assert.match(body, /user_id IS NOT NULL/, "an unrecorded uploader must not be treated as a thief");
  assert.match(body, /user_id <> \$2/, "it must compare against the submitting user");
  assert.match(body, /throw new ListingQualityError/, "a foreign image must refuse the publish");
  // It must REFUSE, not quietly drop the offending images and carry on —
  // silently publishing a listing with fewer photos than the seller chose
  // would be its own bug. A void return proves nothing is handed back to be
  // substituted for the original list.
  assert.match(
    fn.slice(0, fn.indexOf("{")),
    /Promise<void>/,
    "the guard must refuse rather than return a filtered list",
  );
});

test("ownership is enforced server-side, not by trusting the URL", () => {
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function assertImagesOwnedBy"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /FROM upload_classifications/, "it must consult the server's own upload record");
});

// ── C. authentication logging ─────────────────────────────────────────────

test("no email address is written to an authentication log", () => {
  const src = code("auth.ts");
  const CONSOLE = /console\.(?:log|warn|error|info|debug)\s*\(([^;]*?)\)\s*;/gis;
  const STRING = /(["'`])(?:\\.|(?!\1)[^\\])*\1/g;

  for (const m of src.matchAll(CONSOLE)) {
    const args = m[1].replace(STRING, "");
    // The bare identifiers `email` / `normalizedEmail` carry the address.
    // emailTag(...) wraps them and is what should appear instead.
    const bare = args.replace(/emailTag\([^)]*\)/g, "");
    assert.ok(
      !/\b(email|normalizedEmail)\b/.test(bare),
      `auth.ts logs an address: ${m[0].replace(/\s+/g, " ").slice(0, 110)}`,
    );
  }
});

test("the log tag is stable but not the address", async () => {
  const { createHash } = await import("node:crypto");
  const tag = (e: string) =>
    "u#" + createHash("sha256").update(e.trim().toLowerCase()).digest("hex").slice(0, 10);

  assert.equal(tag("Person@Example.com"), tag("  person@example.com  "),
    "the same account must produce the same tag, or logs cannot be correlated");
  assert.notEqual(tag("a@example.com"), tag("b@example.com"));
  assert.ok(!tag("person@example.com").includes("person"));
  assert.ok(!tag("person@example.com").includes("@"));
});

test("diagnostics survive the redaction", () => {
  // Removing the address must not remove the ability to debug a sign-in.
  const src = code("auth.ts");
  assert.match(src, /\[signIn\] provider=%s/, "the provider must still be logged");
  assert.match(src, /emailTag\(/, "a correlatable tag must replace the address");
  assert.match(src, /err instanceof Error \? err\.message/, "error detail must still be logged");
});

test("the sidebar no longer claims verification unconditionally", () => {
  // It rendered a hardcoded "Verified dealer & listing" bullet on EVERY
  // listing — a verification claim with nothing at all behind it.
  const src = code("app/cars/[slug]/car-detail-client.tsx");
  assert.ok(
    !/text: "Verified dealer & listing"/.test(src),
    "the unconditional verification bullet is back",
  );
  assert.match(src, /isIndependentlyVerified\(car!\)/,
    "the verified bullet must be gated on a completed verification");
});
