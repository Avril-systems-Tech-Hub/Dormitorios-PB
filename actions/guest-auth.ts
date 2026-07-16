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

type GuestRow = { id: string; email: string | null; phone: string | null; updated_at: string };

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

/** Pick one guest when several reservation profiles share the same email. */
async function resolveGuestByEmail(
  email: string,
  walletAddress?: string | null,
): Promise<GuestRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, email, phone, updated_at")
    .ilike("email", email);

  if (error) {
    throw new Error(error.message);
  }

  const matches = (data ?? []).filter((guest) => normalizeLoginEmail(guest.email) === email);
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  if (walletAddress) {
    const linkedGuestId = await findGuestByWallet(walletAddress);
    if (linkedGuestId) {
      const linked = matches.find((guest) => guest.id === linkedGuestId);
      if (linked) return linked;
    }
  }

  return matches.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];
}

async function unlinkWalletFromOtherGuests(guestId: string, address: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_wallets")
    .select("guest_id")
    .eq("chain", "celo")
    .eq("address", address)
    .maybeSingle();

  if (data && data.guest_id !== guestId) {
    const { error } = await supabase
      .from("guest_wallets")
      .delete()
      .eq("chain", "celo")
      .eq("address", address);
    if (error) {
      throw new Error(error.message);
    }
  }
}

async function linkWalletToGuest(
  guestId: string,
  address: string,
  loginEmail?: string | null,
) {
  const supabase = createAdminClient();
  const email = normalizeLoginEmail(loginEmail);

  await unlinkWalletFromOtherGuests(guestId, address);

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

async function completeGuestSession(
  guestId: string,
  address: string,
  loginEmail?: string | null,
) {
  await linkWalletToGuest(guestId, address, loginEmail);
  await setGuestSessionCookie({ guestId, walletAddress: address });
  revalidatePath("/cuenta");
  revalidatePath("/login");
}

export async function establishGuestSessionAction(
  walletAddress: string,
  loginEmail?: string | null,
): Promise<GuestAuthResult> {
  try {
    const address = normalizeWalletAddress(walletAddress);
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);

    const guestIdByWallet = await findGuestByWallet(address);
    if (guestIdByWallet) {
      await completeGuestSession(guestIdByWallet, address, normalizedLoginEmail);
      return { ok: true, guestId: guestIdByWallet };
    }

    if (normalizedLoginEmail) {
      const guestByEmail = await resolveGuestByEmail(normalizedLoginEmail, address);
      if (guestByEmail) {
        await completeGuestSession(guestByEmail.id, address, normalizedLoginEmail);
        return { ok: true, guestId: guestByEmail.id };
      }
    }

    if (!normalizedLoginEmail) {
      return {
        ok: false,
        error:
          "Entra con correo o Google. Si ya reservaste, usa el mismo correo que pusiste en la reserva.",
      };
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

/** Confirm reservation email when Human login email differs from the one on file. */
export async function linkGuestReservationAction(
  walletAddress: string,
  reservationEmail: string,
  loginEmail?: string | null,
): Promise<GuestAuthResult> {
  try {
    const address = normalizeWalletAddress(walletAddress);
    const normalizedReservationEmail = normalizeLoginEmail(reservationEmail);
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);

    if (!normalizedReservationEmail) {
      return { ok: false, error: "Ingresa el correo que usaste al reservar." };
    }

    const guest = await resolveGuestByEmail(normalizedReservationEmail, address);
    if (!guest) {
      return {
        ok: false,
        error: "No encontramos una reserva con ese correo. Revisa el correo o reserva primero.",
      };
    }

    await completeGuestSession(
      guest.id,
      address,
      normalizedLoginEmail ?? normalizedReservationEmail,
    );
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

/** @deprecated Phone verification removed; use linkGuestReservationAction with email only. */
export async function linkGuestPhoneAction(
  walletAddress: string,
  _phone: string,
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
  return linkGuestReservationAction(walletAddress, email, loginEmail);
}

/** @deprecated Use linkGuestReservationAction (email only). */
export async function linkGuestReservationWithPhoneAction(
  walletAddress: string,
  reservationEmail: string,
  phone: string,
  loginEmail?: string | null,
): Promise<GuestAuthResult> {
  const normalizedPhone = normalizeGuestPhone(phone);
  if (normalizedPhone.length !== 10) {
    return {
      ok: false,
      error: "Ingresa un teléfono mexicano de 10 dígitos.",
    };
  }

  const address = normalizeWalletAddress(walletAddress);
  const normalizedReservationEmail = normalizeLoginEmail(reservationEmail);
  if (!normalizedReservationEmail) {
    return { ok: false, error: "Ingresa el correo que usaste al reservar." };
  }

  const guest = await resolveGuestByEmail(normalizedReservationEmail, address);
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

  await completeGuestSession(
    guest.id,
    address,
    normalizeLoginEmail(loginEmail) ?? normalizedReservationEmail,
  );
  return { ok: true, guestId: guest.id };
}

export async function guestLogoutAction() {
  await clearGuestSessionCookie();
  revalidatePath("/cuenta");
  revalidatePath("/login");
}

export async function getGuestSessionAction() {
  return getGuestSession();
}
