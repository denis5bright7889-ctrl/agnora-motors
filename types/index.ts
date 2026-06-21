export type Condition = "new" | "used" | "certified" | "foreign_used" | "locally_used";
export type Fuel = "petrol" | "diesel" | "hybrid" | "electric";
export type Transmission = "auto" | "manual";
export type BodyType = "suv" | "sedan" | "hatchback" | "pickup" | "coupe" | "wagon" | "van";
export type DealerStatus = "pending" | "approved" | "rejected";
export type CarStatus = "active" | "sold" | "draft";
export type UserRole = "admin" | "dealer" | "private_seller" | "buyer";
export type PlanId = "free" | "pro" | "premium";
export type Drivetrain = "fwd" | "rwd" | "awd" | "4wd";
export type SellerType = "dealer" | "private" | "login_free";
export type PriceTier  = "great" | "fair" | "above";
export type Upholstery = "cloth" | "leather" | "leatherette" | "alcantara" | "other";

/**
 * Optional buyer-decision specs. JSONB-backed so we can extend without DB
 * migrations. Keep this list intentional — every field here is one a buyer
 * actually uses to compare cars. Indexable filters should be promoted to
 * dedicated columns once we start filtering by them in /cars search.
 */
export interface Specifications {
  // Engine + drivetrain
  horsepower?:        number;   // hp
  torqueNm?:          number;
  engineCC?:          number;   // alt to engine_size_l; preferred unit
  // Efficiency
  fuelEconomyKmL?:    number;   // hide for fuel=electric
  // EV / hybrid
  batteryCapacityKwh?: number;
  batteryRangeKm?:    number;
  chargingTimeHours?: number;
  // Capacity (body-type-dependent)
  seats?:             number;
  payloadKg?:         number;   // pickup
  towingKg?:          number;   // pickup
  // Interior
  upholstery?:        Upholstery;
}

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
  // PR4: advanced filter fields. All optional during the data-migration window.
  drivetrain?: Drivetrain;
  engineSizeL?: number;
  previousOwners?: number;
  exteriorColor?: string;
  interiorColor?: string;
  sellerType?: SellerType;
  // PR6: trust + market price.
  vin?: string;
  vinVerified?: boolean;
  serviceHistoryAvailable?: boolean;
  ownershipVerified?: boolean;
  inspectionAvailable?: boolean;
  marketAvg?: number;            // KSh average of comparable listed cars
  marketSampleCount?: number;    // how many comparables fed the average
  priceTier?: PriceTier;         // "great" | "fair" | "above"
  // Flexible per-listing specs (horsepower, torque, battery, seats…).
  // See Specifications above for the shape.
  specifications?: Specifications;
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

export interface Make {
  id: string;
  slug: string;
  name: string;
}

export interface Model {
  id: string;
  makeId: string;
  slug: string;
  name: string;
}

export interface MakeWithModels extends Make {
  models: Model[];
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
  // PR4: advanced fields (mirrors Car).
  drivetrain?: Drivetrain | null;
  engineSizeL?: number | null;
  previousOwners?: number | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  sellerType?: SellerType | null;
  // PR6: trust flags.
  vin?: string | null;
  vinVerified?: boolean | null;
  serviceHistoryAvailable?: boolean | null;
  ownershipVerified?: boolean | null;
  inspectionAvailable?: boolean | null;
  // Buyer-decision specs, JSONB on the cars table. See Specifications type.
  specifications?: Specifications | null;
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

// ── Content platform types ──────────────────────────────────────────────────

export type NewsStatus = "published" | "pending" | "rejected";
export type ResearchCategory = "review" | "buying-guide" | "comparison" | "maintenance" | "financing";
export type ResearchStatus = "draft" | "published";

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  source: string;
  sourceUrl: string;
  country: string;
  category: string;
  content: string | null;
  summary: string | null;
  image: string | null;
  url: string;
  urlHash: string;
  titleHash: string;
  publishedAt: string;
  tags: string[];
  status: NewsStatus;
  featured: boolean;
  viewCount: number;
  createdAt: string;
}

export interface ResearchArticle {
  id: string;
  title: string;
  slug: string;
  category: ResearchCategory;
  content: string;
  excerpt: string | null;
  author: string;
  seoTitle: string | null;
  seoDescription: string | null;
  featuredImage: string | null;
  tags: string[];
  status: ResearchStatus;
  featured: boolean;
  viewCount: number;
  sponsored: boolean;
  sponsorName: string | null;
  createdAt: string;
  updatedAt: string;
}
