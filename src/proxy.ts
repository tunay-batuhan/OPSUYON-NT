import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

// Optimistic gate + session refresh. Real authorization lives in the data layer (RLS + lib/auth.ts).
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Optimistic gate only: if configuration is missing or Supabase is unreachable, fail open.
  // Real authorization happens in the data layer (requireUser + RLS), so this is safe.
  try {
    return await gate(request, response);
  } catch {
    return response;
  }
}

async function gate(request: NextRequest, initial: NextResponse) {
  let response = initial;

  const supabase = createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const isProtected = /^\/(panel|merkez|projeler|mesajlar|hesap)(\/|$)/.test(pathname);

  if (isProtected && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
