import { auth } from "@/auth";
import { NextResponse } from "next/server";

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
  if (pathname.startsWith("/dealer/dashboard") ||
      pathname.startsWith("/dealer/listings")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?next=" + pathname, req.url));
    }
    if (role !== "dealer" && role !== "admin") {
      // Dealer registered but not yet approved → send to pending page
      return NextResponse.redirect(new URL("/dealer/pending", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dealer/dashboard/:path*", "/dealer/listings/:path*"],
};
