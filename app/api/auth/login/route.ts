import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  const loginUrl = new URL("/login", request.url);
  if (error) {
    loginUrl.searchParams.set("staff", "1");
    loginUrl.searchParams.set("error", "Credenciales inválidas");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
