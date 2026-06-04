import { redirect } from "next/navigation";
import { getGuestAccountDataAction } from "@/actions/guest-reservations";
import { getGuestPointsAction } from "@/actions/guest-points";
import { GuestAccountView } from "@/components/guest/guest-account-view";

export default async function GuestAccountPage() {
  const account = await getGuestAccountDataAction();

  if (!account) {
    redirect("/login");
  }

  const points = await getGuestPointsAction();

  return <GuestAccountView account={account} points={points} />;
}
