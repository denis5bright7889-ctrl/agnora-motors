// Seller type and verification status — two independent axes.
//
// seller_type says what kind of seller someone is. verification_status says how
// far their verification application has progressed. They are deliberately not
// combined: "one-time seller, unverified" and "verified seller, pending" are
// both normal, and a single field could not express either.
//
// Unverified is a statement about paperwork, not about trust. An unverified
// seller lists normally and their listing goes through the same moderation as
// everyone else's — they simply don't get a Verified Seller badge.

export type SellerType = "one_time_seller" | "verified_seller" | "dealer";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

/**
 * Maps the stored seller_verifications.status onto the four-state vocabulary.
 *
 * The database keeps its original values ('pending' | 'approved' | 'rejected')
 * and no row at all for someone who never applied. Translating here avoids
 * rewriting live rows just to rename a state.
 */
export function normalizeVerificationStatus(stored: string | null | undefined): VerificationStatus {
  switch (stored) {
    case "approved": return "verified";
    case "pending":  return "pending";
    case "rejected": return "rejected";
    default:         return "unverified";
  }
}

/** Reverse mapping, for turning a UI filter back into a database value. */
export function toStoredVerificationStatus(v: VerificationStatus): string | null {
  switch (v) {
    case "verified":   return "approved";
    case "pending":    return "pending";
    case "rejected":   return "rejected";
    case "unverified": return null;
  }
}

export const SELLER_TYPE_LABEL: Record<SellerType, string> = {
  one_time_seller: "One-time seller",
  verified_seller: "Verified seller",
  dealer:          "Dealer",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  pending:    "Pending verification",
  verified:   "Verified",
  rejected:   "Verification rejected",
};

/**
 * Only a seller whose application was approved earns the badge. Being a dealer
 * is a different axis — dealer approval has its own badge elsewhere.
 */
export function showsVerifiedBadge(status: VerificationStatus): boolean {
  return status === "verified";
}
