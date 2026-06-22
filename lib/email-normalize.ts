// Single source of truth for email normalization. EVERY read and write
// against users.email goes through this — DB queries, auth flows, register,
// forgot-password — so "User@Email.com", "user@email.com" and
// " USER@EMAIL.COM " all resolve to the same row.
//
// The DB-side CHECK constraint (users_email_lowercase_chk) is the seatbelt:
// even if someone forgets to call this, the database will refuse a non-
// normalized write rather than silently create a duplicate.

export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/** True if `a` and `b` represent the same account email. */
export function emailEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeEmail(a) === normalizeEmail(b) && normalizeEmail(a) !== "";
}
