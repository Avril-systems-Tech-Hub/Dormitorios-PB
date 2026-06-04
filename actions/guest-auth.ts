"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearGuestSessionCookie,
  getGuestSession,
  GuestSessionConfigError,
  setGuestSessionCookie,
} from "@/lib/guest-auth/session";
import {
  normalizeGuestPhone,
  normalizeLoginEmail,
  normalizeWalletAddress,
} from "@/lib/guest-auth/wallet";

export type GuestAuthResult =
  | { ok: true; guestId: string }
  | { ok: true; guestId: ""; step: "reservation-link"; loginEmail: string | null }
  | { ok: false; error: string };

type GuestRow = { id: string; email: string | null; phone: string };

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

async function findGuestByEmail(email: string): Promise<GuestRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, email, phone")
    .ilike("email", email)
    .limit(2);

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error(
      "Hay más de un perfil con este correo. Contacta a recepción para vincular tu cuenta.",
    );
  }

  const guest = data[0];
  const stored = normalizeLoginEmail(guest.email);
  if (!stored || stored !== email) return null;
  return guest;
}

async function getGuestById(guestId: string): Promise<GuestRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guests")
    .select("id, email, phone")
    .eq("id", guestId)
    .maybeSingle();
  return data ?? null;
}

async function assertWalletNotLinkedToOtherGuest(guestId: string, address: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_wallets")
    .select("guest_id")
    .eq("chain", "celo")
    .eq("address", address)
    .maybeSingle();

  if (data && data.guest_id !== guestId) {
    throw new Error("Esta wallet ya está vinculada a otra cuenta.");
  }
}

async function linkWalletToGuest(
  guestId: string,
  address: string,
  loginEmail?: string | null,
) {
  const supabase = createAdminClient();
  const email = normalizeLoginEmail(loginEmail);

  await assertWalletNotLinkedToOtherGuest(guestId, address);

  await supabase
    .from("guest_wallets")
    .delete()
    .eq("guest_id", guestId)
    .neq("address", address);

  const row: {
    guest_id: string;
    chain: "celo";
    address: string;
    is_primary: boolean;
    linked_at: string;
    email?: string;
  } = {
    guest_id: guestId,
    chain: "celo",
    address,
    is_primary: true,
    linked_at: new Date().toISOString(),
  };
  if (email) row.email = email;

  const { error } = await supabase.from("guest_wallets").upsert(row, {
    onConflict: "chain,address",
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function completeGuestSession(guestId: string, address: string, loginEmail?: string | null) {
  await linkWalletToGuest(guestId, address, loginEmail);
  await setGuestSessionCookie({ guestId, walletAddress: address });
  revalidatePath("/cuenta");
  revalidatePath("/login");
}

function emailsMatch(guestEmail: string | null | undefined, loginEmail: string | null) {
  if (!loginEmail) return false;
  return normalizeLoginEmail(guestEmail) === loginEmail;
}

export async function establishGuestSessionAction(
  walletAddress: string,
  loginEmail?: string | null,
): Promise<GuestAuthResult> {
  try {
    const address = normalizeWalletAddress(walletAddress);
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);

    if (normalizedLoginEmail) {
      const guestByEmail = await findGuestByEmail(normalizedLoginEmail);
      if (guestByEmail) {
        await completeGuestSession(guestByEmail.id, address, normalizedLoginEmail);
        return { ok: true, guestId: guestByEmail.id };
      }
    }

    const guestIdByWallet = await findGuestByWallet(address);
    if (guestIdByWallet) {
      const guest = await getGuestById(guestIdByWallet);
      if (guest && emailsMatch(guest.email, normalizedLoginEmail)) {
        await completeGuestSession(guest.id, address, normalizedLoginEmail);
        return { ok: true, guestId: guest.id };
      }
    }

    return {
      ok: true,
      guestId: "",
      step: "reservation-link",
      loginEmail: normalizedLoginEmail,
    };
  } catch (error) {
    if (error instanceof GuestSessionConfigError) {
      console.error("[guest-auth]", error.message);
      return { ok: false, error: "El inicio de sesión no está disponible. Intenta más tarde." };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo iniciar sesión.",
    };
  }
}

/** Link wallet to an existing guest by reservation email + phone (source of truth). */
export async function linkGuestReservationAction(
  walletAddress: string,
  reservationEmail: string,
  phone: string,
  loginEmail?: string | null,
): Promise<GuestAuthResult> {
  try {
    const address = normalizeWalletAddress(walletAddress);
    const normalizedReservationEmail = normalizeLoginEmail(reservationEmail);
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);
    const normalizedPhone = normalizeGuestPhone(phone);

    if (!normalizedReservationEmail) {
      return { ok: false, error: "Ingresa el correo que usaste al reservar." };
    }
    if (normalizedPhone.length !== 10) {
      return {
        ok: false,
        error: "Ingresa un teléfono mexicano de 10 dígitos.",
      };
    }

    const guest = await findGuestByEmail(normalizedReservationEmail);
    if (!guest) {
      return {
        ok: false,
        error: "No encontramos una reserva con ese correo. Revisa el correo o reserva primero.",
      };
    }

    if (normalizeGuestPhone(guest.phone) !== normalizedPhone) {
      return {
        ok: false,
        error: "El teléfono no coincide con el de tu reserva. Usa el mismo que registraste.",
      };
    }

    await completeGuestSession(guest.id, address, normalizedLoginEmail ?? normalizedReservationEmail);
    return { ok: true, guestId: guest.id };
  } catch (error) {
    if (error instanceof GuestSessionConfigError) {
      console.error("[guest-auth]", error.message);
      return { ok: false, error: "El inicio de sesión no está disponible. Intenta más tarde." };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo vincular tu reserva.",
    };
  }
}

/** @deprecated Use linkGuestReservationAction */
export async function linkGuestPhoneAction(
  walletAddress: string,
  phone: string,
  _fullName?: string,
  loginEmail?: string | null,
  reservationEmail?: string | null,
): Promise<GuestAuthResult> {
  const email = reservationEmail ?? loginEmail;
  if (!email) {
    return {
      ok: false,
      error: "Ingresa el correo que usaste al reservar.",
    };
  }
  return linkGuestReservationAction(walletAddress, email, phone, loginEmail);
}

export async function guestLogoutAction() {
  await clearGuestSessionCookie();
  revalidatePath("/cuenta");
  revalidatePath("/login");
}

export async function getGuestSessionAction() {
  return getGuestSession();
}
