// Image format detection from the leading bytes of a file.
//
// The browser-supplied `file.type` on an upload is attacker-controlled, so it
// is never trusted: the upload route decides what a file really is from its
// magic bytes and passes the detected type to Cloudinary.

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const HEIF_BRANDS = new Set([
  "heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1",
]);

/** Returns the detected image MIME type, or null when the bytes are not a supported image. */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";

  const ascii = (start: number, end: number) => buf.subarray(start, end).toString("latin1");

  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";

  const gif = ascii(0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";

  // ISO-BMFF container (HEIC/HEIF/AVIF): "ftyp" at offset 4, brand at offset 8.
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (HEIF_BRANDS.has(brand)) return "image/heic";
    if (brand === "avif" || brand === "avis") return "image/avif";
  }

  return null;
}
