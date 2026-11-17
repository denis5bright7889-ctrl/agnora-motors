import test from "node:test";
import assert from "node:assert/strict";
import { sniffImageType } from "../lib/image-type.ts";

/** Pads a header out to at least the 12 bytes the sniffer needs to inspect. */
function withBody(header: number[] | Buffer): Buffer {
  const head = Buffer.isBuffer(header) ? header : Buffer.from(header);
  return Buffer.concat([head, Buffer.alloc(32)]);
}

function isoBmff(brand: string): Buffer {
  return withBody(Buffer.concat([
    Buffer.from([0, 0, 0, 0x20]),
    Buffer.from("ftyp", "latin1"),
    Buffer.from(brand, "latin1"),
  ]));
}

test("detects JPEG", () => {
  assert.equal(sniffImageType(withBody([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
});

test("detects PNG", () => {
  assert.equal(
    sniffImageType(withBody([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
});

test("detects WebP via the RIFF/WEBP pair, not RIFF alone", () => {
  const webp = Buffer.concat([
    Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBP", "latin1"),
  ]);
  assert.equal(sniffImageType(withBody(webp)), "image/webp");

  // A RIFF container that is not WebP (e.g. WAV audio) must be refused.
  const wav = Buffer.concat([
    Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WAVE", "latin1"),
  ]);
  assert.equal(sniffImageType(withBody(wav)), null);
});

test("detects both GIF versions", () => {
  assert.equal(sniffImageType(withBody(Buffer.from("GIF87a", "latin1"))), "image/gif");
  assert.equal(sniffImageType(withBody(Buffer.from("GIF89a", "latin1"))), "image/gif");
});

test("detects HEIC and AVIF brands from the ISO-BMFF header", () => {
  assert.equal(sniffImageType(isoBmff("heic")), "image/heic");
  assert.equal(sniffImageType(isoBmff("mif1")), "image/heic");
  assert.equal(sniffImageType(isoBmff("avif")), "image/avif");
});

test("refuses an MP4 video, which shares the ftyp container", () => {
  assert.equal(sniffImageType(isoBmff("mp42")), null);
  assert.equal(sniffImageType(isoBmff("isom")), null);
});

test("refuses non-image payloads regardless of a spoofed content type", () => {
  assert.equal(sniffImageType(withBody(Buffer.from("not-an-image-at-all", "latin1"))), null);
  // PDF
  assert.equal(sniffImageType(withBody(Buffer.from("%PDF-1.7", "latin1"))), null);
  // Windows executable
  assert.equal(sniffImageType(withBody(Buffer.from("MZ\x90\x00", "latin1"))), null);
  // HTML, the payload that matters if a file is ever served from our origin
  assert.equal(sniffImageType(withBody(Buffer.from("<html><script>", "latin1"))), null);
});

test("refuses a truncated file too short to identify", () => {
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff])), null);
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
});
