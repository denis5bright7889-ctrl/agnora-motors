import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const role       = req.auth?.user?.role;
  const isVerified = !!req.auth?.user?.emailVerified;
  const { nextUrl } = req;
  const path        = nextUrl.pathname;

  // Forward pathname to server-component layouts via a custom request header.
  // This lets dealer/layout.tsx distinguish /dealer/register (public) from
  // /dealer/dashboard (protected) without needing a usePathname() hook.
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", path);

  const isPrivateDash = path.startsWith("/private-dashboard");
  // /dealer/register is a public sign-up page — anyone can apply.
  // Exclude it from the dealer-dashboard protection group.
  const isDealerDash  =
    path.startsWith("/dealer-dashboard") ||
    (path.startsWith("/dealer/") && !path.startsWith("/dealer/register"));
  const isAdminDash   = path.startsWith("/admin");

  // ── Unauthenticated → login ────────────────────────────────────────────────
  if ((isPrivateDash || isDealerDash || isAdminDash) && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (!isLoggedIn) return NextResponse.next({ request: { headers: reqHeaders } });

  // ── Email verification gate (dashboard routes only) ────────────────────────
  const needsVerify = isPrivateDash || isDealerDash;
  if (needsVerify && !isVerified && !path.startsWith("/verify-email")) {
    const verifyUrl = new URL("/verify-email", nextUrl);
    if (req.auth?.user?.email) verifyUrl.searchParams.set("email", req.auth.user.email);
    return NextResponse.redirect(verifyUrl);
  }

  // ── Role enforcement ───────────────────────────────────────────────────────
  if (isAdminDash && role !== "admin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (isPrivateDash && role !== "private_seller" && role !== "admin") {
    return NextResponse.redirect(new URL("/dealer-dashboard", nextUrl));
  }

  if (isDealerDash && role === "private_seller") {
    return NextResponse.redirect(new URL("/private-dashboard", nextUrl));
  }

  return NextResponse.next({ request: { headers: reqHeaders } });
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
};
