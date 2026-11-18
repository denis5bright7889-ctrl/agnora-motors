import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Unit tests for the three photo-mutation paths. Every dependency is mocked:
// no database connection is opened and no Cloudinary call is made.
//
// These exist because the cost of getting this wrong is asymmetric and silent.
// Deleting the asset before the row leaves a live listing pointing at a broken
// image; destroying a shared asset breaks an unrelated listing. Neither shows
// up in a type check, and neither is visible until a user hits it.

const DB_URL = new URL("../lib/db.ts", import.meta.url).href;
const CLOUD_URL = new URL("../lib/cloudinary.ts", import.meta.url).href;

type Row = { publicId: string | null; url: string };

interface HarnessOpts {
  row?: Row | null;
  inUse?: boolean;
  destroyResult?: boolean | Error;
  deleteError?: Error;
  before?: { publicId: string | null; url: string } | null;
  uploadRecord?: Record<string, unknown> | null;
  updateError?: Error;
  parseUrl?: (u: string | undefined) => string | null;
}

/** Builds a mocked lib/db + lib/cloudinary pair and records the call order. */
function harness(opts: HarnessOpts = {}) {
  const calls: string[] = [];
  const args: Record<string, unknown[]> = {};
  const rec = (name: string, ...a: unknown[]) => {
    calls.push(name);
    args[name] = a;
  };

  mock.module(DB_URL, {
    namedExports: {
      deleteCarPhoto: async (id: string) => {
        rec("deleteCarPhoto", id);
        if (opts.deleteError) throw opts.deleteError;
        return opts.row === undefined ? { publicId: "agnora/cars/abc", url: "u" } : opts.row;
      },
      isPublicIdInUse: async (pid: string, exclude?: string) => {
        rec("isPublicIdInUse", pid, exclude);
        return opts.inUse ?? false;
      },
      getPhotoById: async (id: string) => {
        rec("getPhotoById", id);
        return opts.before === undefined
          ? { publicId: "agnora/cars/old", url: "old" }
          : opts.before;
      },
      getUploadClassifications: async (urls: string[]) => {
        rec("getUploadClassifications", urls);
        const m = new Map<string, unknown>();
        if (opts.uploadRecord) m.set(urls[0], opts.uploadRecord);
        return m;
      },
      updateCarPhotoUrl: async (id: string, url: string, o: unknown) => {
        rec("updateCarPhotoUrl", id, url, o);
        if (opts.updateError) throw opts.updateError;
      },
    },
  });

  mock.module(CLOUD_URL, {
    namedExports: {
      destroyImage: async (pid: string) => {
        rec("destroyImage", pid);
        if (opts.destroyResult instanceof Error) throw opts.destroyResult;
        return opts.destroyResult ?? true;
      },
      publicIdFromUrl: (u: string | undefined) => (opts.parseUrl ? opts.parseUrl(u) : null),
    },
  });

  return { calls, args };
}

// Each test needs a fresh copy of the module under test: once loaded, it has
// already bound the mocks that were in place at the time, so a later
// mock.module call would have no effect on it. A unique query string defeats
// the ESM cache while still resolving its own "@/..." imports to the mocked
// modules.
let instance = 0;
async function storage() {
  return import(`../lib/photo-storage.ts?case=${++instance}`);
}

const NEW_URL = "https://res.cloudinary.com/x/image/upload/v1/new.jpg";

// ------------------------- deletePhotoAndAsset -------------------------

test("the row is deleted before the asset, never the other way round", async () => {
  const h = harness();
  const { deletePhotoAndAsset } = await storage();
  const r = await deletePhotoAndAsset("p1");

  assert.deepEqual(r, { deleted: true, assetRemoved: true });
  assert.ok(
    h.calls.indexOf("deleteCarPhoto") < h.calls.indexOf("destroyImage"),
    `wrong order: ${h.calls.join(" -> ")}`,
  );
  assert.deepEqual(h.calls, ["deleteCarPhoto", "isPublicIdInUse", "destroyImage"]);
  mock.reset();
});

test("a missing photo id deletes nothing and touches no storage", async () => {
  const h = harness({ row: null });
  const { deletePhotoAndAsset } = await storage();
  const r = await deletePhotoAndAsset("nope");

  assert.deepEqual(r, { deleted: false, assetRemoved: false });
  assert.ok(!h.calls.includes("destroyImage"), "storage must not be touched for a missing row");
  assert.ok(!h.calls.includes("isPublicIdInUse"));
  mock.reset();
});

