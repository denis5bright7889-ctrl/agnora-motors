export type Condition = "new" | "used" | "certified";
export type Fuel = "petrol" | "diesel" | "hybrid" | "electric";
export type Transmission = "auto" | "manual";
export type BodyType = "suv" | "sedan" | "hatchback" | "pickup" | "coupe" | "wagon" | "van";

export interface Car {
  id: string;
  slug: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage: number;
  fuel: Fuel;
  transmission: Transmission;
  bodyType: BodyType;
  condition: Condition;
  location: string;
  description: string;
  images: string[];
  features: string[];
  verified: boolean;
  dealer: {
    name: string;
    rating: number;
    reviews: number;
    location: string;
    phone: string;
    avatar?: string;
  };
  inspection?: {
    score: number;
    items: { label: string; status: "pass" | "warn" | "fail" }[];
  };
  createdAt: string;
}

export interface Article {
  slug: string;
  title: string;
  category: "Review" | "News" | "Buying Guide" | "Ownership";
  excerpt: string;
  body: string;
  cover: string;
  author: string;
  publishedAt: string;
  readTime: number;
}

export interface Brand {
  name: string;
  slug: string;
  count: number;
  topModel?: string;
}
