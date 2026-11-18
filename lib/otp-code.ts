import { z } from "zod";

// Normalisation for the six-digit one-time codes used by email verification
// and password reset.
//
// WHY THIS EXISTS
// The code field was `z.string().length(6)`, which rejects anything carrying
// whitespace. A user who pastes "123456 " or "123456\n" out of their email —
// which is what copying from a mail client normally produces — got a 400
// "Invalid input", and the UI reported it as an expired or invalid code. The
// code was neither: it never reached the lookup.
//
// This is the same defect as the email one: VALIDATE AFTER NORMALISING, never
// before. Same shape, same cause, different field.
//
// POLICY
// Strip every space, tab, newline and hyphen, anywhere in the string, then
// require exactly six digits. Internal separators are stripped on purpose:
// codes are often read aloud or displayed as "123 456", and a human retyping
// one that way is not making a mistake worth refusing them over.
//
// The requirement itself is NOT weakened. After normalisation the value must
// be exactly six characters and every one of them a digit — "12345" is still
// refused, "1234567" is still refused, and "12a456" is still refused.

/** Strips separators a human or mail client may introduce. Never alters digits. */
export function normalizeOtp(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[\s\-‐-― ]/g, "");
}

/** True only for exactly six digits, after normalisation. */
export function isValidOtp(input: string | null | undefined): boolean {
  return /^\d{6}$/.test(normalizeOtp(input));
}

/**
 * The code field schema: normalises first, then enforces exactly six digits.
 *
 * The message is deliberately about format only. It must never hint at
 * whether the code is correct, already used, or expired — that is the
 * lookup's business, and saying more here would leak reset state to anyone
 * who can post to the endpoint.
 */
export function otpSchema(message = "Enter the 6-digit code from your email.") {
  return z
    .string({ required_error: message, invalid_type_error: message })
    .transform(normalizeOtp)
    .pipe(z.string().regex(/^\d{6}$/, message));
}
