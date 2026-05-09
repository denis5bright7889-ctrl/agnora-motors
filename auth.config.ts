import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config — NO Node.js imports (no fs, path, crypto, bcrypt, db).
// Used by both the main auth.ts AND proxy.ts (which runs on Edge Runtime).
// Any provider or callback that needs Node.js must live in auth.ts only.
//
// Required Vercel environment variables for production:
//   AUTH_SECRET=<random 32-byte base64 string>
//   AUTH_URL=https://agnora-motors.com          ← MUST be set for custom domains (NextAuth v5)
//   AUTH_TRUST_HOST=1                           ← tells NextAuth to trust x-forwarded-host
//   GOOGLE_CLIENT_ID=<from Google Console>
//   GOOGLE_CLIENT_SECRET=<from Google Console>
//   ANTHROPIC_API_KEY=<from console.anthropic.com>  ← AI news enhancement
//   AT_USERNAME=<live AT username>              ← change from "sandbox" for real SMS delivery
//
// Google Console → Authorized redirect URIs must include:
//   https://agnora-motors.com/api/auth/callback/google
export const authConfig = {
  // trustHost: true lets NextAuth accept x-forwarded-host / x-forwarded-proto
  // headers set by Vercel's reverse proxy. Without this, NextAuth v5 rejects
  // OAuth callbacks on proxy-fronted deployments → redirect loop to /login.
  trustHost: true,

  session: { strategy: "jwt" },

  providers: [],

  callbacks: {
    // Edge-safe jwt/session callbacks — no DB calls, no Node.js imports.
    // auth.ts overrides these with full versions that add DB upsert + logging.
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as { role?: string }).role ?? "buyer";
      }
      return token;
    },
    session({ session, token }) {
      // token.sub is always set by NextAuth; token.id is our custom field.
      // Fallback to token.sub covers Google users on proxy-only reads.
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
