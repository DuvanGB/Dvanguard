import { NextRequest, NextResponse } from "next/server";

import { getSubdomainFromHost } from "@/lib/tenant";

const RESERVED_PATHS = [
  "/api",
  "/_next",
  "/signin",
  "/auth",
  "/dashboard",
  "/onboarding",
  "/sites",
  "/public-sites",
  "/favicon.ico"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (RESERVED_PATHS.some((prefix) => pathname.startsWith(prefix)) || pathname.includes(".")) {
    return NextResponse.next();
  }

  const subdomain = getSubdomainFromHost(request.headers.get("host"));
  if (!subdomain) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/public-sites/${subdomain}${pathname}`;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|robots.txt).*)"]
};
