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
