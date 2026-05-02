import { Suspense } from "react";
import { CarsListing } from "@/components/cars-listing";
import { getPublicCars, isDbConfigured } from "@/lib/db";
import type { Car } from "@/types";

export const metadata = {
  title: "Buy Cars in Kenya — Agnora Motors",
  description: "Browse verified cars for sale in Kenya. Filter by make, price, location, and more.",
};

export default async function CarsPage() {
  let cars: Car[] = [];
  if (isDbConfigured()) {
    try {
      cars = await getPublicCars();
    } catch {
      cars = [];
    }
  }

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CarsListing allCars={cars} />
    </Suspense>
  );
}
