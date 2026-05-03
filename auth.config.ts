import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config — NO Node.js imports (no fs, path, crypto, bcrypt, db).
// Used by middleware which runs on the Edge Runtime.
// Providers that need Node.js go in auth.ts only.
export const authConfig = {
  // Required on Vercel and any reverse-proxy host.
  // Without this, NextAuth v5 rejects OAuth callbacks because the Host header
  // forwarded by the proxy doesn't match the expected origin → redirect loop to /login.
  trustHost: true,

  session: { strategy: "jwt" },
  providers: [],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as { role?: string }).role ?? "buyer";
      }
      return token;
    },
    session({ session, token }) {
      // token.sub is always set by NextAuth; token.id is our custom field set in jwt().
      // Falling back to token.sub ensures Google users always have a valid id even if
      // the jwt callback's user-branch didn't run (e.g. middleware-only token reads).
      session.user.id   = (token.id ?? token.sub) as string;
      session.user.role = (token.role as string | undefined) ?? "buyer";
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },
} satisfies NextAuthConfig;
