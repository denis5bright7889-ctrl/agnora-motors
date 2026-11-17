import type { CarStatus } from "@/types";

function cn(...cls: (string | boolean | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

const PILL = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize";

const STATUS_TONE: Record<string, string> = {
  active:   "bg-green-500/15 text-green-600 dark:text-green-400",
  draft:    "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  pending:  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  sold:     "bg-surface-2 text-muted",
  hidden:   "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
  archived: "bg-zinc-500/15 text-zinc-500",
};

export function StatusBadge({ status }: { status: CarStatus | string }) {
  return <span className={cn(PILL, STATUS_TONE[status] ?? STATUS_TONE.active)}>{status}</span>;
}

// Mirrors cars.seller_type. 'login_free' is the legacy value for listings
// created before posting required an account — those rows have no owning user,
// which is why they are labelled distinctly rather than shown as "private".
const SELLER_TYPE_LABEL: Record<string, string> = {
  dealer:     "Dealer",
  private:    "Private seller",
  login_free: "Legacy · no account",
};

const SELLER_TYPE_TONE: Record<string, string> = {
  dealer:     "bg-blue-500/15 text-blue-500",
  private:    "bg-violet-500/15 text-violet-500",
  login_free: "bg-surface-2 text-muted",
};

export function SellerTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className={cn(PILL, "bg-surface-2 text-muted")}>Unknown</span>;
  return (
    <span className={cn(PILL, "normal-case", SELLER_TYPE_TONE[type] ?? "bg-surface-2 text-muted")}>
      {SELLER_TYPE_LABEL[type] ?? type}
    </span>
  );
}

// seller_verifications.status. null means the seller never applied — shown as
// "Unverified", which is a statement about the application, not about trust.
const VERIFICATION_LABEL: Record<string, string> = {
  pending:  "Verification pending",
  approved: "Verified",
  rejected: "Verification rejected",
};

const VERIFICATION_TONE: Record<string, string> = {
  pending:  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-green-500/15 text-green-600 dark:text-green-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function VerificationBadge({ status }: { status: string | null }) {
  if (!status) return <span className={cn(PILL, "normal-case bg-surface-2 text-muted")}>Unverified</span>;
  return (
    <span className={cn(PILL, "normal-case", VERIFICATION_TONE[status] ?? "bg-surface-2 text-muted")}>
      {VERIFICATION_LABEL[status] ?? status}
    </span>
  );
}
