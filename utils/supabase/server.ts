import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase server client — for use in Server Components, Route Handlers, and
 * Server Actions. Reads/writes the auth cookie via next/headers so the
 * session round-trips correctly. Throws if env is missing rather than
 * silently returning null.
 *
 * IMPORTANT: this app's primary database is Neon (see lib/db.ts) and primary
 * auth is Auth.js (see auth.ts). Use this client only for surfaces that
 * explicitly belong to Supabase (Storage, Realtime channels, or tables you've
 * deliberately created in Supabase). Don't reach for it to read cars/users —
 * that's lib/db.ts territory.
 */
export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
    );
  }
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll called from a Server Component (read-only cookies).
          // Safe to ignore when middleware refreshes sessions on every request.
        }
      },
    },
  });
};
