export type Condition = "new" | "used" | "certified" | "foreign_used" | "locally_used";
export type Fuel = "petrol" | "diesel" | "hybrid" | "electric";
export type Transmission = "auto" | "manual";
export type BodyType = "suv" | "sedan" | "hatchback" | "pickup" | "coupe" | "wagon" | "van";
export type DealerStatus = "pending" | "approved" | "rejected";
export type CarStatus = "active" | "sold" | "draft";
export type UserRole = "admin" | "dealer" | "private_seller" | "buyer";
export type PlanId = "free" | "pro" | "premium";

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
  isFeatured?: boolean;
  boostExpiresAt?: string | null;
  financingAvailable?: boolean;
  hirePurchaseAvailable?: boolean;
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

export interface Dealer {
  id: string;
  userId: string;
  businessName: string;
  businessReg: string;
  kraPin: string;
  directorName: string;
  directorIdUrl: string;
  businessCertUrl: string;
  phone: string;
  location: string;
  status: DealerStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string;
}

export interface DealerCar {
  id: string;
  dealerId: string;
  slug: string;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
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
  isFeatured?: boolean;
  boostExpiresAt?: string | null;
  financingAvailable?: boolean;
  hirePurchaseAvailable?: boolean;
  status: CarStatus;
  createdAt: string;
  updatedAt: string;
  views?: number;
  inquiries?: number;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  role: UserRole;
  createdAt: string;
}

export interface ContactRequest {
  id: string;
  carId: string | null;
  dealerId: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  message: string;
  createdAt: string;
}
