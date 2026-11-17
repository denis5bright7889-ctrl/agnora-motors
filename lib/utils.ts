import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(ksh: number): string {
  return new Intl.NumberFormat("en-KE").format(ksh);
}

export function formatMileage(km: number): string {
  return new Intl.NumberFormat("en-KE").format(km) + " km";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Cloudinary delivery URLs accept inline transformations, so an admin table can
 * request an 80px thumbnail instead of pulling the full-resolution upload.
 * Non-Cloudinary URLs (and anything unexpected) are returned untouched.
 */
export function cloudinaryThumb(url: string | null | undefined, width = 80, height = 60): string | null {
  if (!url) return null;
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || i === -1) return url;
  return `${url.slice(0, i + marker.length)}w_${width},h_${height},c_fill,q_auto,f_auto/${url.slice(i + marker.length)}`;
}

/**
 * Builds an edited derivative of a Cloudinary image using delivery
 * transformations. The original asset is never modified, so a crop or rotate
 * stays reversible and moderation can always see what was really uploaded.
 *
 * Crop is applied before rotation, matching the order a user performs them in.
 * Returns null when the URL is not a Cloudinary asset we can transform.
 */
export function cloudinaryEdit(
  url: string,
  ops: { rotate?: number; crop?: { x: number; y: number; w: number; h: number } },
): string | null {
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || i === -1) return null;

  const chain: string[] = [];
  if (ops.crop) {
    const { x, y, w, h } = ops.crop;
    if (w > 0 && h > 0) {
      chain.push(`x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(w)},h_${Math.round(h)},c_crop`);
    }
  }
  if (ops.rotate) {
    const a = ((Math.round(ops.rotate) % 360) + 360) % 360;
    if (a !== 0) chain.push(`a_${a}`);
  }
  if (chain.length === 0) return url;

  const head = url.slice(0, i + marker.length);
  let tail = url.slice(i + marker.length);
  // Drop any transformation chain a previous edit added, so edits compose from
  // the original rather than stacking crop on crop.
  tail = tail.replace(/^(?:[a-z]{1,3}_[^/]+\/)+/, "");
  return `${head}${chain.join("/")}/${tail}`;
}
