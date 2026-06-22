import type { Car } from "@/types";
import { listCars, getCarBySlug as getCarBySlugFromStore } from "@/lib/cars-store";

// Demo dataset removed. Real inventory comes from the DB (cars table —
// populated by dealers, private sellers, and login-free public posts).
// The helpers below stay so existing consumers (search fallback, detail
// page, /api/cars batch lookup) keep their import surface — they now just
// resolve everything against the runtime store + DB.
export const cars: Car[] = [];

export function getCarBySlug(slug: string): Car | undefined {
  return cars.find((c) => c.slug === slug) ?? getCarBySlugFromStore(slug);
}

export function getSimilarCars(car: Car, limit = 3): Car[] {
  return getAllCars()
    .filter((c) => c.id !== car.id && (c.make === car.make || c.bodyType === car.bodyType))
    .slice(0, limit);
}

export function getAllCars(): Car[] {
  const storeCars = listCars();
  const storeIds = new Set(storeCars.map((c) => c.id));
  return [...storeCars, ...cars.filter((c) => !storeIds.has(c.id))];
}
