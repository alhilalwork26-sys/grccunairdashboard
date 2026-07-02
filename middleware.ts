import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL } from "@/lib/supabase/config";

// Reads the Supabase session directly from the auth cookie without importing
// @supabase/ssr — avoids Node.js globals (__dirname) that crash Edge Runtime.
function isAuthenticated(request: NextRequest): boolean {
  const projectId = SUPABASE_URL
    .replace("https://", "")
    .replace(".supabase.co", "");
  const cookieName = `sb-${projectId}-auth-token`;

  // Supabase may chunk large sessions into .0, .1, etc.
  const raw =
    request.cookies.get(cookieName)?.value ??
    request.cookies.get(`${cookieName}.0`)?.value;

  if (!raw) return false;

  try {
    const session = JSON.parse(decodeURIComponent(raw));
    const expiresAt: number = session?.expires_at ?? 0;
    return expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    try {
      const session = JSON.parse(atob(raw));
      const expiresAt: number = session?.expires_at ?? 0;
      return expiresAt > Math.floor(Date.now() / 1000);
    } catch {
      // Cookie unreadable — treat as unauthenticated to prevent redirect loops
      return false;
    }
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isDashboard = pathname.startsWith("/dashboard");
  const isDemo = pathname.startsWith("/demo");

  if (isDemo) return NextResponse.next();

  const isAuth = isAuthenticated(request);

  if (!isAuth && isDashboard) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Do NOT redirect /login → /dashboard here.
  // If we do, a stale-but-parseable cookie causes a loop:
  // middleware says "authenticated" → /dashboard → server rejects → /login → loop.
  // The server layout handles the post-login redirect via window.location.href.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
