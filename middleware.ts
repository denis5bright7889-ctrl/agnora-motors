import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const isVerified = !!req.auth?.user?.emailVerified;
  const { nextUrl } = req;

  // 1. Protect Dashboard Routes
  const isPrivateDash = nextUrl.pathname.startsWith("/private-dashboard");
  const isDealerDash = nextUrl.pathname.startsWith("/dealer-dashboard");

  if (isPrivateDash || isDealerDash) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", nextUrl));
    
    // 2. Block unverified users (except from verification page)
    if (!isVerified && nextUrl.pathname !== "/verify-email") {
      return NextResponse.redirect(new URL("/verify-email", nextUrl));
    }

    // 3. Enforce Role Access
    if (isPrivateDash && role !== "private_seller" && role !== "admin") {
      return NextResponse.redirect(new URL("/dealer-dashboard", nextUrl));
    }
    if (isDealerDash && role !== "dealer" && role !== "admin") {
      return NextResponse.redirect(new URL("/private-dashboard", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};