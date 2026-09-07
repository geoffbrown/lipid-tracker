import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./lib/supabase/config";

/**
 * Refreshes the Supabase session on every request and gates the app behind auth.
 * When Supabase isn't configured (local-store mode) it's a no-op, so the whole
 * UI still runs against localStorage with no account.
 *
 * Uses the Next.js 16 `proxy` convention (the successor to `middleware`).
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");

  /* getUser() may rotate an expiring token, and setAll() writes the new pair
     onto `response`. Returning a bare redirect would throw that away: the
     refresh token has already been spent server-side, so the browser would
     keep sending the old one and get signed out at an arbitrary moment an hour
     in. Every response out of here carries those cookies. */
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isAuthRoute) return redirectTo("/login");
  if (user && path.startsWith("/login")) return redirectTo("/");

  return response;
}

export const config = {
  matcher: [
    // Run on every route EXCEPT Next internals, the icon and manifest routes,
    // and static asset files. `apple-icon` and `manifest.webmanifest` have to
    // be named explicitly: the extension alternation below does not cover an
    // extensionless route, and gating them sends the browser a redirect to
    // /login where it expected an image — which is what makes an installed
    // app or a dock shortcut fall back to a generic letter tile.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
