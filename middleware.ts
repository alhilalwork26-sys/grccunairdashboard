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
      // Cookie exists but unreadable — trust it to avoid redirect loops
      return true;
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

  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
