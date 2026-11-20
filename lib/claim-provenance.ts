import type { Car, SpecificationsSource } from "@/types";

// Where a claim about a vehicle actually came from.
//
// The problem this solves: the listing page rendered seven flags as identical
// green "… verified" badges. Four of them — VIN, mileage, logbook, ownership
// — are CHECKBOXES THE SELLER TICKS on their own listing form. Nothing
// confirms them. A buyer reading "Logbook verified" reasonably concludes
// Agnora checked the logbook. Nobody did.
//
// Auditing the write paths settled what each signal is worth:
//
//   cars.verified          Not written by ANY code path in lib/db.ts. There
//                          is currently no completed listing-verification
//                          process, so this is reserved for one and must
//                          never be settable by a client.
//   vin_verified           Seller checkbox (dealer form schema).
//   mileage_verified       Seller checkbox.
//   logbook_verified       Seller checkbox.
//   ownership_verified     Seller checkbox.
//   inspection_available   Seller checkbox — an offer, not a finding.
//   service_history_…      Seller checkbox — an offer, not a finding.
//   specifications.source  Already records provenance: "vin_decoder" means
//                          Agnora's decoder produced it, "manual" means the
//                          seller typed it.
//
// Nothing here changes stored data. Historical rows keep exactly the values
// their sellers gave; they are simply described accurately now, which means
// no record is falsely upgraded and none needs migrating.

export type ClaimProvenance =
  /** Established by Agnora through a completed verification process. */
  | "verified"
  /** Produced by Agnora's VIN decoder, not asserted by the seller. */
  | "decoded"
  /** Stated by the seller. Unconfirmed. */
  | "seller";

export interface VehicleClaim {
  key: string;
  /** Buyer-facing text, phrased to match its provenance. */
  label: string;
  provenance: ClaimProvenance;
  /** Longer explanation for a tooltip / the details table. */
  detail: string;
}

export const PROVENANCE_LABEL: Record<ClaimProvenance, string> = {
  verified: "Verified by Agnora",
  decoded:  "Decoded from VIN",
  seller:   "Stated by the seller",
};

/**
 * Only a completed verification process may produce this. `cars.verified` is
 * the single flag that qualifies, and no client-facing write path sets it.
 */
export function isIndependentlyVerified(car: Pick<Car, "verified">): boolean {
  return car.verified === true;
}

/** Specification values Agnora decoded rather than the seller typing them. */
export function isDecodedSpecSource(source: SpecificationsSource | undefined): boolean {
  return source === "vin_decoder";
}

type ClaimInput = Pick<
  Car,
  | "verified" | "vinVerified" | "mileageVerified" | "logbookVerified"
  | "ownershipVerified" | "inspectionAvailable" | "serviceHistoryAvailable"
> & { specifications?: { source?: SpecificationsSource } | null };

/**
 * The claims a listing supports, each tagged with where it came from.
 *
 * Seller claims are phrased as claims ("Seller states …"), never as findings.
 * That is the whole point: the wording, the icon and the colour all have to
 * stop implying Agnora checked something it did not.
 */
export function buildVehicleClaims(car: ClaimInput): VehicleClaim[] {
  const claims: VehicleClaim[] = [];

  if (isIndependentlyVerified(car)) {
    claims.push({
      key: "verified",
      label: "Verified by Agnora",
      provenance: "verified",
      detail: "Agnora completed its verification process for this listing.",
    });
  }

  if (isDecodedSpecSource(car.specifications?.source)) {
    claims.push({
      key: "vin_decoded",
      label: "Specs decoded from VIN",
      provenance: "decoded",
      detail: "These specifications were read from the VIN by Agnora's decoder, not entered by the seller.",
    });
  }

  // Everything below is the seller's own account of the vehicle.
  const sellerClaims: [boolean | undefined, string, string, string][] = [
    [car.vinVerified, "vin", "Seller states VIN matches",
      "The seller says the VIN matches the vehicle and its papers. Agnora has not checked this."],
    [car.mileageVerified, "mileage", "Seller states mileage is genuine",
      "The seller says the odometer reading is genuine. Agnora has not checked this."],
    [car.logbookVerified, "logbook", "Seller states logbook is in order",
      "The seller says the logbook is present and in their name. Agnora has not checked this."],
    [car.ownershipVerified, "ownership", "Seller states they are the owner",
      "The seller says they are the registered owner. Agnora has not checked this."],
    [car.inspectionAvailable, "inspection", "Inspection offered",
      "The seller is willing to allow an independent inspection."],
    [car.serviceHistoryAvailable, "service_history", "Service history offered",
      "The seller says service records are available to view."],
  ];

  for (const [active, key, label, detail] of sellerClaims) {
    if (active) claims.push({ key, label, provenance: "seller", detail });
  }

  return claims;
}

/** Tailwind classes per provenance. Seller claims are deliberately not green. */
export function provenanceClass(p: ClaimProvenance): string {
  switch (p) {
    case "verified":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "decoded":
      return "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "seller":
      // Neutral. A seller's unconfirmed statement must not wear the colour
      // buyers read as "checked".
      return "border-border bg-surface-2 text-muted";
  }
}
