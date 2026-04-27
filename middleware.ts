import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Temporary bypass for initial development: disable auth gating.
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
