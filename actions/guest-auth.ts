"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearGuestSessionCookie,
  getGuestSession,
  setGuestSessionCookie,
} from "@/lib/guest-auth/session";
import { normalizeGuestPhone, normalizeWalletAddress } from "@/lib/guest-auth/wallet";

export type GuestAuthResult =
  | { ok: true; guestId: string; needsPhoneLink?: boolean }
  | { ok: false; error: string };

async function findGuestByWallet(address: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_wallets")
    .select("guest_id")
    .eq("chain", "celo")
    .eq("address", address)
    .maybeSingle();

  return data?.guest_id ?? null;
}

async function linkWalletToGuest(guestId: string, address: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("guest_wallets").upsert(
    {
      guest_id: guestId,
      chain: "celo",
      address,
      is_primary: true,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "chain,address" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function establishGuestSessionAction(
  walletAddress: string,
): Promise<GuestAuthResult> {
  try {
    const address = normalizeWalletAddress(walletAddress);
    const existingGuestId = await findGuestByWallet(address);

    if (existingGuestId) {
      await setGuestSessionCookie({ guestId: existingGuestId, walletAddress: address });
      revalidatePath("/cuenta");
      revalidatePath("/login");
      return { ok: true, guestId: existingGuestId };
    }

    return { ok: true, guestId: "", needsPhoneLink: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo iniciar sesión.",
    };
  }
}

export async function linkGuestPhoneAction(
  walletAddress: string,
  phone: string,
  fullName?: string,
): Promise<GuestAuthResult> {
  try {
    const address = normalizeWalletAddress(walletAddress);
    const normalizedPhone = normalizeGuestPhone(phone);

    if (normalizedPhone.length < 10) {
      return { ok: false, error: "Ingresa un teléfono válido de al menos 10 dígitos." };
    }

    const supabase = createAdminClient();
    const { data: existingGuest } = await supabase
      .from("guests")
      .select("id, full_name")
      .eq("normalized_phone", normalizedPhone)
      .maybeSingle();

    let guestId = existingGuest?.id;

    if (!guestId) {
      const displayName = fullName?.trim() || "Huésped";
      const { data: createdGuest, error: createError } = await supabase
        .from("guests")
        .insert({
          full_name: displayName,
          phone,
          normalized_phone: normalizedPhone,
          normalized_name: displayName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase(),
        })
        .select("id")
        .single();

      if (createError || !createdGuest) {
        return { ok: false, error: createError?.message ?? "No se pudo crear el perfil." };
      }

      guestId = createdGuest.id;
    } else if (fullName?.trim()) {
      await supabase
        .from("guests")
        .update({ full_name: fullName.trim() })
        .eq("id", guestId);
    }

    await linkWalletToGuest(guestId, address);
    await setGuestSessionCookie({ guestId, walletAddress: address });
    revalidatePath("/cuenta");
    revalidatePath("/login");

    return { ok: true, guestId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo vincular tu teléfono.",
    };
  }
}

export async function guestLogoutAction() {
  await clearGuestSessionCookie();
  revalidatePath("/cuenta");
  revalidatePath("/login");
}

export async function getGuestSessionAction() {
  return getGuestSession();
}
