import { getGuestAccountDataAction } from "@/actions/guest-reservations";
import { getGuestPointsAction } from "@/actions/guest-points";
import { GuestAccountView } from "@/components/guest/guest-account-view";
import { GuestLoginPanel } from "@/components/guest/guest-login-panel";

export default async function GuestAccountPage() {
  const account = await getGuestAccountDataAction();

  if (!account) {
    return <GuestLoginPanel />;
  }

  const points = await getGuestPointsAction();

  return <GuestAccountView account={account} points={points} />;
}