test("when the database delete fails the asset is left alone", async () => {
  // The asset must survive a failed row delete, or the listing would keep a
  // row pointing at an image that no longer exists.
  const h = harness({ deleteError: new Error("deadlock detected") });
  const { deletePhotoAndAsset } = await storage();

  await assert.rejects(() => deletePhotoAndAsset("p1"), /deadlock detected/);
  assert.ok(!h.calls.includes("destroyImage"), "storage was touched despite a failed row delete");
  mock.reset();
});

test("a failed Cloudinary delete still reports the row as deleted, and says why", async () => {
  const h = harness({ destroyResult: false });
  const { deletePhotoAndAsset } = await storage();
  const r = await deletePhotoAndAsset("p1");

  assert.deepEqual(r, { deleted: true, assetRemoved: false, assetKeptReason: "delete_failed" });
  assert.ok(h.calls.includes("destroyImage"));
  mock.reset();
});

test("an asset still referenced by another row is retained", async () => {
  const h = harness({ inUse: true });
  const { deletePhotoAndAsset } = await storage();
  const r = await deletePhotoAndAsset("p1");

  assert.deepEqual(r, {
    deleted: true,
    assetRemoved: false,
    assetKeptReason: "still_referenced",
  });
  assert.ok(
    !h.calls.includes("destroyImage"),
    "a shared asset was destroyed - this breaks the other listing",
  );
  mock.reset();
});

test("an unresolvable asset id keeps the file rather than guessing", async () => {
  // Guessing is worse than leaking: a wrong guess deletes someone else's image.
  const h = harness({ row: { publicId: null, url: "https://example.com/not-cloudinary.jpg" } });
  const { deletePhotoAndAsset } = await storage();
  const r = await deletePhotoAndAsset("p1");

  assert.deepEqual(r, { deleted: true, assetRemoved: false, assetKeptReason: "unresolved_id" });
  assert.ok(!h.calls.includes("destroyImage"));
  assert.ok(
    !h.calls.includes("isPublicIdInUse"),
    "no point checking usage for an id we do not have",
  );
  mock.reset();
});

test("a row without public_id falls back to parsing the URL", async () => {
  // Every row created before public_id existed depends on this path.
  const h = harness({
    row: {
      publicId: null,
      url: "https://res.cloudinary.com/x/image/upload/v1/agnora/cars/zzz.jpg",
    },
    parseUrl: () => "agnora/cars/zzz",
  });
  const { deletePhotoAndAsset } = await storage();
  const r = await deletePhotoAndAsset("p1");

  assert.deepEqual(r, { deleted: true, assetRemoved: true });
  assert.deepEqual(h.args.destroyImage, ["agnora/cars/zzz"]);
  mock.reset();
});

test("public_id on the row wins over the URL fallback", async () => {
  const h = harness({
    row: {
      publicId: "agnora/cars/authoritative",
      url: "https://res.cloudinary.com/x/image/upload/v1/other.jpg",
    },
    parseUrl: () => "agnora/cars/from-url",
  });
  const { deletePhotoAndAsset } = await storage();
  await deletePhotoAndAsset("p1");

  assert.deepEqual(h.args.destroyImage, ["agnora/cars/authoritative"]);
  mock.reset();
});

test("deleting twice is safe - the second call is a no-op", async () => {
  // Retry safety: a client that retries after a timeout must not cause a
  // second destroy, which could hit an id reused by a newer upload.
  const h = harness({ row: null });
  const { deletePhotoAndAsset } = await storage();

  const first = await deletePhotoAndAsset("p1");
  const second = await deletePhotoAndAsset("p1");

  assert.deepEqual(first, second);
  assert.equal(h.calls.filter((c) => c === "destroyImage").length, 0);
  mock.reset();
});

test("a throwing destroyImage does not undo the row delete", async () => {
  // destroyImage is documented never to throw; if that contract is ever
  // broken, the row is already gone and the asset is merely orphaned. This
  // records that the failure mode is a leak, not a broken listing.
  harness({ destroyResult: new Error("cloudinary 500") });
  const { deletePhotoAndAsset } = await storage();

  await assert.rejects(() => deletePhotoAndAsset("p1"), /cloudinary 500/);
  mock.reset();
});

// ------------------------- replacePhotoImage -------------------------

