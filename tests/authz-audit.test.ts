import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Static authorization audit.
//
// This application has no database-level row security — it is Postgres over a
// plain pool, not Supabase, so there are no RLS policies to lean on. Every
// access rule is therefore enforced in the route handler, and the only thing
// standing between an admin endpoint and the public internet is a check in
// that function. A handler added later without one is a silent, total
// authorization bypass.
//
// Grepping a FILE for a guard is not enough: a route module can export a
// guarded GET next to an unguarded POST. So each exported handler is examined
// on its own.

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...routeFiles(path));
    else if (entry === "route.ts" || entry === "route.tsx") out.push(path);
  }
  return out;
}

interface Handler {
  file: string;
  method: string;
  body: string;
}

/** Splits a route module into its exported HTTP handlers. */
function handlers(file: string): Handler[] {
  const src = readFileSync(file, "utf8");
  const found: Handler[] = [];

  const re = /export\s+(?:async\s+)?function\s+([A-Z]+)\s*\(/g;
  const starts: { method: string; at: number }[] = [];
  for (const m of src.matchAll(re)) {
    if (HTTP_METHODS.includes(m[1])) starts.push({ method: m[1], at: m.index! });
  }

  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : src.length;
    found.push({ file, method: s.method, body: src.slice(s.at, end) });
  });

  return found;
}

/** Any server-side admin assertion: the shared helper or an inline check. */
function hasAdminGuard(body: string): boolean {
  if (/requireAdmin\s*\(/.test(body)) return true;
  // Inline pattern: resolve the session, then reject non-admins.
  const resolvesSession = /await\s+auth\s*\(\s*\)/.test(body);
  const checksRole =
    /role\s*!==\s*["']admin["']/.test(body) || /role\s*===\s*["']admin["']/.test(body);
  return resolvesSession && checksRole;
}

const adminRoutes = routeFiles("app/api/admin");

test("there are admin routes to audit", () => {
  // Guards against the audit silently passing because the glob broke.
  assert.ok(adminRoutes.length >= 10, `found only ${adminRoutes.length} admin routes`);
});

test("every exported handler under /api/admin enforces admin authorization", () => {
  const unguarded: string[] = [];
  let checked = 0;

  for (const file of adminRoutes) {
    for (const h of handlers(file)) {
      checked++;
      if (!hasAdminGuard(h.body)) unguarded.push(`${h.file} ${h.method}`);
    }
  }

  assert.ok(checked >= 12, `expected to audit at least 12 handlers, audited ${checked}`);
  assert.deepEqual(
    unguarded,
    [],
    `these admin handlers have no server-side admin check:\n  ${unguarded.join("\n  ")}`,
  );
});

test("the admin check is not merely advisory — it must reject and return early", () => {
  // A guard that computes a verdict and carries on regardless is no guard.
  //
  // Checked structurally rather than by matching one code shape, because the
  // routes legitimately use three: the shared lib helper returning
  // {ok,status}, a module-local requireAdmin() returning session-or-null, and
  // an inline session role test. All three are fine so long as the handler
  // refuses before doing any work.
  for (const file of adminRoutes) {
    for (const h of handlers(file)) {
      const where = `${h.file} ${h.method}`;

      // 1. It must actually refuse someone.
      assert.match(
        h.body,
        /status:\s*(401|403)|\bauthz\.status\b|\w+\.status\s*\}/,
        `${where}: no 401/403 rejection path`,
      );

      // 2. The guard must come before the handler's first return, i.e. before
      //    it can hand any data back.
      const firstReturn = h.body.indexOf("return");
      const guardAt = Math.min(
        ...[/requireAdmin\s*\(/, /await\s+auth\s*\(\s*\)/]
          .map((re) => {
            const m = re.exec(h.body);
            return m ? m.index : Number.POSITIVE_INFINITY;
          }),
      );
      assert.ok(
        guardAt < firstReturn,
        `${where}: handler can return before the admin check runs`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Seller-facing photo routes: ownership, not admin.
// ---------------------------------------------------------------------------

test("photo mutation routes resolve ownership server-side", () => {
  const owned: [string, RegExp][] = [
    ["app/api/photos/[photoId]/route.ts", /requirePhotoOwner\s*\(/],
    ["app/api/listings/[id]/photos/route.ts", /requireListingOwner\s*\(/],
  ];

  for (const [file, guard] of owned) {
    for (const h of handlers(file)) {
      assert.match(
        h.body,
        guard,
        `${file} ${h.method} must resolve ownership from the database`,
      );
    }
  }
});

test("ownership is never taken from the request body", () => {
  // The whole point of requirePhotoOwner(photoId) is that the car id is
  // derived from the photo. If a handler read a seller or car id out of the
  // payload and trusted it, pairing your own car id with someone else's photo
  // id would cross the boundary.
  for (const file of [
    "app/api/photos/[photoId]/route.ts",
    "app/api/listings/[id]/photos/route.ts",
    "app/api/admin/photos/[photoId]/route.ts",
  ]) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(
      src,
      /body\.(sellerId|seller_user_id|dealerId|dealer_id|userId|ownerId)\b/,
      `${file} reads an ownership field from the request body`,
    );
  }
});

test("the photo delete path always goes through storage cleanup", () => {
  // Calling deleteCarPhoto directly deletes the row and orphans the stored
  // image. Route handlers must use deletePhotoAndAsset, which pairs the two.
  for (const file of [
    "app/api/photos/[photoId]/route.ts",
    "app/api/admin/photos/[photoId]/route.ts",
  ]) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(
      src,
      /\bdeleteCarPhoto\s*\(/,
      `${file} calls deleteCarPhoto directly, which leaves the stored asset orphaned`,
    );
    assert.match(src, /deletePhotoAndAsset\s*\(/, `${file} must use deletePhotoAndAsset`);
  }
});

test("uploads require an authenticated user", () => {
  const src = readFileSync("app/api/upload/route.ts", "utf8");
  assert.match(src, /await\s+auth\s*\(\s*\)/, "upload route must resolve a session");
  assert.match(src, /status:\s*401/, "upload route must reject anonymous callers");
  // The destination folder is attacker-supplied, so it must be whitelisted
  // rather than interpolated into the storage path.
  assert.match(src, /ALLOWED_FOLDERS/, "upload route must whitelist the destination folder");
});
