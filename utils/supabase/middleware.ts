import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase session-refresh helper for Next.js middleware. NOT currently
 * wired into proxy.ts — call this from inside proxy.ts ONLY if/when we
 * actually use Supabase Auth. Today auth lives in Auth.js (see auth.ts),
 * and running both side-by-side without a plan creates two sets of session
 * cookies and a confused "who is signed in?" surface.
 *
 * If you do wire it: this returns a NextResponse with the refreshed Supabase
 * cookie jar attached — you must return THIS response (or merge its
 * cookies) from proxy.ts, not a fresh NextResponse.next().
 */
export const createClient = (request: NextRequest) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  return supabaseResponse;
};
