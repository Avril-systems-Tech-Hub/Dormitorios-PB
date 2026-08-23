import { StayRegistrationEntry } from "@/components/dashboard/stay-registration-entry";
import { requireRole } from "@/lib/auth/guards";
import { getServicePrices } from "@/lib/service-prices";

export default async function RegisterStayPage() {
  const profile = await requireRole(["admin", "reception"]);
  const prices = await getServicePrices();
  return <StayRegistrationEntry role={profile.role} prices={prices} />;
}
