import { NextRequest, NextResponse } from "next/server";

import { getSubdomainFromHost, isPrimaryAppHost } from "@/lib/tenant";
import { detectLocale, LOCALE_COOKIE } from "@/lib/locale";
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
  const hasLocaleCookie = request.cookies.has(LOCALE_COOKIE);

  function withLocale(response: NextResponse) {
    if (!hasLocaleCookie) {
      const locale = detectLocale(request.headers.get("accept-language"));
      response.cookies.set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax"
      });
    }
    return response;
  }

  if (RESERVED_PATHS.some((prefix) => pathname.startsWith(prefix)) || pathname.includes(".")) {
    return withLocale(NextResponse.next());
  }

  const subdomain = getSubdomainFromHost(request.headers.get("host"));
  if (!subdomain) {
    const normalizedHost = stripPort(request.headers.get("host"));
    if (!normalizedHost || isPrimaryAppHost(normalizedHost)) {
      return withLocale(NextResponse.next());
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
