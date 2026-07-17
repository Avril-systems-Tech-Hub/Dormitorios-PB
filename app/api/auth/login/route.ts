import { NextResponse } from "next/server";
import { durationMs, logAuthDiagnostic } from "@/lib/auth/diagnostics";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  const formData = await request.formData();
  const formMs = durationMs(startedAt);
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const clientStartedAt = performance.now();
  const supabase = await createClient();
  const clientMs = durationMs(clientStartedAt);
  const signInStartedAt = performance.now();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const signInMs = durationMs(signInStartedAt);

  const loginUrl = new URL("/login", request.url);
  let response: NextResponse;
  if (error) {
    loginUrl.searchParams.set("staff", "1");
    loginUrl.searchParams.set("error", "Credenciales inválidas");
    response = NextResponse.redirect(loginUrl, { status: 303 });
  } else {
    response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  }

  const totalMs = durationMs(startedAt);
  response.cookies.set("auth-diagnostic-trace", traceId, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("x-auth-trace", traceId);
  response.headers.set(
    "Server-Timing",
    [
      `auth_form;dur=${formMs}`,
      `auth_client;dur=${clientMs}`,
      `auth_signin;dur=${signInMs}`,
      `auth_login_total;dur=${totalMs}`,
    ].join(", "),
  );
  logAuthDiagnostic("login", {
    traceId,
    ok: !error,
    userId: data.user?.id.slice(0, 8) ?? null,
    errorCode: error?.code ?? null,
    formMs,
    clientMs,
    signInMs,
    totalMs,
  });

  return response;
}
