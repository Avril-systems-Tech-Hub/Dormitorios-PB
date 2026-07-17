import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const startedAt = performance.now();
  const traceId = request.cookies.get("auth-diagnostic-trace")?.value ?? "none";
  let supabaseResponse = NextResponse.next({ request });

  const clientStartedAt = performance.now();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const clientMs = Number((performance.now() - clientStartedAt).toFixed(1));

  const getUserStartedAt = performance.now();
  const { data, error } = await supabase.auth.getUser();
  const getUserMs = Number((performance.now() - getUserStartedAt).toFixed(1));
  const totalMs = Number((performance.now() - startedAt).toFixed(1));
  supabaseResponse.headers.set("x-auth-proxy-ms", String(totalMs));
  supabaseResponse.headers.set(
    "Server-Timing",
    `auth_proxy_get_user;dur=${getUserMs}, auth_proxy_total;dur=${totalMs}`,
  );
  console.info(
    "[auth-diagnostic]",
    JSON.stringify({
      phase: "proxy",
      traceId,
      path: request.nextUrl.pathname,
      userId: data.user?.id.slice(0, 8) ?? null,
      errorCode: error?.code ?? null,
      clientMs,
      getUserMs,
      totalMs,
    }),
  );

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
