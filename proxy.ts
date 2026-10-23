import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localeHomePath, preferredLocale } from "@/lib/language";
import { LANG_COOKIE } from "@/lib/site";

// `/` only chooses a locale. Redirect before any HTML is rendered so the
// destination page is the one that loads Google Analytics.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  const locale = preferredLocale({
    cookie: request.cookies.get(LANG_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const destination = new URL(
    localeHomePath(locale, request.nextUrl.search),
    request.url,
  );
  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie, Accept-Language");
  return response;
}

export const config = {
  matcher: "/",
};
