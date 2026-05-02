import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config — NO Node.js imports (no fs, path, crypto, bcrypt, db).
// Used by middleware which runs on the Edge Runtime.
// Providers that need Node.js go in auth.ts only.
export const authConfig = {
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "buyer";
      }
      return token;
    },
    session({ session, token }) {
      session.user.id   = token.id   as string;
      session.user.role = (token.role as string | undefined) ?? "buyer";
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
} satisfies NextAuthConfig;
