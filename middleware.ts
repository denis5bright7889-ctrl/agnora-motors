import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn   = !!req.auth;
  const role         = req.auth?.user?.role;
  const isVerified   = !!req.auth?.user?.emailVerified;
  const { nextUrl }  = req;
  const path         = nextUrl.pathname;

  // ── Protected route groups ────────────────────────────────────
  const isPrivateDash  = path.startsWith("/private-dashboard");
  const isDealerDash   = path.startsWith("/dealer-dashboard") || path.startsWith("/dealer/");
  const isAdminDash    = path.startsWith("/admin");

  // Redirect to login if not authenticated
  if ((isPrivateDash || isDealerDash || isAdminDash) && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (!isLoggedIn) return NextResponse.next();

  // ── Email verification gate ───────────────────────────────────
  // Only enforce for dashboard routes; skip the verify-email page itself
  const needsVerify = isPrivateDash || isDealerDash;
  if (needsVerify && !isVerified && !path.startsWith("/verify-email")) {
    const verifyUrl = new URL("/verify-email", nextUrl);
    if (req.auth?.user?.email) verifyUrl.searchParams.set("email", req.auth.user.email);
    return NextResponse.redirect(verifyUrl);
  }

  // ── Role enforcement ──────────────────────────────────────────
  if (isAdminDash && role !== "admin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (isPrivateDash && role !== "private_seller" && role !== "admin") {
    return NextResponse.redirect(new URL("/dealer-dashboard", nextUrl));
  }

  if (isDealerDash && role === "private_seller") {
    return NextResponse.redirect(new URL("/private-dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
};
