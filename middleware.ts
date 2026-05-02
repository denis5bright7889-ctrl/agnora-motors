import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

// Use the Edge-compatible config only — no Node.js modules imported here.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  // ── Admin routes ──────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?next=/admin", req.url));
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // ── Dealer routes ─────────────────────────────────────────
  if (
    pathname.startsWith("/dealer/dashboard") ||
    pathname.startsWith("/dealer/listings")
  ) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?next=" + pathname, req.url));
    }
    if (role !== "dealer" && role !== "admin") {
      return NextResponse.redirect(new URL("/dealer/pending", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dealer/dashboard/:path*", "/dealer/listings/:path*"],
};
