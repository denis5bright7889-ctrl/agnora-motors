import test from "node:test";
import assert from "node:assert/strict";
import { publicIdFromUrl } from "../lib/cloudinary.ts";

// Recovering the asset id from a delivery URL is the fallback path for photos
// stored before public_id was recorded. Getting it wrong is the dangerous
// case: a mis-parsed id would delete an unrelated listing's image, so these
// tests cover the "return null rather than guess" rule as closely as the
// happy path.

test("extracts the asset id from a plain delivery URL", () => {
  assert.equal(
    publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/v1699999999/agnora/cars/ab12cd.jpg"),
    "agnora/cars/ab12cd",
  );
});

test("extracts the asset id when transformations are present", () => {
  // The transform segments between "upload" and the version vary per request
  // and must not become part of the id.
  assert.equal(
    publicIdFromUrl(
      "https://res.cloudinary.com/demo/image/upload/c_fill,w_320,h_240/q_auto,f_auto/v1699999999/agnora/cars/ab12cd.jpg",
    ),
    "agnora/cars/ab12cd",
  );
});

test("keeps nested folders and drops only the extension", () => {
  assert.equal(
    publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/v1/agnora/cars/2026/09/photo_1.webp"),
    "agnora/cars/2026/09/photo_1",
  );
});

test("returns null for anything that is not a Cloudinary delivery URL", () => {
  for (const url of [
    "https://example.com/image/upload/v1/agnora/cars/ab12cd.jpg", // wrong host
    "https://res.cloudinary.com/demo/image/fetch/http://x/y.jpg",  // no upload segment
    "https://res.cloudinary.com/demo/image/upload/agnora/cars/ab12cd.jpg", // no version anchor
    "not a url at all",
    "",
    null,
    undefined,
  ]) {
    assert.equal(publicIdFromUrl(url), null, `${String(url)} must not yield an id`);
  }
});

test("a URL with nothing after the version yields null, never an empty id", () => {
  // An empty public id passed to destroy() could behave unpredictably, so it
  // must never be produced.
  assert.equal(publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/v1699999999/"), null);
});
