import { NextRequest, NextResponse } from "next/server";

import { getSubdomainFromHost, isPrimaryAppHost } from "@/lib/tenant";
import { stripPort } from "@/lib/site-domains";

const RESERVED_PATHS = [
  "/api",
  "/_next",
  "/signin",
  "/auth",
  "/admin",
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
    const normalizedHost = stripPort(request.headers.get("host"));
    if (!normalizedHost || isPrimaryAppHost(normalizedHost)) {
      return NextResponse.next();
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/public-sites/__host__${pathname}`;
    rewriteUrl.searchParams.set("host", normalizedHost);
    return NextResponse.rewrite(rewriteUrl);
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/public-sites/${subdomain}${pathname}`;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|robots.txt).*)"]
};
