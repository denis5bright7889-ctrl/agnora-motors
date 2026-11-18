import { z } from "zod";

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

/**
 * The email field schema: normalises FIRST, then checks the format.
 *
 * Order is the whole point. `z.string().email()` rejects any leading or
 * trailing whitespace, so validating before normalising made a correct,
 * already-registered address fail as a format error. Pasting an address from
 * a password manager, a note or a mail client very often carries a trailing
 * space or newline, which is why it looked intermittent.
 *
 * The consequences were visible in three places, all the same bug:
 *   - registration refused " user@email.com " as "Enter a valid email
 *     address", so the duplicate-account check was never reached and the user
 *     was told their real address was invalid;
 *   - sign-in turned a padded address into "invalid email or password";
 *   - resend-verification answered 400, so a user could not get a new code.
 *
 * Every email field — client form and server route alike — must use this
 * instead of z.string().email(), so the two can never disagree about what a
 * valid address is.
 */
export function emailSchema(message = "Please enter a valid email address.") {
  return z
    .string({ required_error: message, invalid_type_error: message })
    .transform(normalizeEmail)
    .pipe(z.string().min(1, message).email(message));
}
