import { NextResponse } from "next/server";
import { resolveStaffLoginEmail } from "@/lib/auth/staff-credentials";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const email = resolveStaffLoginEmail(identifier);

  const loginUrl = new URL("/login", request.url);
  if (!email || !password) {
    loginUrl.searchParams.set("staff", "1");
    loginUrl.searchParams.set("error", "Credenciales inválidas");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginUrl.searchParams.set("staff", "1");
    loginUrl.searchParams.set("error", "Credenciales inválidas");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
}
