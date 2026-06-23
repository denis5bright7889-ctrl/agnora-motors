export type Condition = "new" | "used" | "certified" | "foreign_used" | "locally_used";
export type Fuel = "petrol" | "diesel" | "hybrid" | "electric";
export type Transmission = "auto" | "manual";
export type BodyType = "suv" | "sedan" | "hatchback" | "pickup" | "coupe" | "wagon" | "van";
export type DealerStatus = "pending" | "approved" | "rejected";
// Public visibility helper only matches "active". Anything else is invisible
// to /cars, /cars/[slug], and /api/cars/search.
//   active   — published, included in public listings
//   sold     — published as sold (still visible to owner; hidden by visibility filter)
//   draft    — owner hasn't published yet
//   hidden   — admin temporarily took it down; owner can re-edit and resubmit
//   rejected — admin rejected (policy violation, fraud); reason shown to owner
//   archived — soft-deleted by admin or owner; reversible but invisible everywhere
export type CarStatus = "active" | "sold" | "draft" | "hidden" | "rejected" | "archived";
export type UserRole = "admin" | "dealer" | "private_seller" | "buyer";
export type PlanId = "free" | "pro" | "premium";
export type Drivetrain = "fwd" | "rwd" | "awd" | "4wd";
export type SellerType = "dealer" | "private" | "login_free";
export type PriceTier  = "great" | "fair" | "above";
export type AccidentHistory = "none" | "minor_repaired" | "major_repaired" | "unknown";
export type Upholstery = "cloth" | "leather" | "leatherette" | "alcantara";
export type SpecificationsSource = "manual" | "vin_decoder" | "dealer_import" | "marketplace_import";

/**
 * Canonical buyer-decision specs. JSONB-backed for the fields that don't
 * have a dedicated column; existing typed columns (drivetrain,
 * exteriorColor, interiorColor, previousOwners) are merged into this shape
 * on read so every consumer sees one consistent object regardless of where
 * a value is physically stored.
 *
 * Names + units are intentional and should NOT drift — server-side
 * normalization in /api/cars enforces them, and the form/SpecsTable read
 * them under these exact keys.
 */
export interface Specifications {
  // Engine
  engineCc?:           number;
  horsepower?:         number;
  torqueNm?:           number;
  drivetrain?:         Drivetrain;

  // Efficiency
  fuelEconomyKmL?:     number;

  // EV / hybrid
  batteryCapacityKwh?: number;
  rangeKm?:            number;   // electric range (was batteryRangeKm)
  chargingTimeHours?:  number;

  // Capacity
  seats?:              number;
  payloadKg?:          number;
  towingCapacityKg?:   number;   // (was towingKg)

  // Appearance — kept as typed cols today but exposed under Specifications
  // so the buyer-facing contract is one type.
  exteriorColor?:      string;
  interiorColor?:      string;
  upholstery?:         Upholstery;

  // Ownership
  previousOwners?:     number;

  // Provenance — set server-side on every write. Lets future imports
  // (VIN decoder, dealer feed) annotate where data came from without
  // changing the read path.
  source?:             SpecificationsSource;
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
  // 2026-06-22: public-facing trust signals. registration_number lives on
  // DealerCar only — never returned by public/search endpoints.
  mileageVerified?:  boolean;
  logbookVerified?:  boolean;
  accidentHistory?:  AccidentHistory;
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
  /**
   * Identifier used to resolve the brand's logo asset.
   * - If it matches a Simple Icons slug (https://simpleicons.org), the logo
   *   loads from their CDN: https://cdn.simpleicons.org/{logoSlug}/{color}
   * - Leave undefined to keep the lettered fallback.
   * - To self-host instead, swap BrandLogo's URL builder to a local
   *   path such as /brand-logos/{logoSlug}.svg.
   */
  logoSlug?: string;
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
  // 2026-06-22: trust fields. registrationNumber is PRIVATE — never returned
  // by any public endpoint. The boolean verifications are public; accident
  // history is public + honest (shown as either "Accident-free" badge or a
  // muted "Repaired" indicator).
  registrationNumber?: string | null;
  mileageVerified?:    boolean | null;
  logbookVerified?:    boolean | null;
  accidentHistory?:    AccidentHistory | null;
  // Buyer-decision specs, JSONB on the cars table. See Specifications type.
  specifications?: Specifications | null;
  status: CarStatus;
  // Moderation trail (admin actions only). moderatedBy holds the admin user id;
  // moderationReason is shown to the owner on rejected listings.
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  moderationReason?: string | null;
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
  // Soft suspension: is_active is the enforcement flag (already used by auth).
  // suspendedAt/Reason explain when and why so support can answer "why am I locked out".
  isActive?: boolean;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
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
