import { StayRegistrationEntry } from "@/components/dashboard/stay-registration-entry";
import { requireRole } from "@/lib/auth/guards";

export default async function RegisterStayPage() {
  const profile = await requireRole(["admin", "reception"]);
  return <StayRegistrationEntry role={profile.role} />;
}

