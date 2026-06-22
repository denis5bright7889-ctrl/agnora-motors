import NextAuth, { type DefaultSession, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  getUserWithHash, createUser, getUserByEmail, markUserEmailVerified, isDbConfigured,
  getUserAuthMethods, linkGoogleAccount, updateLastLogin,
} from "@/lib/db";
import { findLocalUser } from "@/lib/local-users";
import { authConfig } from "./auth.config";
import { normalizeEmail } from "@/lib/email-normalize";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { recordAuthEvent } from "@/lib/auth-audit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      isAdmin: boolean;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
  }
}

function getEnvAdmin() {
  const email    = process.env.ADMIN_EMAIL;
  const name     = process.env.ADMIN_NAME ?? "Admin";
  const password = process.env.ADMIN_PASSWORD;
  const hash     = process.env.ADMIN_PASSWORD_HASH;
  if (!email || (!password && !hash)) return null;
  return { id: "env-admin", email, name, role: "admin", password, passwordHash: hash };
}

// ── Typed CredentialsSignin subclasses ──────────────────────────────────────
// NextAuth v5 lets us subclass CredentialsSignin to give the client a stable
// machine-readable `code` so the login page can render a specific message
// instead of "Invalid email or password" for every failure mode.
// The .code field is what surfaces in the URL/error returned to the client.

