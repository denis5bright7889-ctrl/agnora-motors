import type { Car } from "@/types";
import { listCars, getCarBySlug as getCarBySlugFromStore, getSimilarCars as getSimilarCarsFromStore } from "@/lib/cars-store";

export const cars: Car[] = [];

export function getCarBySlug(slug: string): Car | undefined {
  return getCarBySlugFromStore(slug);
}

export function getSimilarCars(car: Car, limit = 3): Car[] {
  return getSimilarCarsFromStore(car, limit);
}

export function getAllCars(): Car[] {
  return listCars();
}
