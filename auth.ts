import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUserWithHash, createUser, getUserByEmail, isDbConfigured } from "@/lib/db";
import { findLocalUser } from "@/lib/local-users";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
  }
}

function getEnvAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const hash  = process.env.ADMIN_PASSWORD_HASH;
  const name  = process.env.ADMIN_NAME ?? "Admin";
  if (!email || !hash) return null;
  return { id: "env-admin", email, name, role: "admin", passwordHash: hash };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // AUTH_SECRET is the v5 canonical name; NEXTAUTH_SECRET kept for fallback.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          // Force account chooser every time and request offline access so
          // NextAuth always receives a fresh refresh token on each sign-in.
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
          console.log("[authorize] validation failed:", parsed.error.flatten().fieldErrors);
          return null;
        }

        const { email, password } = parsed.data;

        // 1. Env-based admin fallback (no DB required)
        const envAdmin = getEnvAdmin();
        if (envAdmin && email.toLowerCase() === envAdmin.email.toLowerCase()) {
          const valid = await bcrypt.compare(password, envAdmin.passwordHash);
          console.log("[authorize] env-admin email=%s valid=%s", email, valid);
          if (!valid) return null;
          return { id: envAdmin.id, email: envAdmin.email, name: envAdmin.name, role: envAdmin.role };
        }

        // 2. File-based local users (no DB required)
        const localUser = findLocalUser(email);
        if (localUser) {
          const valid = await bcrypt.compare(password, localUser.passwordHash);
          console.log("[authorize] local-user email=%s valid=%s", email, valid);
          if (!valid) return null;
          return { id: localUser.id, email: localUser.email, name: localUser.name, role: localUser.role };
        }

        // 3. Database users
        if (!isDbConfigured()) {
          console.log("[authorize] no DB configured and no local user found for %s", email);
          return null;
        }

        try {
          const user = await getUserWithHash(email);
          if (!user?.passwordHash) {
            console.log("[authorize] db: no user or no password hash for %s", email);
            return null;
          }
          const valid = await bcrypt.compare(password, user.passwordHash);
          console.log("[authorize] db email=%s valid=%s", email, valid);
          if (!valid) return null;

          if (!user.emailVerified) {
            console.log("[authorize] db: email not verified for %s", email);
            return null;
          }

          return {
            id:    user.id,
            email: user.email,
            name:  user.name  ?? undefined,
            emailVerified: user.emailVerified ? new Date() : null,
            role:  user.role,
          };
        } catch (err) {
          console.error("[authorize] db lookup failed for %s:", email, err instanceof Error ? err.message : err);
          return null;
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

    async jwt({ token, user, account }) {
      // Branch A: first sign-in — user and account are populated
      if (user) {
        console.log("[jwt] fresh sign-in provider=%s id=%s email=%s role=%s",
          account?.provider ?? "credentials",
          user.id, user.email,
          (user as { role?: string }).role ?? "buyer",
        );
        token.id   = user.id;
        token.role = (user as { role?: string }).role ?? "private_seller";
        token.emailVerified = (user as any).emailVerified ?? null;
      }

      // Branch B: Google first sign-in → upsert user into our DB
      // `account` is only present on the initial OAuth sign-in, not on refresh calls.
      if (account?.provider === "google" && token.email && isDbConfigured()) {
        try {
          console.log("[jwt] google upsert start for %s", token.email);
          const existing = await getUserByEmail(token.email as string);

          if (existing) {
            token.id   = existing.id;
            token.role = existing.role;
            console.log("[jwt] google found existing user id=%s role=%s", existing.id, existing.role);
          } else {
            const created = await createUser({
              email: token.email as string,
              name:  (token.name    as string | undefined) ?? "Google User",
              image: (token.picture as string | undefined) ?? undefined,
              role:  "buyer",
            });
            token.id   = created.id;
            token.role = "buyer";
            console.log("[jwt] google created new user id=%s", created.id);
          }
        } catch (err) {
          // Never throw here — a thrown jwt callback causes NextAuth to redirect
          // to /login?error=Callback, which looks like a login loop.
          // Fall through gracefully: the user stays signed in with their Google
          // sub as the id. DB sync can be retried on the next request.
          console.error(
            "[jwt] google upsert FAILED for %s — using Google sub as id. Error: %s",
            token.email,
            err instanceof Error ? err.message : String(err),
          );
          if (!token.id)   token.id   = token.sub;
          if (!token.role) token.role = "private_seller";
        }
      }

      return token;
    },

    session({ session, token }) {
      session.user.id   = (token.id ?? token.sub) as string;
      session.user.role = (token.role as string | undefined) ?? "private_seller";
      session.user.emailVerified = (token.emailVerified as Date | null) ?? null;

      console.log("[session] built id=%s role=%s email=%s",
        session.user.id, session.user.role, session.user.email,
      );
      return session;
    },

    // Explicit redirect callback with logging to diagnose redirect-loop issues.
    async redirect({ url, baseUrl }) {
      console.log("[redirect] url=%s baseUrl=%s", url, baseUrl);
      // Allow relative URLs (e.g. "/", "/cars")
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same-origin absolute URLs
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        // malformed url — fall through to baseUrl
      }
      return baseUrl;
    },
  },
});
