import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";

type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
};

const AUTH_BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

export async function getSessionProfile() {
  if (AUTH_BYPASS) {
    return {
      id: "dev-bypass-user",
      role: "admin" as const,
      full_name: "Dev Bypass",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireRole(allowed: UserRole[]) {
  const profile = await getSessionProfile();
  if (!allowed.includes(profile.role)) {
    redirect("/dashboard");
  }
  return profile;
}
