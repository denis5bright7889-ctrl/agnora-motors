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
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
  }
}

// Env-based fallback admin — works without a database
function getEnvAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const hash  = process.env.ADMIN_PASSWORD_HASH;
  const name  = process.env.ADMIN_NAME ?? "Admin";
  if (!email || !hash) return null;
  return { id: "env-admin", email, name, role: "admin", passwordHash: hash };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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

        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // ── 1. Env-based admin fallback (no DB required) ──
        const envAdmin = getEnvAdmin();
        if (envAdmin && email.toLowerCase() === envAdmin.email.toLowerCase()) {
          const valid = await bcrypt.compare(password, envAdmin.passwordHash);
          if (!valid) return null;
          return { id: envAdmin.id, email: envAdmin.email, name: envAdmin.name, role: envAdmin.role };
        }

        // ── 2. File-based local users (no DB required) ────
        const localUser = findLocalUser(email);
        if (localUser) {
          const valid = await bcrypt.compare(password, localUser.passwordHash);
          if (!valid) return null;
          return { id: localUser.id, email: localUser.email, name: localUser.name, role: localUser.role };
        }

        // ── 3. Database users ─────────────────────────────
        if (!isDbConfigured()) return null;

        const user = await getUserWithHash(email);
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id:    user.id,
          email: user.email,
          name:  user.name  ?? undefined,
          image: user.image ?? undefined,
          role:  user.role,
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, account }) {
      if (user) {
        token.id   = user.id;
        token.role = user.role ?? "buyer";
      }

      // Google sign-in: upsert in DB
      if (account?.provider === "google" && token.email && isDbConfigured()) {
        const existing = await getUserByEmail(token.email);
        if (existing) {
          token.id   = existing.id;
          token.role = existing.role;
        } else {
          const created = await createUser({
            email: token.email,
            name:  (token.name  as string | undefined) ?? "Google User",
            image: (token.picture as string | undefined) ?? undefined,
            role:  "buyer",
          });
          token.id   = created.id;
          token.role = "buyer";
        }
      }

      return token;
    },
  },
});