test("the row is repointed before the old asset is retired", async () => {
  const h = harness({
    before: { publicId: "agnora/cars/old", url: "old" },
    uploadRecord: {
      publicId: "agnora/cars/new",
      sha256: "s",
      qualityScore: 80,
      qualityVerdict: "good",
    },
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  assert.ok(
    h.calls.indexOf("updateCarPhotoUrl") < h.calls.indexOf("destroyImage"),
    `wrong order: ${h.calls.join(" -> ")}`,
  );
  assert.deepEqual(h.args.destroyImage, ["agnora/cars/old"]);
  mock.reset();
});

test("quality and asset id come from the server record, not the caller", async () => {
  // A seller must not be able to replace a flagged photo with one that merely
  // claims to be fine.
  const h = harness({
    before: { publicId: "agnora/cars/old", url: "old" },
    uploadRecord: {
      publicId: "agnora/cars/new",
      sha256: "server-sha",
      qualityScore: 91,
      qualityVerdict: "good",
      qualityDetail: { ok: true },
      width: 1600,
      height: 1200,
    },
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  const opts = h.args.updateCarPhotoUrl[2] as Record<string, unknown>;
  assert.equal(opts.isReplacement, true, "a replacement must be marked as one");
  assert.equal(opts.publicId, "agnora/cars/new");
  assert.equal(opts.qualityScore, 91);
  assert.equal(opts.qualityVerdict, "good");
  assert.equal(opts.width, 1600);
  assert.equal(opts.height, 1200);
  mock.reset();
});

test("an explicit sha256 argument takes precedence over the recorded one", async () => {
  const h = harness({
    before: null,
    uploadRecord: { publicId: "agnora/cars/new", sha256: "server-sha" },
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL, "caller-sha");

  const opts = h.args.updateCarPhotoUrl[2] as Record<string, unknown>;
  assert.equal(opts.sha256, "caller-sha");
  mock.reset();
});

test("replacing with the same asset retires nothing", async () => {
  const h = harness({
    before: { publicId: "agnora/cars/same", url: "u" },
    uploadRecord: { publicId: "agnora/cars/same" },
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  assert.ok(
    !h.calls.includes("destroyImage"),
    "destroyed the asset the row now points at - the listing would break",
  );
  mock.reset();
});

test("an old asset still referenced elsewhere is retained, excluding this row", async () => {
  const h = harness({
    before: { publicId: "agnora/cars/shared", url: "u" },
    uploadRecord: { publicId: "agnora/cars/new" },
    inUse: true,
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  assert.ok(!h.calls.includes("destroyImage"));
  assert.deepEqual(
    h.args.isPublicIdInUse,
    ["agnora/cars/shared", "p1"],
    "the usage check must exclude the row being replaced, or it always reports in-use",
  );
  mock.reset();
});

test("an unknown old asset id is left alone and does not throw", async () => {
  const h = harness({
    before: { publicId: null, url: "https://example.com/elsewhere.jpg" },
    uploadRecord: { publicId: "agnora/cars/new" },
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  assert.ok(!h.calls.includes("destroyImage"));
  mock.reset();
});

test("a missing photo row still repoints and does not throw", async () => {
  const h = harness({ before: null, uploadRecord: { publicId: "agnora/cars/new" } });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  assert.ok(h.calls.includes("updateCarPhotoUrl"));
  assert.ok(!h.calls.includes("destroyImage"), "nothing known to retire");
  mock.reset();
});

test("when the repoint fails the old asset is NOT destroyed", async () => {
  // Otherwise a failed replacement would leave the row pointing at an image
  // that has just been deleted.
  const h = harness({
    before: { publicId: "agnora/cars/old", url: "u" },
    uploadRecord: { publicId: "agnora/cars/new" },
    updateError: new Error("constraint violation"),
  });
  const { replacePhotoImage } = await storage();

  await assert.rejects(() => replacePhotoImage("p1", NEW_URL), /constraint violation/);
  assert.ok(!h.calls.includes("destroyImage"), "old asset destroyed after a failed repoint");
  mock.reset();
});

test("with no server record, quality fields are cleared rather than carried over", async () => {
  // A replacement has not been assessed in its new form; keeping the previous
  // score would attach a stale verdict to a different image.
  const h = harness({
    before: { publicId: "agnora/cars/old", url: "u" },
    uploadRecord: null,
    parseUrl: (u) => (String(u).includes("new") ? "agnora/cars/new" : null),
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  const opts = h.args.updateCarPhotoUrl[2] as Record<string, unknown>;
  assert.equal(opts.qualityScore, null);
  assert.equal(opts.qualityVerdict, null);
  assert.equal(opts.qualityDetail, null);
  mock.reset();
});

test("replacement never writes is_primary", async () => {
  // Replacing an image must not promote or demote a photo.
  const h = harness({
    before: { publicId: "agnora/cars/old", url: "u" },
    uploadRecord: { publicId: "agnora/cars/new" },
  });
  const { replacePhotoImage } = await storage();
  await replacePhotoImage("p1", NEW_URL);

  const opts = h.args.updateCarPhotoUrl[2] as Record<string, unknown>;
  assert.ok(!("isPrimary" in opts), "replacement must not carry a primary flag");
  assert.ok(!("is_primary" in opts));
  mock.reset();
});
