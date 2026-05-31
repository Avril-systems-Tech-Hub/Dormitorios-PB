"use server";

import { getGuestSession } from "@/lib/guest-auth/session";

export type GuestPointsSummary = {
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  comingSoon: boolean;
};

/**
 * Placeholder for the future on-chain reward token balance.
 * Replace with contract/indexer lookup when the incentive token is live.
 */
export async function getGuestPointsAction(): Promise<GuestPointsSummary | null> {
  const session = await getGuestSession();
  if (!session) return null;

  return {
    tokenSymbol: "PUNTOS",
    tokenName: "Puntos Plaza Basílica",
    balance: "0",
    comingSoon: true,
  };
}
