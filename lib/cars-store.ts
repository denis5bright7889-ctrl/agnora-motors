import type { Car, BodyType, Condition, Fuel, Transmission } from "@/types";

export type AddCarInput = {
  title: string;
  price: number;
  image: string;
  description?: string;
};

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80";

const inMemoryCars: Car[] = [];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseTitle(title: string): { year: number; make: string; model: string } {
  const clean = title.trim();
  const parts = clean.split(/\s+/);
  const maybeYear = Number(parts[0]);
  const year = Number.isFinite(maybeYear) && maybeYear >= 1900 && maybeYear <= 2100 ? maybeYear : new Date().getFullYear();
  const startIndex = year === maybeYear ? 1 : 0;
  const make = parts[startIndex] || "Unknown";
  const model = parts.slice(startIndex + 1).join(" ") || "Model";
  return { year, make, model };
}

export function listCars(): Car[] {
  return [...inMemoryCars].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getCarBySlug(slug: string): Car | undefined {
  return inMemoryCars.find((car) => car.slug === slug);
}

export function getSimilarCars(car: Car, limit = 3): Car[] {
  return listCars()
    .filter((c) => c.id !== car.id && (c.make === car.make || c.bodyType === car.bodyType))
    .slice(0, limit);
}

export function addCar(input: AddCarInput): Car {
  const now = new Date();
  const { year, make, model } = parseTitle(input.title);
  const baseSlug = slugify(`${year} ${make} ${model}`);
  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  const car: Car = {
    id: `${now.getTime()}-${uniqueSuffix}`,
    slug: `${baseSlug}-${uniqueSuffix}`,
    year,
    make,
    model,
    price: input.price,
    mileage: 0,
    fuel: "petrol" as Fuel,
    transmission: "auto" as Transmission,
    bodyType: "sedan" as BodyType,
    condition: "used" as Condition,
    location: "Unspecified",
    description: input.description?.trim() || "No description provided.",
    images: [input.image || DEFAULT_IMAGE],
    features: [],
    verified: false,
    dealer: {
      name: "Private Seller",
      rating: 0,
      reviews: 0,
      location: "Unspecified",
      phone: "N/A",
    },
    createdAt: now.toISOString(),
  };

  inMemoryCars.unshift(car);
  return car;
}