class GoogleAccountError extends CredentialsSignin   { code = "use_google"; }
class EmailNotVerifiedError extends CredentialsSignin { code = "email_not_verified"; }
class AccountInactiveError extends CredentialsSignin  { code = "account_inactive"; }
class RateLimitedError extends CredentialsSignin      { code = "rate_limited"; }
class InvalidCredentialsError extends CredentialsSignin { code = "invalid_credentials"; }

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  debug:  process.env.NODE_ENV === "development",

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt:        "select_account",
          access_type:   "offline",
          response_type: "code",
        },
      },
    }),

    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsed.success) {
          throw new InvalidCredentialsError();
        }

        const email    = normalizeEmail(parsed.data.email);
        const password = parsed.data.password;

        // ── Rate limit: 5 attempts / 60s / email ──────────────────────────
        const rl = checkRateLimit(`login:${email}`);
        if (!rl.ok) {
          recordAuthEvent("auth_login_failed", { email, reason: "rate_limited" });
          throw new RateLimitedError();
        }

        // 1. Env-based admin fallback (no DB required).
        const envAdmin = getEnvAdmin();
        if (envAdmin && email === normalizeEmail(envAdmin.email)) {
          let valid = false;
          if (envAdmin.password) {
            const a = Buffer.from(password);
            const b = Buffer.from(envAdmin.password);
            valid = a.length === b.length && timingSafeEqual(a, b);
          } else if (envAdmin.passwordHash) {
            valid = await bcrypt.compare(password, envAdmin.passwordHash);
          }
          if (!valid) {
            recordAuthEvent("auth_login_failed", { email, reason: "invalid_credentials", provider: "env-admin" });
            throw new InvalidCredentialsError();
          }
          resetRateLimit(`login:${email}`);
          recordAuthEvent("auth_login_success", { email, provider: "env-admin" });
          return { id: envAdmin.id, email: envAdmin.email, name: envAdmin.name, role: envAdmin.role };
        }

        // 2. File-based local users (dev fallback when DB is offline).
        const localUser = findLocalUser(email);
        if (localUser) {
          const valid = await bcrypt.compare(password, localUser.passwordHash);
          if (!valid) {
            recordAuthEvent("auth_login_failed", { email, reason: "invalid_credentials", provider: "local" });
            throw new InvalidCredentialsError();
          }
          resetRateLimit(`login:${email}`);
          recordAuthEvent("auth_login_success", { email, provider: "local" });
          return { id: localUser.id, email: localUser.email, name: localUser.name, role: localUser.role };
        }

        // 3. Database users.
        if (!isDbConfigured()) {
          recordAuthEvent("auth_login_failed", { email, reason: "no_db" });
          throw new InvalidCredentialsError();
        }

        try {
          const user = await getUserWithHash(email);

          // Account doesn't exist OR has no password set yet (Google-only).
          // We surface a SPECIFIC reason for the Google-only case so the UI
          // can prompt the user to use Google or set a password — but never
          // distinguish "no such email" from "wrong password" (no enumeration).
          if (!user) {
            recordAuthEvent("auth_login_failed", { email, reason: "no_user" });
            throw new InvalidCredentialsError();
          }
          if (!user.passwordHash) {
            // The account exists but only has Google. This DOES leak that
            // the email is registered. Trade-off the spec explicitly asks for.
            recordAuthEvent("auth_login_failed", { email, reason: "google_only", userId: user.id });
            throw new GoogleAccountError();
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            recordAuthEvent("auth_login_failed", { email, reason: "invalid_credentials", userId: user.id });
            throw new InvalidCredentialsError();
          }

          if (user.isActive === false) {
            recordAuthEvent("auth_login_failed", { email, reason: "inactive", userId: user.id });
            throw new AccountInactiveError();
          }

          if (!user.emailVerified) {
            recordAuthEvent("auth_login_failed", { email, reason: "not_verified", userId: user.id });
            throw new EmailNotVerifiedError();
          }

          // Success — clear the bucket, stamp last_login_at, audit.
          resetRateLimit(`login:${email}`);
          updateLastLogin(user.id).catch(() => {});
          recordAuthEvent("auth_login_success", { email, provider: "credentials", userId: user.id });

          return {
            id:    user.id,
            email: user.email,
            name:  user.name  ?? undefined,
            emailVerified: user.emailVerified ? new Date() : null,
            role:  user.role,
          };
        } catch (err) {
          // Re-throw our typed errors so NextAuth surfaces them to the client
          // with their code. Anything else gets logged + opaque error.
          if (err instanceof CredentialsSignin) throw err;
          console.error("[authorize] db lookup failed for %s:", email, err instanceof Error ? err.message : err);
          throw new InvalidCredentialsError();
        }
      },
    }),
  ],

  callbacks: {
    signIn({ user, account }) {
      console.log("[signIn] provider=%s email=%s id=%s",
        account?.provider ?? "credentials",
        user?.email       ?? "unknown",
        user?.id          ?? "unknown",
      );
      return true;
    },

    async jwt({ token, user, account, profile }) {
      // Branch A: first sign-in — user and account are populated
      if (user) {
        token.id   = user.id;
        token.role = (user as { role?: string }).role ?? "private_seller";
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
      }

      // Branch B: Google first sign-in → upsert + link with existing email account.
      // `account` is only present on the initial OAuth sign-in.
      if (account?.provider === "google" && token.email && isDbConfigured()) {
        const normalizedEmail = normalizeEmail(token.email as string);
        const googleId        = (profile?.sub as string | undefined) ?? (account.providerAccountId as string | undefined) ?? null;
        try {
          const existing = await getUserByEmail(normalizedEmail);

          if (existing) {
            // Existing user — link Google + ensure verified. This is the path
            // that fixes the bug where users registered with email/password
            // first, then later signed in with Google, ended up unable to
            // use either method consistently.
            if (googleId) {
              await linkGoogleAccount(existing.id, googleId);
              recordAuthEvent("auth_link_google", { userId: existing.id, email: normalizedEmail });
            } else {
              // No googleId from the provider — at minimum mark verified.
              await markUserEmailVerified(existing.id);
            }
            token.id   = existing.id;
            token.role = existing.role;
          } else {
            // No user yet — create one with provider='google'.
            const created = await createUser({
              email:    normalizedEmail,
              name:     (token.name    as string | undefined) ?? "Google User",
              image:    (token.picture as string | undefined) ?? undefined,
              role:     "buyer",
              provider: "google",
              googleId: googleId ?? undefined,
            });
            // createUser already sets email_verified=true for provider='google'.
            token.id   = created.id;
            token.role = "buyer";
            recordAuthEvent("auth_register", { userId: created.id, email: normalizedEmail, provider: "google" });
          }
          token.emailVerified = new Date();
          // Stamp last_login_at — non-blocking.
          updateLastLogin(token.id as string).catch(() => {});
          recordAuthEvent("auth_login_success", { email: normalizedEmail, provider: "google" });
        } catch (err) {
          // Never throw — would redirect to /login?error=Callback.
          console.error(
            "[jwt] google upsert FAILED for %s — using Google sub as id. Error: %s",
            normalizedEmail,
            err instanceof Error ? err.message : String(err),
          );
          if (!token.id)   token.id   = token.sub;
          if (!token.role) token.role = "private_seller";
        }
      }

      // Admin email override (covers all providers including Google).
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && normalizeEmail(token.email as string) === normalizeEmail(adminEmail)) {
        token.role          = "admin";
        token.emailVerified = token.emailVerified ?? new Date();
      }

      // Admin tokens are always email-verified.
      if ((token.role as string) === "admin" && !token.emailVerified) {
        token.emailVerified = new Date();
      }

      return token;
    },

    session({ session, token }) {
      session.user.id            = (token.id ?? token.sub) as string;
      session.user.role          = (token.role as string | undefined) ?? "private_seller";
      session.user.isAdmin       = session.user.role === "admin";
      session.user.emailVerified = (token.emailVerified as Date | null) ?? null;
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch { /* malformed url */ }
      return baseUrl;
    },
  },
});
