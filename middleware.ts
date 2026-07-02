import { NextResponse, type NextRequest } from "next/server";

// Auth guard is handled entirely by server-side layout.tsx (getUser → redirect "/login").
// Middleware only handles the /demo bypass; everything else passes through.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/demo")) {
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
