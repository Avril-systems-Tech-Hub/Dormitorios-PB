import { redirect } from "next/navigation";
import { UnifiedLoginView } from "@/components/auth/unified-login-view";
import { WaaPProvider } from "@/components/guest/waap-provider";
import { getGuestSession } from "@/lib/guest-auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; staff?: string }>;
}) {
  const params = await searchParams;
  const guestSession = await getGuestSession();

  if (guestSession) {
    redirect("/cuenta");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <WaaPProvider>
      <div className="dashboard-brand-header flex min-h-screen items-center justify-center p-4">
        <UnifiedLoginView
          staffError={params.error}
          initialMode={params.staff === "1" ? "staff" : "guest"}
        />
      </div>
    </WaaPProvider>
  );
}
