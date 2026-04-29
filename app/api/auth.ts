import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { Pool } from "@neondatabase/serverless";
import NeonAdapter from "@auth/neon-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });

  return {
    adapter: NeonAdapter(pool),

    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
  };
});