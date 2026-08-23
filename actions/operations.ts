"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AnomalyFlag,
  BedStatus,
  CashMovementCategory,
  CashMovementDirection,
  ExpenseConcept,
  PaymentMethod,
} from "@/types/domain";
import { EXPENSE_CONCEPTS, getExpenseConceptLabel } from "@/lib/expense-concepts";
import {
  expenseReceiptExtension,
  MAX_EXPENSE_RECEIPT_BYTES,
  resolveExpenseReceiptMime,
} from "@/lib/expense-receipt";
import {
  getMexicoCityDateString,
  mexicoCityDateTime,
  STAY_PERIOD_END_TIME,
  STAY_PERIOD_START_TIME,
} from "@/lib/dates";
import { getOpenShift } from "@/lib/open-shift";
import { parseTsvToRows } from "@/lib/imports/tsv";
import { deliverWhatsAppReservationReceipt } from "@/lib/whatsapp-payment-receipt";
import type { CreateGuestReservationResult, GuestConfirmationPayload } from "@/lib/guest-reservation-confirmation";
import { isCompleteMexicanPhone, normalizeMexicanPhone } from "@/lib/phone";
import { escapeIlike } from "@/lib/pagination";
import { reservationBlocksDate } from "@/lib/bed-occupancy";
import { autoCloseLiquidatedStays } from "@/lib/auto-checkout";
import {
  mapReservationToReceptionSearch,
  normalizeRecentReservationLimit,
  type ReceptionCheckInResult,
  type ReceptionSearchResult,
} from "@/lib/reception-check-in";
import { normalizeLockerCode } from "@/lib/locker";
import { formatBedLabel } from "@/lib/beds";
import { requireRole } from "@/lib/auth/guards";
import {
  type StayRegistrationMode,
  validateStayDates,
} from "@/lib/stay-registration";
import { getVisitorSalesTotalsForShift } from "@/lib/visitor-sales";
import { getServicePrices } from "@/lib/service-prices";

export type OperationResult = {
  status: "success" | "error";
  message: string;
};

function actionResult(status: "success" | "error", message: string): OperationResult {
  return { status, message };
}

function normalizePhone(value: string) {
  return normalizeMexicanPhone(value);
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

type ReservationGuestAssignmentRow = {
  bed_id?: string | null;
  locker_number?: string | number | null;
  locker_days?: number | null;
  guests?: { full_name?: string; id?: string; phone?: string } | { full_name?: string; id?: string; phone?: string }[] | null;
  beds?:
    | { bed_number?: string | number; zone?: string }
    | { bed_number?: string | number; zone?: string }[]
    | null;
};

function unwrapAssignmentRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function pickWhatsAppRecipient(rows: ReservationGuestAssignmentRow[]) {
  for (const row of rows) {
    const guest = unwrapAssignmentRelation(row.guests);
    if (!guest?.phone || !isCompleteMexicanPhone(guest.phone)) continue;
    return {
      guest,
      phone: normalizePhone(guest.phone),
    };
  }
  return null;
}

function parseReservationGuestAssignments(rows: ReservationGuestAssignmentRow[]) {
  const assignments = rows
    .map((row) => {
      const guest = unwrapAssignmentRelation(row.guests);
      const bed = unwrapAssignmentRelation(row.beds);
      const bedNumber = bed?.bed_number;
      if (bedNumber == null) return null;
      return {
        guestName: guest?.full_name ?? "Huésped",
        bedNumber: String(bedNumber),
        bedZone: bed?.zone ?? null,
        lockerNumber: normalizeLockerCode(row.locker_number),
        lockerDays: Number(row.locker_days ?? 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const allBedsAssigned = rows.length > 0 && rows.every((row) => row.bed_id);
  return { assignments, allBedsAssigned };
}

function generateFolioCode() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(
    2,
    "0",
  )}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `FPB-${stamp}-${rand}`;
}

function dateDiffInNights(checkInDate: string, checkOutDate: string) {
  const from = new Date(`${checkInDate}T00:00:00`);
  const to = new Date(`${checkOutDate}T00:00:00`);
  const ms = to.getTime() - from.getTime();
  const nights = Math.floor(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, nights);
}

function buildRedirectPath(
  basePath: string,
  status: "success" | "error",
  message: string,
  extraParams: Record<string, string> = {},
) {
  const safeBase = basePath.startsWith("/") ? basePath : "/";
  const [pathWithoutHash, hash = ""] = safeBase.split("#");
  const joiner = pathWithoutHash.includes("?") ? "&" : "?";
  const encodedExtraParams = Object.entries(extraParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const queryPart = `${pathWithoutHash}${joiner}status=${status}&message=${encodeURIComponent(message)}${
    encodedExtraParams ? `&${encodedExtraParams}` : ""
  }`;
  return hash ? `${queryPart}#${hash}` : queryPart;
}

function redirectWithResult(
  basePath: string,
  status: "success" | "error",
  message: string,
  extraParams?: Record<string, string>,
): never {
  redirect(buildRedirectPath(basePath, status, message, extraParams));
}

function isGuestAppReservation(formData: FormData) {
  return String(formData.get("reservation_source") ?? "").trim() === "guest_app";
}

function reservationFlowError(
  formData: FormData,
  returnTo: string,
  message: string,
): CreateGuestReservationResult | never {
  if (isGuestAppReservation(formData)) {
    return { ok: false, error: message };
  }
  return redirectWithResult(returnTo, "error", message);
}

async function getActorProfileId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  return profile?.id ?? null;
}

async function getActorProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return profile ?? null;
}

async function getFolioExpectedTotal(supabase: ReturnType<typeof createAdminClient>, folioId: string) {
  const { data: reservationRows } = await supabase
    .from("reservations")
    .select("id, nights, reservation_guests(final_rate, locker_amount)")
    .eq("folio_id", folioId);

  const baseExpected = (reservationRows ?? []).reduce((sum, reservation) => {
    const nights = Number(reservation.nights ?? 0);
    const guestRows = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests : [];
    const reservationExpected = guestRows.reduce((guestSum, row) => {
      const finalRate = Number((row as { final_rate?: number }).final_rate ?? 0);
      const lockerAmount = Number((row as { locker_amount?: number }).locker_amount ?? 0);
      return guestSum + finalRate * Math.max(0, nights) + lockerAmount;
    }, 0);
    return sum + reservationExpected;
  }, 0);

  const { data: extraRows } = await supabase.from("folio_extra_services").select("amount").eq("folio_id", folioId);
  const extraTotal = (extraRows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return baseExpected + extraTotal;
}

export async function pickAvailableBeds({
  count,
  checkInDate,
  checkOutDate,
}: {
  count: number;
  checkInDate: string;
  checkOutDate: string;
}) {
  const supabase = createAdminClient();

  // 1. Get ALL beds (not just "available" status — status may be stale)
  const { data: allBeds } = await supabase
    .from("beds")
    .select("id, bed_number, zone, status, sort_order")
    .order("sort_order");

  // Filter out only blocked beds
  const usableBeds = (allBeds ?? []).filter(b => b.status !== "blocked");
  if (!usableBeds.length) return [];

  // 2. Get ALL reservation_guests entries (not null bed_id)
  const { data: allRg } = await supabase
    .from("reservation_guests")
    .select("bed_id, reservation_id")
    .not("bed_id", "is", null);

  if (!allRg?.length) {
    // No assignments at all — all usable beds are free
    return usableBeds.slice(0, count).map(b => b.id);
  }

  // 3. Get ALL non-cancelled reservations that overlap with the requested dates
  const { data: overlappingReservations } = await supabase
    .from("reservations")
    .select("id, check_in_date, check_out_date, status, checked_out_at")
    .not("status", "in", '("cancelled","checked_out")')
    .is("checked_out_at", null);

  // Filter in JS for date overlap (more reliable than complex Supabase filters)
  const overlappingResMap = new Map<string, { check_in_date: string; check_out_date: string }>();
  for (const res of overlappingReservations ?? []) {
    // Overlap: res.check_in_date < checkOutDate && res.check_out_date > checkInDate
    if (res.check_in_date < checkOutDate && res.check_out_date > checkInDate) {
      overlappingResMap.set(res.id, res);
    }
  }

  console.log("[pickAvailableBeds] Requested dates:", checkInDate, "->", checkOutDate, "count:", count);
  console.log("[pickAvailableBeds] Usable beds:", usableBeds.length);
  console.log("[pickAvailableBeds] Total reservation_guests:", allRg.length);
  console.log("[pickAvailableBeds] Overlapping reservations:", overlappingResMap.size);

  // 4. Find beds occupied by overlapping reservations
  const occupiedBedIds = new Set<string>();
  for (const rg of allRg) {
    if (!rg.bed_id) continue;
    if (overlappingResMap.has(rg.reservation_id)) {
      occupiedBedIds.add(rg.bed_id);
    }
  }

  console.log("[pickAvailableBeds] Occupied bed IDs in date range:", occupiedBedIds.size, [...occupiedBedIds]);

  // 5. Filter free beds
  const freeBeds = usableBeds.filter(bed => !occupiedBedIds.has(bed.id));
  console.log(
    "[pickAvailableBeds] Free beds:",
    freeBeds.length,
    freeBeds.map((b) => formatBedLabel(b.bed_number, b.zone) ?? b.bed_number),
  );

  return freeBeds.slice(0, count).map(b => b.id);
}

export async function searchGuestByPhoneAction(phoneRaw: string) {
  const phone = normalizeMexicanPhone(phoneRaw);

  if (!isCompleteMexicanPhone(phone)) return { success: false, guest: null };

  const supabase = createAdminClient();
  const { data: guest } = await supabase
    .from("guests")
    .select("id, full_name, email, phone, sex")
    .eq("normalized_phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (guest) {
    return { success: true, guest };
  }

  return { success: false, guest: null };
}

export async function createReservationAction(
  formData: FormData,
): Promise<CreateGuestReservationResult | void> {
  const supabase = createAdminClient();
  const actor = await getActorProfile();
  const actorId = actor?.id ?? null;
  const returnTo = String(formData.get("return_to") ?? "/");
  const requestedSource = String(formData.get("reservation_source") ?? "").trim();
  const isStaffFlow =
    requestedSource === "cashier_counter" &&
    Boolean(actor && ["admin", "reception"].includes(actor.role));

  const guestsJson = String(formData.get("guests_data") ?? "[]");
  let guests: {
    full_name: string;
    phone: string;
    email: string;
    sex: string;
    existing_guest_id?: string;
    match_decision?: "reuse" | "create_new";
    add_locker?: string;
    locker_days?: number;
    locker_number?: string | number;
  }[] = [];
  try {
    guests = JSON.parse(guestsJson);
  } catch {}

  if (!guests.length) {
    return reservationFlowError(formData, returnTo, "Se requiere al menos un huésped para crear la reserva.");
  }

  const checkInDate = String(formData.get("check_in_date") ?? "");
  const checkOutDate = String(formData.get("check_out_date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!checkInDate || !checkOutDate) {
    return reservationFlowError(formData, returnTo, "Faltan las fechas de reservación.");
  }

  const nights = dateDiffInNights(checkInDate, checkOutDate);

  const guestIds: string[] = [];
  let reusedGuestsCount = 0;
  const requestedReuseIds = new Set<string>();
  const preparedGuests: Array<{
    guest: (typeof guests)[number];
    fullName: string;
    phone: string;
    email: string;
    sex: string;
  }> = [];

  for (let guestIndex = 0; guestIndex < guests.length; guestIndex += 1) {
    const guest = guests[guestIndex];
    const fullName = String(guest?.full_name ?? "").trim();
    const phoneRaw = String(guest?.phone ?? "");
    const phone = normalizePhone(phoneRaw);
    const email = String(guest?.email ?? "").trim().toLowerCase();
    const sex = String(guest?.sex ?? "unknown");

    if (!fullName || sex === "unknown") {
      return reservationFlowError(
        formData,
        returnTo,
        `Datos incompletos para ${fullName || `huésped ${guestIndex + 1}`}: nombre y sexo son obligatorios.`,
      );
    }
    if (!isStaffFlow && (!isCompleteMexicanPhone(phoneRaw) || !email)) {
      return reservationFlowError(
        formData,
        returnTo,
        `Datos incompletos para ${fullName}: teléfono mexicano de 10 dígitos y correo son obligatorios.`,
      );
    }
    if (phoneRaw.trim() && !isCompleteMexicanPhone(phoneRaw)) {
      return reservationFlowError(
        formData,
        returnTo,
        `El teléfono de ${fullName} debe tener 10 dígitos o quedar vacío.`,
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reservationFlowError(formData, returnTo, `El correo de ${fullName} no es válido.`);
    }

    const { data: existingGuests } = phone
      ? await supabase
          .from("guests")
          .select("id")
          .eq("normalized_phone", phone)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [] as { id: string }[] };
    const matchingGuestIds = new Set((existingGuests ?? []).map((row) => row.id));

    if (guest.match_decision === "reuse") {
      if (!guest.existing_guest_id || !matchingGuestIds.has(guest.existing_guest_id)) {
        return reservationFlowError(
          formData,
          returnTo,
          `La coincidencia de ${fullName} cambió. Vuelve a buscar el teléfono y confirma la reutilización.`,
        );
      }
      if (requestedReuseIds.has(guest.existing_guest_id)) {
        return reservationFlowError(
          formData,
          returnTo,
          `El perfil de ${fullName} ya fue asignado a otra persona en esta reservación.`,
        );
      }
      requestedReuseIds.add(guest.existing_guest_id);
    } else if (isStaffFlow && matchingGuestIds.size > 0 && guest.match_decision !== "create_new") {
      return reservationFlowError(
        formData,
        returnTo,
        `Ya existe un huésped con el teléfono de ${fullName}. Confirma si deseas reutilizarlo o crear un registro nuevo.`,
      );
    }

    preparedGuests.push({ guest, fullName, phone, email, sex });
  }

  for (const prepared of preparedGuests) {
    const { guest, fullName, phone, email, sex } = prepared;
    if (guest.match_decision === "reuse" && guest.existing_guest_id) {
      guestIds.push(guest.existing_guest_id);
      reusedGuestsCount += 1;
    } else {
      const { data: newGuest, error: guestError } = await supabase
        .from("guests")
        .insert({
          full_name: fullName,
          phone: phone || null,
          email: email || null,
          sex,
          normalized_name: normalizeName(fullName),
          normalized_phone: phone || null,
        })
        .select("id")
        .single();

      if (guestError || !newGuest) {
        return reservationFlowError(formData, returnTo, `No se pudo registrar al huésped ${fullName}.`);
      }
      guestIds.push(newGuest.id);
    }
  }

  if (guestIds.length === 0) {
    return reservationFlowError(formData, returnTo, "Datos de huéspedes inválidos.");
  }

  const folioCode = generateFolioCode();
  const prices = await getServicePrices();
  const nightlyRate = prices.bed_night;
  const lockerDailyPrice = prices.guest_locker_day;
  const discountRuleId = String(formData.get("discount_rule_id") ?? "") || null;
  const promoCode = String(formData.get("promo_code") ?? "") || null;
  const discountPercent = Number(formData.get("discount_percent") ?? 0) || 0;
  const discountAmountPerNight = Math.round(nightlyRate * discountPercent) / 100;
  const finalRate = nightlyRate - discountAmountPerNight;

  const reservationSource =
    isStaffFlow ? "cashier_counter" : "guest_app";

  const lockerByGuest = guests.slice(0, guestIds.length).map((guest) => {
    const wantsLocker = guest.add_locker === "yes";
    if (!wantsLocker) {
      return { locker_days: 0, locker_price: 0, locker_amount: 0, locker_number: null as string | null };
    }

    const lockerPriceWithDiscount = Math.round(lockerDailyPrice * (100 - discountPercent)) / 100;
    const requestedDays = Number(guest.locker_days ?? nights);
    const locker_days = Math.min(
      Math.max(1, Number.isFinite(requestedDays) ? requestedDays : nights),
      nights,
    );
    const locker_price = lockerPriceWithDiscount;
    const locker_amount = Number((locker_days * locker_price).toFixed(2));
    const locker_number = normalizeLockerCode(guest.locker_number);

    return { locker_days, locker_price, locker_amount, locker_number };
  });

  const lockerTotal = lockerByGuest.reduce((sum, row) => sum + row.locker_amount, 0);
  const originalLockerTotal = lockerByGuest.reduce(
    (sum, row) => sum + row.locker_days * lockerDailyPrice,
    0,
  );
  const totalAmount = finalRate * nights * guestIds.length + lockerTotal;

  const { data: folio, error: folioError } = await supabase
    .from("folios")
    .insert({
      folio_code: folioCode,
      total_amount: totalAmount,
      paid_amount: 0,
      balance_due: totalAmount,
      payment_status: "pending",
    })
    .select("id")
    .single();

  if (folioError || !folio) {
    return reservationFlowError(formData, returnTo, "No se pudo crear el folio.");
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .insert({
      folio_id: folio.id,
      created_by: actorId,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      check_in_at: mexicoCityDateTime(checkInDate, STAY_PERIOD_START_TIME),
      check_out_at: mexicoCityDateTime(checkOutDate, STAY_PERIOD_END_TIME),
      nights,
      status: "active",
      reservation_source: reservationSource,
      discount_rule_id: discountRuleId,
      discount_percent: discountPercent,
      notes,
    })
    .select("id")
    .single();

  if (reservationError || !reservation) {
    return reservationFlowError(formData, returnTo, "No se pudo crear la reservación.");
  }

  const guestInserts = guestIds.map((gId, i) => {
    const locker = lockerByGuest[i] ?? { locker_days: 0, locker_price: 0, locker_amount: 0 };

    return {
      reservation_id: reservation.id,
      guest_id: gId,
      bed_id: null,
      nightly_rate: nightlyRate,
      discount_amount: discountAmountPerNight,
      final_rate: finalRate,
      locker_number: locker.locker_number,
      locker_price: locker.locker_price,
      locker_days: locker.locker_days,
      locker_amount: locker.locker_amount,
      social_bonus_status: "captured",
    };
  });

  const { error: guestReservationError } = await supabase.from("reservation_guests").insert(guestInserts);

  if (guestReservationError) {
    console.error("[createReservationAction] reservation_guests insert:", guestReservationError);
    if (
      guestReservationError.code === "23502" &&
      guestReservationError.message.includes("bed_id")
    ) {
      console.error(
        "[createReservationAction] Apply supabase/migrations/20260604_optional_bed_assignment.sql (npm run db:apply-optional-bed)",
      );
      return reservationFlowError(
        formData,
        returnTo,
        "No se pudo completar la reservación en este momento. Si el problema continúa, contacta a recepción.",
      );
    }
    return reservationFlowError(formData, returnTo, "No se pudo registrar a los huéspedes.");
  }

  // Redeem promo code if one was used
  if (promoCode) {
    try {
      const { redeemPromoCode } = await import("@/lib/promo-codes");
      const redeemResult = await redeemPromoCode(promoCode);
      if (!redeemResult.valid) {
        console.warn("[createReservationAction] Promo code redemption returned invalid:", redeemResult.error);
      } else {
        console.log("[createReservationAction] Promo code redeemed successfully:", promoCode, "current_uses:", redeemResult.promo?.current_uses);
      }
    } catch (redeemErr) {
      console.error("[createReservationAction] Error redeeming promo code:", redeemErr);
    }
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "reservation_created",
    actor_role: actorId ? undefined : "reception",
    entity_type: "reservation",
    entity_id: reservation.id,
      metadata: {
        folio_code: folioCode,
        guests_count: guestIds.length,
        guests_reused: reusedGuestsCount,
        guests_created: guestIds.length - reusedGuestsCount,
        guest_reuse_policy: "explicit_match_no_profile_update",
        auto_assign: false,
        nights,
        total_amount: totalAmount,
        locker_total: lockerTotal,
        reservation_source: reservationSource,
        discount_rule_id: discountRuleId,
        discount_percent: discountPercent,
        promo_code: promoCode || null,
      },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/guests");
  if (reservationSource !== "guest_app") {
    revalidatePath("/");
  }

  const originalBedTotal = nightlyRate * nights * guestIds.length;
  const originalTotal = originalBedTotal + originalLockerTotal;

  if (reservationSource === "guest_app") {
    const confirmationPayload: GuestConfirmationPayload = {
      folio: folioCode,
      check_in: checkInDate,
      check_out: checkOutDate,
      nights,
      bed_subtotal: originalBedTotal,
      locker_total: originalLockerTotal,
      total_amount: totalAmount,
      discount_percent: discountPercent > 0 ? discountPercent : undefined,
      discount_amount: discountPercent > 0 ? originalTotal - totalAmount : undefined,
      original_total: discountPercent > 0 ? originalTotal : undefined,
      notes: notes || undefined,
      guests: guests.slice(0, guestIds.length).map((guest, index) => {
        const locker = lockerByGuest[index] ?? { locker_days: 0, locker_amount: 0 };
        return {
          full_name: guest.full_name.trim(),
          phone: guest.phone.trim(),
          email: guest.email.trim(),
          locker_days: locker.locker_days,
          locker_amount: locker.locker_amount,
        };
      }),
    };

    return { ok: true, confirmation: confirmationPayload };
  }

  return redirectWithResult(
    returnTo,
    "success",
    `Reserva registrada. Folio ${folioCode}.`,
    { checkin_reservation: reservation.id },
  );
}

const RECEPTION_RESERVATION_SELECT =
  "id, status, checked_out_at, created_at, check_in_date, check_out_date, nights, notes, folio_id, folios!inner(id, folio_code, payment_status, balance_due, total_amount, paid_amount), reservation_guests(id, guest_id, bed_id, locker_number, locker_days, locker_amount, locker_price, guests(full_name, phone, email), beds(bed_number, zone))";

const RECENT_RECEPTION_RESERVATIONS_LIMIT = 20;

async function fetchRecentReceptionReservations(
  supabase: ReturnType<typeof createAdminClient>,
  limit = RECENT_RECEPTION_RESERVATIONS_LIMIT,
): Promise<ReceptionSearchResult[]> {
  const { data } = await supabase
    .from("reservations")
    .select(RECEPTION_RESERVATION_SELECT)
    .not("status", "in", '("cancelled","checked_out")')
    .is("checked_out_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .map((row) => mapReservationToReceptionSearch(row))
    .filter((row): row is ReceptionSearchResult => row != null);
}

export async function getRecentReceptionReservations(
  limit = RECENT_RECEPTION_RESERVATIONS_LIMIT,
): Promise<ReceptionSearchResult[]> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) return [];
  const supabase = createAdminClient();
  return fetchRecentReceptionReservations(supabase, limit);
}

type PaymentCoreInput = {
  folioId: string;
  amount: number;
  method: PaymentMethod;
  effectiveDate: string;
  notes: string;
  isOverride?: boolean;
  overrideReason?: string;
};

type PaymentCoreSuccess = {
  ok: true;
  message: string;
  newStatus: "liquidated" | "partial";
  balanceDue: number;
  folioCode: string;
  folioId: string;
  whatsappSent: boolean;
};

type PaymentCoreFailure = { ok: false; message: string };

async function registerPaymentCore(input: PaymentCoreInput): Promise<PaymentCoreSuccess | PaymentCoreFailure> {
  const supabase = createAdminClient();
  const userSupabase = await createClient();
  const actor = await getActorProfile();
  const {
    folioId,
    amount,
    method,
    effectiveDate,
    notes,
    isOverride = false,
    overrideReason = "",
  } = input;

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { ok: false, message: "No tienes permiso para registrar cobros." };
  }
  if (!folioId || amount <= 0 || !effectiveDate) {
    return { ok: false, message: "Folio, monto y fecha efectiva son obligatorios." };
  }
  if (!["cash", "transfer", "card"].includes(method)) {
    return { ok: false, message: "Método de pago inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || effectiveDate > getMexicoCityDateString()) {
    return { ok: false, message: "La fecha efectiva no puede estar en el futuro." };
  }

  const { data: folio } = await supabase
    .from("folios")
    .select("id, total_amount, paid_amount, balance_due, folio_code")
    .eq("id", folioId)
    .single();

  if (!folio) {
    return { ok: false, message: "No se encontró el folio." };
  }

  const { data: reservationForPayment } = await supabase
    .from("reservations")
    .select(
      "id, status, checked_out_at, is_historical, check_in_date, check_out_date, nights, discount_percent, reservation_guests(bed_id, locker_number, locker_days, guests(id, full_name, phone), beds(bed_number, zone))",
    )
    .eq("folio_id", folioId)
    .limit(1)
    .maybeSingle();

  const guestRowsForPayment = (Array.isArray(reservationForPayment?.reservation_guests)
    ? reservationForPayment.reservation_guests
    : []) as ReservationGuestAssignmentRow[];
  const { assignments: paymentAssignments, allBedsAssigned } =
    parseReservationGuestAssignments(guestRowsForPayment);

  const isNonOperationalStay =
    reservationForPayment?.is_historical ||
    reservationForPayment?.status === "checked_out" ||
    Boolean(reservationForPayment?.checked_out_at);
  if (!allBedsAssigned && !isNonOperationalStay) {
    return {
      ok: false,
      message: "Asigna todas las camas en recepción antes de registrar el pago.",
    };
  }

  const { data: paymentRows, error: paymentError } = await userSupabase.rpc(
    "register_folio_payment",
    {
      p_folio_id: folioId,
      p_amount: amount,
      p_method: method,
      p_effective_date: effectiveDate,
      p_notes: notes || null,
      p_admin_override: isOverride,
      p_override_reason: overrideReason || null,
    },
  );
  if (paymentError) {
    console.error("[registerPaymentCore] RPC failed:", paymentError);
    return { ok: false, message: paymentError.message };
  }
  const paymentResult = Array.isArray(paymentRows) ? paymentRows[0] : paymentRows;
  if (!paymentResult) {
    return { ok: false, message: "No se pudo confirmar el abono." };
  }

  const expectedTotal = Number(paymentResult.expected_total);
  const newBalance = Number(paymentResult.balance_due);
  const newStatus = String(paymentResult.payment_status) as "liquidated" | "partial";

  // WhatsApp al titular con teléfono, solo cuando el folio queda liquidado.
  let whatsappSent = false;
  if (newStatus === "liquidated" && reservationForPayment) {
    try {
      const recipient = pickWhatsAppRecipient(guestRowsForPayment);
      if (recipient) {
        const guestName = recipient.guest.full_name ?? "Huésped";
        const waResult = await deliverWhatsAppReservationReceipt({
          guestPhone: recipient.phone,
          guestName,
          pdf: {
            guestName,
            folioCode: folio.folio_code,
            checkInDate: reservationForPayment.check_in_date,
            checkOutDate: reservationForPayment.check_out_date,
            nights: reservationForPayment.nights,
            guestCount: guestRowsForPayment.length,
            totalAmount: expectedTotal,
            paid: true,
            assignments: paymentAssignments,
          },
          fallback: {
            folioCode: folio.folio_code,
            amount: expectedTotal,
            method,
            balanceDue: newBalance,
            paymentStatus: newStatus,
            checkInDate: reservationForPayment.check_in_date,
            checkOutDate: reservationForPayment.check_out_date,
            nights: reservationForPayment.nights,
            assignments: paymentAssignments,
          },
        });

        await supabase.from("whatsapp_messages").insert({
          guest_id: recipient.guest.id ?? null,
          reservation_id: reservationForPayment.id,
          folio_id: folioId,
          status: waResult.success ? "sent" : "failed",
          phone: recipient.phone,
          payload: {
            folio_code: folio.folio_code,
            amount: expectedTotal,
            method,
            ycloud_result: waResult,
          },
          delivered_at: waResult.success ? new Date().toISOString() : null,
          error_message: waResult.error ?? null,
        });
        whatsappSent = Boolean(waResult.success);
      }
    } catch (waError) {
      console.error("[registerPaymentCore] Error enviando WhatsApp:", waError);
    }
  }

  if (newStatus === "liquidated") {
    await autoCloseLiquidatedStays();
  }

  const successMessage =
    newStatus === "liquidated"
      ? whatsappSent
        ? `Pago completo aplicado al folio ${folio.folio_code}. WhatsApp enviado.`
        : `Pago completo aplicado al folio ${folio.folio_code}. WhatsApp no enviado.`
      : `Pago parcial aplicado al folio ${folio.folio_code}.`;

  return {
    ok: true,
    message: successMessage,
    newStatus,
    balanceDue: newBalance,
    folioCode: folio.folio_code,
    folioId,
    whatsappSent,
  };
}

export async function registerPaymentResultAction(formData: FormData): Promise<OperationResult> {
  const folioId = String(formData.get("folio_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const effectiveDate = String(formData.get("effective_date") ?? getMexicoCityDateString());
  const notes = String(formData.get("notes") ?? "");
  const isOverride = String(formData.get("admin_override") ?? "") === "on";
  const overrideReason = String(formData.get("override_reason") ?? "").trim();

  const result = await registerPaymentCore({
    folioId,
    amount,
    method,
    effectiveDate,
    notes,
    isOverride,
    overrideReason,
  });

  if (!result.ok) {
    return actionResult("error", result.message);
  }

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/guests");
  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard");

  return actionResult("success", result.message);
}

export async function registerPaymentAction(formData: FormData): Promise<void> {
  const returnTo = String(formData.get("return_to") ?? "/dashboard/payments");
  const result = await registerPaymentResultAction(formData);
  if (result.status === "error") {
    return redirectWithResult(returnTo, "error", result.message);
  }
  return redirectWithResult(returnTo, "success", result.message);
}

export async function reversePaymentAction(formData: FormData): Promise<OperationResult> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return actionResult("error", "No tienes permiso para corregir pagos.");
  }

  const paymentId = String(formData.get("payment_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const submissionId = String(formData.get("submission_id") ?? "").trim();

  if (!paymentId || amount <= 0 || reason.length < 5) {
    return actionResult("error", "Indica un monto válido y un motivo de al menos 5 caracteres.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
    return actionResult("error", "Identificador de corrección inválido. Recarga e intenta nuevamente.");
  }

  const userSupabase = await createClient();
  const { data, error } = await userSupabase.rpc("reverse_folio_payment", {
    p_payment_id: paymentId,
    p_amount: amount,
    p_reason: reason,
    p_submission_id: submissionId,
  });

  if (error) {
    console.error("[reversePaymentAction] RPC failed:", error);
    return actionResult("error", error.message);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    return actionResult("error", "No se pudo confirmar la corrección.");
  }

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/guests");
  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard");

  return actionResult(
    "success",
    `Corrección de $${Number(result.corrected_amount).toFixed(2)} aplicada al folio ${result.folio_code}.`,
  );
}

export async function receptionReservationPaymentAction(formData: FormData): Promise<void> {
  const actor = await getActorProfile();
  const returnTo = String(formData.get("return_to") ?? "/dashboard");
  const folioId = String(formData.get("folio_id") ?? "");
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return redirectWithResult(returnTo, "error", "No tienes permiso para registrar cobros.");
  }

  if (!folioId) {
    return redirectWithResult(returnTo, "error", "No se encontró el folio para esta reservación.");
  }

  const supabase = createAdminClient();
  const { data: folio } = await supabase
    .from("folios")
    .select("balance_due, payment_status, folio_code")
    .eq("id", folioId)
    .single();

  if (!folio) {
    return redirectWithResult(returnTo, "error", "No se encontró el folio.");
  }

  if (folio.payment_status === "liquidated") {
    return redirectWithResult(returnTo, "error", `El folio ${folio.folio_code} ya está pagado.`);
  }

  const amount = Number(folio.balance_due);
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return redirectWithResult(
      returnTo,
      "error",
      "No hay saldo pendiente en este folio. Revisa el total de la reservación.",
    );
  }

  const paymentFormData = new FormData();
  paymentFormData.set("return_to", returnTo);
  paymentFormData.set("folio_id", folioId);
  paymentFormData.set("amount", String(amount));
  paymentFormData.set("method", method);
  paymentFormData.set(
    "effective_date",
    String(formData.get("effective_date") ?? getMexicoCityDateString()),
  );
  paymentFormData.set(
    "notes",
    notes || `Pago registrado desde dashboard ${actor.role === "admin" ? "admin" : "recepción"}.`,
  );

  return registerPaymentAction(paymentFormData);
}

export async function createCashMovementAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/cash-cuts");
  const direction = String(formData.get("direction") ?? "income") as CashMovementDirection;
  const category = String(formData.get("category") ?? "other") as CashMovementCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  const method = String(formData.get("method") ?? "cash");

  if (amount <= 0) {
    return redirectWithResult(returnTo, "error", "El monto debe ser mayor a cero.");
  }

  await supabase.from("cash_movements").insert({
    movement_date: new Date().toISOString().slice(0, 10),
    responsible_profile_id: actorId,
    direction,
    category,
    amount,
    method,
    notes,
  });

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "cash_movement_created",
    entity_type: "cash_movement",
    metadata: { direction, category, amount, method },
  });

  revalidatePath("/dashboard/cash-cuts");
  return redirectWithResult(returnTo, "success", "Movimiento de caja registrado.");
}

const EXPENSE_RECEIPTS_BUCKET = "expense-receipts";

function isExpenseConcept(value: string): value is ExpenseConcept {
  return (EXPENSE_CONCEPTS as readonly string[]).includes(value);
}

export async function openShiftAction(formData: FormData): Promise<void> {
  const adminSupabase = createAdminClient();
  const actor = await getActorProfile();
  const returnTo = String(formData.get("return_to") ?? "/dashboard");

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return redirectWithResult(returnTo, "error", "No tienes permiso para abrir turno.");
  }

  const { data: existing } = await adminSupabase
    .from("shifts")
    .select("id")
    .eq("status", "open")
    .eq("opened_by", actor.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return redirectWithResult(returnTo, "error", "Ya tienes un turno abierto.");
  }

  const { data: shift, error } = await adminSupabase
    .from("shifts")
    .insert({ opened_by: actor.id, status: "open" })
    .select("id")
    .single();

  if (error || !shift) {
    return redirectWithResult(returnTo, "error", "No se pudo abrir el turno.");
  }

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "shift_opened",
    entity_type: "shift",
    entity_id: shift.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/shifts");
  return redirectWithResult(returnTo, "success", "Turno iniciado.");
}

export async function closeShiftAction(formData: FormData): Promise<void> {
  const adminSupabase = createAdminClient();
  const actor = await getActorProfile();
  const returnTo = String(formData.get("return_to") ?? "/dashboard");

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return redirectWithResult(returnTo, "error", "No tienes permiso para cerrar turno.");
  }

  const { data: openShift } = await adminSupabase
    .from("shifts")
    .select("id")
    .eq("status", "open")
    .eq("opened_by", actor.id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openShift) {
    return redirectWithResult(returnTo, "error", "No hay un turno abierto.");
  }

  const { error } = await adminSupabase
    .from("shifts")
    .update({
      status: "closed",
      closed_by: actor.id,
      closed_at: new Date().toISOString(),
    })
    .eq("id", openShift.id);

  if (error) {
    return redirectWithResult(returnTo, "error", "No se pudo cerrar el turno.");
  }

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "shift_closed",
    entity_type: "shift",
    entity_id: openShift.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/shifts");
  return redirectWithResult(returnTo, "success", "Turno finalizado.");
}


export type CreateExpenseResult = {
  status: "success" | "partial" | "error";
  message: string;
  movementId?: string;
  amount?: number;
  expenseConcept?: ExpenseConcept;
  evidence?: "saved" | "not_provided" | "failed";
};

function expenseError(message: string): CreateExpenseResult {
  return { status: "error", message };
}

export async function createExpenseResultAction(formData: FormData): Promise<CreateExpenseResult> {
  const adminSupabase = createAdminClient();
  const actor = await getActorProfile();
  const actorId = actor?.id ?? null;

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return expenseError("No tienes permiso para registrar gastos.");
  }

  const expenseConcept = String(formData.get("expense_concept") ?? "");
  const conceptDetail = String(formData.get("concept_detail") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const notes = String(formData.get("notes") ?? "").trim();
  const receiptFileRaw = formData.get("receipt_image");
  const receiptFile = receiptFileRaw instanceof File && receiptFileRaw.size > 0 ? receiptFileRaw : null;
  const receiptMime = receiptFile
    ? resolveExpenseReceiptMime(receiptFile.type, receiptFile.name)
    : null;
  let receiptBuffer: Buffer | null = null;
  const requestedMovementId = String(formData.get("expense_submission_id") ?? "").trim();
  const movementId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    requestedMovementId,
  )
    ? requestedMovementId
    : crypto.randomUUID();

  if (!isExpenseConcept(expenseConcept)) {
    return expenseError("Selecciona un concepto de gasto válido.");
  }
  if (amount <= 0 || Number.isNaN(amount)) {
    return expenseError("El monto debe ser mayor a cero.");
  }
  if (expenseConcept === "extras" && conceptDetail.length < 3) {
    return expenseError("Para extras, describe el gasto (mínimo 3 caracteres).");
  }
  if (!["cash", "transfer", "card"].includes(method)) {
    return expenseError("Método de pago no válido.");
  }
  if (receiptFile) {
    if (receiptFile.size > MAX_EXPENSE_RECEIPT_BYTES) {
      return expenseError("La evidencia supera el máximo permitido de 9 MB.");
    }
    if (!receiptMime || !expenseReceiptExtension(receiptMime)) {
      return expenseError("La evidencia debe ser una imagen JPG, PNG, WebP, HEIC o HEIF.");
    }
    receiptBuffer = Buffer.from(await receiptFile.arrayBuffer());
  }

  const movementDate = getMexicoCityDateString();

  const { data: openShift } = await adminSupabase
    .from("shifts")
    .select("id")
    .eq("status", "open")
    .eq("opened_by", actor.id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openShift) {
    return expenseError("Inicia tu propio turno antes de registrar egresos.");
  }

  const receiptHash = receiptBuffer
    ? createHash("sha256").update(receiptBuffer).digest("hex")
    : null;
  const idempotencyPayloadHash = createHash("sha256")
    .update(
      JSON.stringify({
        movementDate,
        responsibleProfileId: actorId,
        direction: "expense",
        category: "gasto_operativo",
        expenseConcept,
        conceptDetail: expenseConcept === "extras" ? conceptDetail : null,
        amount,
        method,
        notes: notes || null,
        shiftId: openShift?.id ?? null,
        receipt: receiptBuffer
          ? {
              sha256: receiptHash,
              type: receiptMime,
              size: receiptBuffer.byteLength,
            }
          : null,
      }),
    )
    .digest("hex");

  const { error: insertError } = await adminSupabase.from("cash_movements").insert({
    id: movementId,
    movement_date: movementDate,
    responsible_profile_id: actorId,
    direction: "expense",
    category: "gasto_operativo",
    expense_concept: expenseConcept,
    concept_detail: expenseConcept === "extras" ? conceptDetail : null,
    amount,
    method,
    notes: notes || null,
    shift_id: openShift?.id ?? null,
    idempotency_payload_hash: idempotencyPayloadHash,
  });

  if (insertError) {
    if (insertError.code !== "23505") {
      console.error("[createExpenseResultAction] insert failed:", insertError.message, insertError);
      return expenseError(`No se pudo registrar el gasto: ${insertError.message}`);
    }

    const { data: existingMovement } = await adminSupabase
      .from("cash_movements")
      .select(
        "id, movement_date, responsible_profile_id, direction, category, expense_concept, concept_detail, amount, method, notes, shift_id, receipt_image_path, idempotency_payload_hash",
      )
      .eq("id", movementId)
      .eq("direction", "expense")
      .maybeSingle();
    if (
      !existingMovement ||
      existingMovement.movement_date !== movementDate ||
      existingMovement.responsible_profile_id !== actorId ||
      existingMovement.direction !== "expense" ||
      existingMovement.category !== "gasto_operativo" ||
      Number(existingMovement.amount) !== amount ||
      existingMovement.expense_concept !== expenseConcept ||
      (existingMovement.concept_detail ?? null) !==
        (expenseConcept === "extras" ? conceptDetail : null) ||
      existingMovement.method !== method ||
      (existingMovement.notes ?? null) !== (notes || null) ||
      (existingMovement.shift_id ?? null) !== (openShift?.id ?? null) ||
      existingMovement.idempotency_payload_hash !== idempotencyPayloadHash
    ) {
      return expenseError("Este envío ya fue procesado con datos diferentes. Inicia un registro nuevo.");
    }
    if (existingMovement.receipt_image_path) {
      return {
        status: "success",
        message: "El gasto y su evidencia ya estaban guardados.",
        movementId,
        amount,
        expenseConcept,
        evidence: "saved",
      };
    }
  }

  if (!insertError) {
    await adminSupabase.from("audit_logs").insert({
      actor_user_id: actorId,
      action: "expense_created",
      entity_type: "cash_movement",
      entity_id: movementId,
      metadata: {
        expense_concept: expenseConcept,
        concept_detail: expenseConcept === "extras" ? conceptDetail : null,
        amount,
        method,
        movement_date: movementDate,
        shift_id: openShift?.id ?? null,
      },
    });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard/expenses");

  const movement = { id: movementId };

  if (receiptFile && receiptMime && receiptBuffer) {
    const { error: bucketError } = await adminSupabase.storage.createBucket(EXPENSE_RECEIPTS_BUCKET, {
      public: false,
    });
    if (bucketError && !/(already exists|duplicate)/i.test(bucketError.message)) {
      console.error("[createExpenseResultAction] bucket failed:", bucketError.message, bucketError);
      return {
        status: "partial",
        message: "El gasto se guardó, pero no se pudo preparar el almacenamiento de la evidencia.",
        movementId,
        amount,
        expenseConcept,
        evidence: "failed",
      };
    }
    const extension = expenseReceiptExtension(receiptMime);
    if (!extension) {
      return {
        status: "partial",
        message: "El gasto se guardó, pero el formato de la evidencia no es válido.",
        movementId,
        amount,
        expenseConcept,
        evidence: "failed",
      };
    }
    const objectPath = `${movementDate}/${movement.id}.${extension}`;

    const { error: uploadError } = await adminSupabase.storage
      .from(EXPENSE_RECEIPTS_BUCKET)
      .upload(objectPath, receiptBuffer, { contentType: receiptMime, upsert: true });

    if (uploadError) {
      console.error("[createExpenseResultAction] upload failed:", uploadError.message, uploadError);
      return {
        status: "partial",
        message: "El gasto se guardó, pero la evidencia no pudo subirse. Puedes reintentar.",
        movementId,
        amount,
        expenseConcept,
        evidence: "failed",
      };
    }

    const { data: updatedMovement, error: updateError } = await adminSupabase
      .from("cash_movements")
      .update({ receipt_image_path: objectPath })
      .eq("id", movement.id)
      .select("id")
      .maybeSingle();
    if (updateError || !updatedMovement) {
      console.error(
        "[createExpenseResultAction] receipt update failed:",
        updateError?.message ?? "movement not updated",
        updateError,
      );
      const { error: cleanupError } = await adminSupabase.storage
        .from(EXPENSE_RECEIPTS_BUCKET)
        .remove([objectPath]);
      if (cleanupError) {
        console.error("[createExpenseResultAction] receipt cleanup failed:", cleanupError.message, cleanupError);
      }
      return {
        status: "partial",
        message: "El gasto se guardó, pero no se pudo vincular la evidencia. Puedes reintentar.",
        movementId,
        amount,
        expenseConcept,
        evidence: "failed",
      };
    }
  }

  return {
    status: "success",
    message:
      receiptFile && receiptMime
        ? "Gasto y evidencia guardados correctamente."
        : "Gasto guardado correctamente sin evidencia.",
    movementId,
    amount,
    expenseConcept,
    evidence: receiptFile && receiptMime ? "saved" : "not_provided",
  };
}

export type DeleteExpenseResult = {
  status: "success" | "partial" | "error";
  message: string;
};

export async function deleteExpenseAction(formData: FormData): Promise<DeleteExpenseResult> {
  await requireRole(["admin"]);

  const movementId = String(formData.get("movement_id") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(movementId)) {
    return { status: "error", message: "Egreso no válido." };
  }

  const userSupabase = await createClient();
  const { data, error } = await userSupabase.rpc("admin_delete_expense", {
    p_movement_id: movementId,
  });
  if (error) {
    console.error("[deleteExpenseAction] RPC failed:", error);
    return { status: "error", message: error.message };
  }

  const result = (data ?? {}) as {
    amount?: number;
    receipt_image_path?: string | null;
    cash_cut_recalculated?: boolean;
  };
  let evidenceCleanupFailed = false;
  if (result.receipt_image_path) {
    const adminSupabase = createAdminClient();
    const { error: cleanupError } = await adminSupabase.storage
      .from(EXPENSE_RECEIPTS_BUCKET)
      .remove([result.receipt_image_path]);
    if (cleanupError) {
      evidenceCleanupFailed = true;
      console.error("[deleteExpenseAction] receipt cleanup failed:", cleanupError);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard/shifts");

  const amount = Number(result.amount ?? 0);
  const cutMessage = result.cash_cut_recalculated
    ? " También se recalculó el corte relacionado."
    : "";
  if (evidenceCleanupFailed) {
    return {
      status: "partial",
      message: `El egreso de $${amount.toFixed(2)} fue eliminado y ya no cuenta en las sumas.${cutMessage} No se pudo borrar su foto del almacenamiento.`,
    };
  }
  return {
    status: "success",
    message: `El egreso de $${amount.toFixed(2)} fue eliminado definitivamente.${cutMessage}`,
  };
}

export async function retryExpenseReceiptAction(formData: FormData): Promise<CreateExpenseResult> {
  const adminSupabase = createAdminClient();
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return expenseError("No tienes permiso para adjuntar esta evidencia.");
  }

  const movementId = String(formData.get("movement_id") ?? "").trim();
  const receiptFileRaw = formData.get("receipt_image");
  const receiptFile = receiptFileRaw instanceof File && receiptFileRaw.size > 0 ? receiptFileRaw : null;
  if (!movementId || !receiptFile) {
    return expenseError("Selecciona la evidencia que deseas reintentar.");
  }
  if (receiptFile.size > MAX_EXPENSE_RECEIPT_BYTES) {
    return expenseError("La evidencia supera el máximo permitido de 9 MB.");
  }
  const receiptMime = resolveExpenseReceiptMime(receiptFile.type, receiptFile.name);
  const extension = receiptMime ? expenseReceiptExtension(receiptMime) : null;
  if (!receiptMime || !extension) {
    return expenseError("La evidencia debe ser una imagen JPG, PNG, WebP, HEIC o HEIF.");
  }

  const { data: movement } = await adminSupabase
    .from("cash_movements")
    .select("id,movement_date,direction,responsible_profile_id,receipt_image_path,amount,expense_concept")
    .eq("id", movementId)
    .eq("direction", "expense")
    .maybeSingle();
  if (!movement || movement.responsible_profile_id !== actor.id) {
    return expenseError("No se encontró un egreso propio pendiente de evidencia.");
  }
  if (movement.receipt_image_path) {
    return {
      status: "success",
      message: "La evidencia ya estaba guardada.",
      movementId,
      amount: Number(movement.amount),
      expenseConcept: movement.expense_concept as ExpenseConcept,
      evidence: "saved",
    };
  }

  const { error: bucketError } = await adminSupabase.storage.createBucket(EXPENSE_RECEIPTS_BUCKET, {
    public: false,
  });
  if (bucketError && !/(already exists|duplicate)/i.test(bucketError.message)) {
    return {
      status: "partial",
      message: "El egreso sigue guardado, pero no se pudo preparar el almacenamiento.",
      movementId,
      amount: Number(movement.amount),
      expenseConcept: movement.expense_concept as ExpenseConcept,
      evidence: "failed",
    };
  }

  const objectPath = `${movement.movement_date}/${movement.id}.${extension}`;
  const fileBuffer = Buffer.from(await receiptFile.arrayBuffer());
  const { error: uploadError } = await adminSupabase.storage
    .from(EXPENSE_RECEIPTS_BUCKET)
    .upload(objectPath, fileBuffer, { contentType: receiptMime, upsert: true });
  if (uploadError) {
    return {
      status: "partial",
      message: "El reintento falló. El egreso sigue guardado.",
      movementId,
      amount: Number(movement.amount),
      expenseConcept: movement.expense_concept as ExpenseConcept,
      evidence: "failed",
    };
  }

  const { data: updated } = await adminSupabase
    .from("cash_movements")
    .update({ receipt_image_path: objectPath })
    .eq("id", movement.id)
    .eq("responsible_profile_id", actor.id)
    .is("receipt_image_path", null)
    .select("id")
    .maybeSingle();
  if (!updated) {
    await adminSupabase.storage.from(EXPENSE_RECEIPTS_BUCKET).remove([objectPath]);
    return {
      status: "partial",
      message: "La foto subió, pero no pudo vincularse. Intenta nuevamente.",
      movementId,
      amount: Number(movement.amount),
      expenseConcept: movement.expense_concept as ExpenseConcept,
      evidence: "failed",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard/expenses");
  return {
    status: "success",
    message: "Evidencia guardada correctamente.",
    movementId,
    amount: Number(movement.amount),
    expenseConcept: movement.expense_concept as ExpenseConcept,
    evidence: "saved",
  };
}

export async function createExpenseAction(formData: FormData): Promise<void> {
  const returnTo = String(formData.get("return_to") ?? "/dashboard");
  const result = await createExpenseResultAction(formData);
  return redirectWithResult(
    returnTo,
    result.status === "error" ? "error" : "success",
    result.message,
  );
}

export type ExpenseHistoryEntry = {
  id: string;
  action: string;
  createdAt: string;
  actorName: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type ExpenseHistoryResult = {
  status: "success" | "error";
  message?: string;
  entries?: ExpenseHistoryEntry[];
};

export type UpdateExpenseResult = {
  status: "success" | "error";
  message: string;
};

function snapshotExpenseFields(row: {
  expense_concept: string | null;
  concept_detail: string | null;
  amount: number | string | null;
  method: string | null;
  notes: string | null;
  receipt_image_path?: string | null;
}) {
  return {
    expense_concept: row.expense_concept,
    concept_detail: row.concept_detail,
    amount: Number(row.amount ?? 0),
    method: row.method,
    notes: row.notes,
    receipt_image_path: row.receipt_image_path ?? null,
  };
}

async function assertEditableShiftExpense(
  adminSupabase: ReturnType<typeof createAdminClient>,
  actor: { id: string; role: string },
  movementId: string,
) {
  const { data: movement } = await adminSupabase
    .from("cash_movements")
    .select(
      "id,movement_date,direction,category,expense_concept,concept_detail,amount,method,notes,receipt_image_path,shift_id,responsible_profile_id",
    )
    .eq("id", movementId)
    .eq("direction", "expense")
    .maybeSingle();

  if (!movement) {
    return { error: "No se encontró el egreso." as const, movement: null };
  }

  if (actor.role === "reception") {
    if (movement.responsible_profile_id !== actor.id) {
      return { error: "Solo puedes editar egresos de tu propio turno." as const, movement: null };
    }
    const openShift = await getOpenShift(actor.id);
    if (!openShift || movement.shift_id !== openShift.id) {
      return {
        error: "Solo puedes editar egresos del turno activo." as const,
        movement: null,
      };
    }
    const { data: cut } = await adminSupabase
      .from("cash_cuts")
      .select("id")
      .eq("shift_id", openShift.id)
      .limit(1)
      .maybeSingle();
    if (cut) {
      return {
        error: "Este turno ya tiene corte; no se pueden editar egresos." as const,
        movement: null,
      };
    }
  } else if (actor.role !== "admin") {
    return { error: "No tienes permiso para editar egresos." as const, movement: null };
  }

  return { error: null, movement };
}

export async function updateExpenseResultAction(formData: FormData): Promise<UpdateExpenseResult> {
  const adminSupabase = createAdminClient();
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { status: "error", message: "No tienes permiso para editar egresos." };
  }

  const movementId = String(formData.get("movement_id") ?? "").trim();
  const expenseConcept = String(formData.get("expense_concept") ?? "");
  const conceptDetail = String(formData.get("concept_detail") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!movementId) {
    return { status: "error", message: "Falta el egreso a editar." };
  }
  if (!isExpenseConcept(expenseConcept)) {
    return { status: "error", message: "Selecciona un concepto de gasto válido." };
  }
  if (amount <= 0 || Number.isNaN(amount)) {
    return { status: "error", message: "El monto debe ser mayor a cero." };
  }
  if (expenseConcept === "extras" && conceptDetail.length < 3) {
    return { status: "error", message: "Para extras, describe el gasto (mínimo 3 caracteres)." };
  }
  if (!["cash", "transfer", "card"].includes(method)) {
    return { status: "error", message: "Método de pago no válido." };
  }

  const gate = await assertEditableShiftExpense(adminSupabase, actor, movementId);
  if (gate.error || !gate.movement) {
    return { status: "error", message: gate.error ?? "No se pudo editar el egreso." };
  }

  const before = snapshotExpenseFields(gate.movement);
  const after = {
    expense_concept: expenseConcept,
    concept_detail: expenseConcept === "extras" ? conceptDetail : null,
    amount,
    method,
    notes: notes || null,
    receipt_image_path: gate.movement.receipt_image_path ?? null,
  };

  const unchanged =
    before.expense_concept === after.expense_concept &&
    (before.concept_detail ?? null) === after.concept_detail &&
    Number(before.amount) === after.amount &&
    before.method === after.method &&
    (before.notes ?? null) === after.notes;

  if (unchanged) {
    return { status: "success", message: "Sin cambios que guardar." };
  }

  const { error: updateError } = await adminSupabase
    .from("cash_movements")
    .update({
      expense_concept: after.expense_concept,
      concept_detail: after.concept_detail,
      amount: after.amount,
      method: after.method,
      notes: after.notes,
    })
    .eq("id", movementId)
    .eq("direction", "expense");

  if (updateError) {
    console.error("[updateExpenseResultAction] update failed:", updateError.message, updateError);
    return { status: "error", message: `No se pudo actualizar el egreso: ${updateError.message}` };
  }

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "expense_updated",
    entity_type: "cash_movement",
    entity_id: movementId,
    metadata: {
      before,
      after,
      shift_id: gate.movement.shift_id,
      movement_date: gate.movement.movement_date,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash-cuts");
  return { status: "success", message: "Egreso actualizado correctamente." };
}

export async function getExpenseHistoryAction(movementId: string): Promise<ExpenseHistoryResult> {
  const adminSupabase = createAdminClient();
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { status: "error", message: "No tienes permiso para ver este historial." };
  }

  const id = movementId.trim();
  if (!id) {
    return { status: "error", message: "Egreso inválido." };
  }

  const gate = await assertEditableShiftExpense(adminSupabase, actor, id);
  // Reception may view history for own open-shift expenses; admin for any.
  // For closed-shift own expenses, reception should still see history — relax for admin only edit,
  // but allow history read for own expenses even if shift closed.
  let movement = gate.movement;
  if (!movement) {
    const { data } = await adminSupabase
      .from("cash_movements")
      .select(
        "id,movement_date,direction,category,expense_concept,concept_detail,amount,method,notes,receipt_image_path,shift_id,responsible_profile_id",
      )
      .eq("id", id)
      .eq("direction", "expense")
      .maybeSingle();
    if (!data) {
      return { status: "error", message: "No se encontró el egreso." };
    }
    if (actor.role === "reception" && data.responsible_profile_id !== actor.id) {
      return { status: "error", message: "Solo puedes ver historial de tus egresos." };
    }
    movement = data;
  }

  const { data: logs, error } = await adminSupabase
    .from("audit_logs")
    .select("id, action, created_at, metadata, profiles:actor_user_id(full_name)")
    .eq("entity_type", "cash_movement")
    .eq("entity_id", movement.id)
    .in("action", ["expense_created", "expense_updated"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { status: "error", message: "No se pudo cargar el historial." };
  }

  const methodLabels: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
  };

  const entries: ExpenseHistoryEntry[] = (logs ?? []).map((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const actorProfile = log.profiles as { full_name?: string } | { full_name?: string }[] | null;
    const actorName = Array.isArray(actorProfile)
      ? actorProfile[0]?.full_name ?? null
      : actorProfile?.full_name ?? null;

    let summary = "";
    if (log.action === "expense_created") {
      const concept = getExpenseConceptLabel(String(meta.expense_concept ?? ""));
      const amount = Number(meta.amount ?? 0);
      const method = methodLabels[String(meta.method ?? "")] ?? String(meta.method ?? "");
      summary = `Registrado · ${concept} · $${amount.toFixed(2)} · ${method}`;
    } else {
      const before = (meta.before ?? null) as Record<string, unknown> | null;
      const after = (meta.after ?? null) as Record<string, unknown> | null;
      const changes: string[] = [];
      if (before && after) {
        if (before.expense_concept !== after.expense_concept || before.concept_detail !== after.concept_detail) {
          changes.push(
            `concepto → ${getExpenseConceptLabel(String(after.expense_concept ?? ""))}${
              after.expense_concept === "extras" && after.concept_detail
                ? `: ${after.concept_detail}`
                : ""
            }`,
          );
        }
        if (Number(before.amount) !== Number(after.amount)) {
          changes.push(`monto → $${Number(after.amount ?? 0).toFixed(2)}`);
        }
        if (before.method !== after.method) {
          changes.push(`método → ${methodLabels[String(after.method ?? "")] ?? after.method}`);
        }
        if ((before.notes ?? null) !== (after.notes ?? null)) {
          changes.push("notas actualizadas");
        }
      }
      summary = changes.length > 0 ? `Editado · ${changes.join(" · ")}` : "Editado";
    }

    return {
      id: log.id,
      action: log.action,
      createdAt: log.created_at,
      actorName,
      summary,
      before: (meta.before as Record<string, unknown> | undefined) ?? null,
      after: (meta.after as Record<string, unknown> | undefined) ?? null,
    };
  });

  return { status: "success", entries };
}

export async function createDailyCashCutAction(): Promise<void> {
  const supabase = createAdminClient();
  const actor = await getActorProfile();
  const today = getMexicoCityDateString();

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return redirectWithResult("/dashboard/cash-cuts", "error", "No tienes permiso para generar cortes.");
  }

  const { data: currentShift } = await supabase
    .from("shifts")
    .select("id")
    .eq("status", "open")
    .eq("opened_by", actor.id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!currentShift) {
    return redirectWithResult(
      "/dashboard/cash-cuts",
      "error",
      "Inicia tu propio turno antes de generar el corte.",
    );
  }

  const { data: existingCut } = await supabase
    .from("cash_cuts")
    .select("id")
    .eq("shift_id", currentShift.id)
    .limit(1)
    .maybeSingle();
  if (existingCut) {
    return redirectWithResult("/dashboard/cash-cuts", "error", "Este turno ya tiene un corte.");
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, method")
    .eq("shift_id", currentShift.id);

  const { data: movements } = await supabase
    .from("cash_movements")
    .select("amount, direction")
    .eq("shift_id", currentShift.id);

  const visitorSales = await getVisitorSalesTotalsForShift(supabase, currentShift.id);

  const totalCash = (payments ?? [])
    .filter((p) => p.method === "cash")
    .reduce((sum, p) => sum + Number(p.amount), 0) + visitorSales.cash;
  const totalTransfer = (payments ?? [])
    .filter((p) => p.method === "transfer")
    .reduce((sum, p) => sum + Number(p.amount), 0) + visitorSales.transfer;
  const totalCard = (payments ?? [])
    .filter((p) => p.method === "card")
    .reduce((sum, p) => sum + Number(p.amount), 0) + visitorSales.card;
  const movementIncome = (movements ?? [])
    .filter((m) => m.direction === "income")
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const movementExpense = (movements ?? [])
    .filter((m) => m.direction === "expense")
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const totalGuestIncome = totalCash + totalTransfer + totalCard;
  const totalExpenses = movementExpense;
  const netResult = Number((totalGuestIncome + movementIncome - totalExpenses).toFixed(2));
  const totalIncome = netResult;

  const expectedIncome = netResult;
  const actualCashCounted = totalIncome;
  const difference = Number((expectedIncome - actualCashCounted).toFixed(2));
  const leakageFlag = Math.abs(difference) > 0.009;

  const { data: cashCut, error: cutError } = await supabase.from("cash_cuts").insert({
    shift_id: currentShift.id,
    generated_by: actor.id,
    total_cash: totalCash,
    total_transfer: totalTransfer,
    total_card: totalCard,
    total_income: totalIncome,
    total_guest_income: totalGuestIncome,
    total_expenses: totalExpenses,
    net_result: netResult,
    expected_income: expectedIncome,
    actual_cash_counted: actualCashCounted,
    difference,
    leakage_flag: leakageFlag,
    notes: `Corte del turno ${currentShift.id} · ${today}`,
  }).select("id").single();
  if (cutError || !cashCut) {
    return redirectWithResult(
      "/dashboard/cash-cuts",
      "error",
      cutError?.code === "23505" ? "Este turno ya tiene un corte." : "No se pudo guardar el corte.",
    );
  }

  const { error: closeError } = await supabase
    .from("shifts")
    .update({ status: "closed", closed_by: actor.id, closed_at: new Date().toISOString() })
    .eq("id", currentShift.id);
  if (closeError) {
    return redirectWithResult(
      "/dashboard/cash-cuts",
      "error",
      "El corte se guardó, pero no se pudo cerrar el turno. Contacta a administración.",
    );
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "daily_cash_cut_generated",
    entity_type: "cash_cut",
    entity_id: cashCut.id,
    metadata: {
      date: today,
      total_income: totalIncome,
      total_guest_income: totalGuestIncome,
      total_expenses: totalExpenses,
      net_result: netResult,
      expected_income: expectedIncome,
      difference,
      leakage_flag: leakageFlag,
      shift_id: currentShift.id,
    },
  });

  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard/shifts");
  return redirectWithResult("/dashboard/cash-cuts", "success", "Corte diario generado y turno cerrado.");
}

export async function sendWhatsAppTicketAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const actorId = await getActorProfileId();
  const folioId = String(formData.get("folio_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/folios");

  if (!folioId) return redirectWithResult(returnTo, "error", "Folio requerido.");

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id,folio_id,reservation_guests(guest_id,guests(phone,full_name)),folios(folio_code,total_amount,balance_due,payment_status)")
    .eq("folio_id", folioId)
    .limit(1)
    .single();

  if (!reservation) return redirectWithResult(returnTo, "error", "No se encontró reservación para ese folio.");

  const guestRow = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests[0] : null;
  const guest = guestRow?.guests as { phone?: string; full_name?: string } | undefined;
  const phone = normalizePhone(guest?.phone ?? "");
  if (!phone) return redirectWithResult(returnTo, "error", "No hay teléfono válido para enviar el ticket.");

  const folioRow = Array.isArray(reservation.folios) ? reservation.folios[0] : reservation.folios;
  const folio = (folioRow ?? {
    folio_code: "",
    total_amount: 0,
    balance_due: 0,
    payment_status: "pending",
  }) as {
    folio_code: string;
    total_amount: number;
    balance_due: number;
    payment_status: string;
  };

  const payload = {
    folio_code: folio.folio_code,
    customer_name: guest?.full_name ?? "",
    total_amount: folio.total_amount,
    balance_due: folio.balance_due,
    payment_status: folio.payment_status,
    text: `Folio ${folio.folio_code} | Total ${folio.total_amount} | Saldo ${folio.balance_due}`,
  };

  await supabase.from("whatsapp_messages").insert({
    guest_id: guestRow?.guest_id ?? null,
    reservation_id: reservation.id,
    folio_id: folioId,
    status: "sent",
    phone,
    payload,
    delivered_at: new Date().toISOString(),
  });

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "whatsapp_ticket_sent",
    entity_type: "folio",
    entity_id: folioId,
    metadata: { phone, folio_code: folio.folio_code },
  });

  revalidatePath("/dashboard/folios");
  return redirectWithResult(
    returnTo,
    "success",
    `Ticket registrado como enviado a WhatsApp para folio ${folio.folio_code}.`,
  );
}

export async function previewImportedRecordsAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/imported-records");
  const sourceName = String(formData.get("source_name") ?? "TSV import");
  const rawTsv = String(formData.get("raw_tsv") ?? "");
  if (!rawTsv.trim()) return redirectWithResult(returnTo, "error", "Pega contenido TSV para previsualizar.");

  const parsedRows = parseTsvToRows(rawTsv);
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      source_name: sourceName,
      source_format: "tsv",
      uploaded_by: actorId,
      status: "previewed",
      raw_content: rawTsv,
      preview_count: parsedRows.length,
      imported_count: 0,
    })
    .select("id")
    .single();

  if (batchError || !batch) return redirectWithResult(returnTo, "error", "No se pudo crear el lote de importación.");

  if (parsedRows.length) {
    const inserts = parsedRows.map((row) => ({
      batch_id: batch.id,
      source_day: row.source_day,
      source_name: row.source_name,
      source_client_no: row.source_client_no,
      source_sex: row.source_sex,
      source_bed: row.source_bed,
      source_locker: row.source_locker,
      source_check_in_date: row.source_check_in_date,
      source_check_in_time: row.source_check_in_time,
      source_check_out_date: row.source_check_out_date,
      source_nights: row.source_nights,
      source_bed_price: row.source_bed_price,
      source_bed_amount: row.source_bed_amount,
      source_locker_price: row.source_locker_price,
      source_locker_days: row.source_locker_days,
      source_locker_amount: row.source_locker_amount,
      source_total: row.source_total,
      guest_name: row.guest_name,
      guest_sex: row.guest_sex,
      bed_number: row.bed_number,
      locker_number: row.locker_number,
      check_in_date: row.check_in_date,
      check_in_time: row.check_in_time,
      check_out_date: row.check_out_date,
      nights: row.nights,
      bed_price: row.bed_price,
      locker_price: row.locker_price,
      locker_days: row.locker_days,
      bed_amount_written: row.bed_amount_written,
      locker_amount_written: row.locker_amount_written,
      total_written: row.total_written,
      bed_amount_calculated: row.bed_amount_calculated,
      locker_amount_calculated: row.locker_amount_calculated,
      extra_services_total: row.extra_services_total,
      total_calculated: row.total_calculated,
      bed_amount_difference: row.bed_amount_difference,
      locker_amount_difference: row.locker_amount_difference,
      total_difference: row.total_difference,
      needs_review: row.needs_review,
      unreadable_fields: row.unreadable_fields,
    }));
    const { data: insertedRows } = await supabase.from("imported_records").insert(inserts).select("id");

    for (let i = 0; i < parsedRows.length; i += 1) {
      const row = parsedRows[i];
      const importedId = insertedRows?.[i]?.id;
      if (!importedId || !row.anomaly_flags.length) continue;
      await supabase.from("imported_record_anomalies").insert(
        row.anomaly_flags.map((flag) => ({
          imported_record_id: importedId,
          flag,
          message: `Detected ${flag} during TSV preview`,
        })),
      );
    }
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "import_preview_created",
    entity_type: "import_batch",
    entity_id: batch.id,
    metadata: { preview_count: parsedRows.length },
  });

  revalidatePath("/dashboard/imported-records");
  return redirectWithResult(`/dashboard/imported-records?batch_id=${batch.id}`, "success", `Previsualización lista (${parsedRows.length} registros).`);
}

export async function commitImportedBatchAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/imported-records");
  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return redirectWithResult(returnTo, "error", "Lote no especificado.");

  const { data: batch } = await supabase.from("import_batches").select("id, status").eq("id", batchId).single();
  if (!batch) return redirectWithResult(returnTo, "error", "Lote no encontrado.");

  await supabase
    .from("import_batches")
    .update({ status: "imported", imported_count: (await supabase.from("imported_records").select("id", { count: "exact", head: true }).eq("batch_id", batchId)).count ?? 0 })
    .eq("id", batchId);

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "import_batch_committed",
    entity_type: "import_batch",
    entity_id: batchId,
    metadata: {},
  });

  revalidatePath("/dashboard/imported-records");
  return redirectWithResult(returnTo, "success", "Lote archivado como importado.");
}

export async function resendPaymentReceiptAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard");
  const folioId = String(formData.get("folio_id") ?? "");

  if (!folioId) {
    return redirectWithResult(returnTo, "error", "Folio requerido.");
  }

  const { data: folio } = await supabase
    .from("folios")
    .select("id, folio_code, total_amount, paid_amount, balance_due, payment_status")
    .eq("id", folioId)
    .single();

  if (!folio) {
    return redirectWithResult(returnTo, "error", "Folio no encontrado.");
  }

  const { data: reservationForFolio } = await supabase
    .from("reservations")
    .select(
      "id, check_in_date, check_out_date, nights, discount_percent, reservation_guests(bed_id, locker_number, locker_days, guests(id, full_name, phone), beds(bed_number, zone))",
    )
    .eq("folio_id", folioId)
    .limit(1)
    .maybeSingle();

  if (!reservationForFolio) {
    return redirectWithResult(returnTo, "error", "No se encontró reservación para ese folio.");
  }

  const guestRows = (Array.isArray(reservationForFolio.reservation_guests)
    ? reservationForFolio.reservation_guests
    : []) as ReservationGuestAssignmentRow[];
  const { assignments: paymentAssignments, allBedsAssigned } =
    parseReservationGuestAssignments(guestRows);

  if (!allBedsAssigned) {
    return redirectWithResult(
      returnTo,
      "error",
      "Asigna todas las camas antes de reenviar el comprobante.",
    );
  }

  const recipient = pickWhatsAppRecipient(guestRows);
  if (!recipient) {
    return redirectWithResult(returnTo, "error", "No hay teléfono válido para enviar el comprobante.");
  }

  const guestName = recipient.guest.full_name ?? "Huésped";
  const amount = Number(folio.total_amount ?? folio.paid_amount ?? 0);
  const paid = folio.payment_status === "liquidated";

  const waResult = await deliverWhatsAppReservationReceipt({
    guestPhone: recipient.phone,
    guestName,
    pdf: {
      guestName,
      folioCode: folio.folio_code,
      checkInDate: reservationForFolio.check_in_date,
      checkOutDate: reservationForFolio.check_out_date,
      nights: reservationForFolio.nights,
      guestCount: guestRows.length,
      totalAmount: amount,
      paid,
      assignments: paymentAssignments,
    },
    fallback: {
      folioCode: folio.folio_code,
      amount,
      method: "cash",
      balanceDue: Number(folio.balance_due ?? 0),
      paymentStatus: folio.payment_status,
      checkInDate: reservationForFolio.check_in_date,
      checkOutDate: reservationForFolio.check_out_date,
      nights: reservationForFolio.nights,
      assignments: paymentAssignments,
    },
  });

  await supabase.from("whatsapp_messages").insert({
    guest_id: recipient.guest.id ?? null,
    reservation_id: reservationForFolio.id,
    folio_id: folioId,
    status: waResult.success ? "sent" : "failed",
    phone: recipient.phone,
    payload: {
      folio_code: folio.folio_code,
      amount,
      type: "resend_receipt",
      ycloud_result: waResult,
    },
    delivered_at: waResult.success ? new Date().toISOString() : null,
    error_message: waResult.error ?? null,
  });

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "payment_receipt_resent",
    entity_type: "folio",
    entity_id: folioId,
    metadata: { folio_code: folio.folio_code, phone: recipient.phone, success: waResult.success },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");

  return redirectWithResult(
    returnTo,
    waResult.success ? "success" : "error",
    waResult.success
      ? `Comprobante reenviado a ${recipient.phone} para folio ${folio.folio_code}.`
      : `Error al reenviar comprobante: ${waResult.error ?? "desconocido"}`,
  );
}

export async function getBedReservations(bedId: string) {
  const supabase = createAdminClient();

  const { data: rgRows } = await supabase
    .from("reservation_guests")
    .select("reservation_id, reservations!inner(check_in_date, check_out_date, status, checked_out_at, reservation_guests(guests(full_name)))")
    .eq("bed_id", bedId)
    .not("reservations.status", "in", '("cancelled","checked_out")')
    .is("reservations.checked_out_at", null);

  if (!rgRows?.length) return [];

  const results: Array<{
    checkIn: string;
    checkOut: string;
    guestName: string;
    status: string;
  }> = [];

  for (const rg of rgRows) {
    const res = rg.reservations as unknown as {
      check_in_date: string;
      check_out_date: string;
      status: string;
      reservation_guests: Array<{ guests?: { full_name?: string } }>;
    };
    const mainGuestRow = res.reservation_guests?.[0];
    const guestName = (mainGuestRow?.guests as { full_name?: string } | undefined)?.full_name ?? "Huésped";
    results.push({
      checkIn: res.check_in_date,
      checkOut: res.check_out_date,
      guestName,
      status: res.status,
    });
  }

  return results;
}

export async function getBedsMapForChange() {
  const supabase = createAdminClient();
  const today = getMexicoCityDateString();

  const { data: beds } = await supabase
    .from("beds")
    .select("id, bed_number, zone, status, sort_order")
    .order("sort_order", { ascending: true });

  const { data: rgRows } = await supabase
    .from("reservation_guests")
    .select(
      "bed_id, reservation_id, guests(full_name), reservations!inner(status, checked_out_at, check_in_date, check_out_date)",
    )
    .not("bed_id", "is", null);

  const bedGuestMap = new Map<string, string>();
  for (const rg of rgRows ?? []) {
    const reservation = unwrapAssignmentRelation(rg.reservations) as
      | {
          status?: string;
          checked_out_at?: string | null;
          check_in_date?: string;
          check_out_date?: string;
        }
      | undefined;
    if (
      rg.bed_id &&
      reservation &&
      reservationBlocksDate(reservation, today) &&
      !bedGuestMap.has(rg.bed_id)
    ) {
      const guest = unwrapAssignmentRelation(rg.guests);
      bedGuestMap.set(rg.bed_id, guest?.full_name ?? "Ocupada");
    }
  }

  return (beds ?? []).map((bed) => ({
    id: bed.id,
    bed_number: String(bed.bed_number),
    zone: bed.zone as string,
    status: bed.status,
    occupied_by: bedGuestMap.get(bed.id) ?? null,
  }));
}

export async function reassignBedAction(formData: FormData): Promise<OperationResult> {
  const supabase = createAdminClient();
  const actor = await getActorProfile();
  const actorId = actor?.id ?? null;
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return actionResult("error", "No tienes permiso para asignar camas.");
  }

  const reservationId = String(formData.get("reservation_id") ?? "");
  const guestId = String(formData.get("guest_id") ?? "");
  const newBedId = String(formData.get("new_bed_id") ?? "");

  if (!reservationId || !guestId || !newBedId) {
    return actionResult("error", "Faltan datos para reasignar la cama.");
  }

  const userSupabase = await createClient();
  const { data: assignmentRows, error: assignmentError } = await userSupabase.rpc(
    "reassign_reservation_guest_bed",
    {
      p_reservation_id: reservationId,
      p_guest_id: guestId,
      p_bed_id: newBedId,
    },
  );
  if (assignmentError) {
    return actionResult("error", assignmentError.message);
  }
  const assignmentResult = Array.isArray(assignmentRows) ? assignmentRows[0] : assignmentRows;
  if (!assignmentResult) {
    return actionResult("error", "No se pudo actualizar la asignación de cama.");
  }
  const oldBedNumber = assignmentResult.old_bed_number;
  const newBedNumber = assignmentResult.new_bed_number;

  const { data: newBedRow } = await supabase
    .from("beds")
    .select("bed_number, zone")
    .eq("id", newBedId)
    .maybeSingle();
  const newBedLabel =
    formatBedLabel(newBedRow?.bed_number ?? newBedNumber, newBedRow?.zone) ?? String(newBedNumber);

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "bed_reassigned",
    entity_type: "reservation",
    entity_id: reservationId,
    metadata: {
      guest_id: guestId,
      old_bed: oldBedNumber ?? "Sin cama",
      new_bed: newBedLabel,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/guests");

  return actionResult("success", `Cama cambiada a ${newBedLabel}.`);
}

export async function registerCheckoutAction(formData: FormData): Promise<OperationResult> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return actionResult("error", "No tienes permiso para registrar salidas.");
  }

  const reservationId = String(formData.get("reservation_id") ?? "").trim();
  if (!reservationId) {
    return actionResult("error", "Reservación no indicada.");
  }

  const supabase = createAdminClient();
  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, status, checked_out_at, check_out_date, folio_id, folios(folio_code, balance_due)")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation) {
    return actionResult("error", "Reservación no encontrada.");
  }
  if (reservation.status === "cancelled") {
    return actionResult("error", "Una reservación cancelada no puede registrar salida.");
  }
  if (reservation.checked_out_at || reservation.status === "checked_out") {
    return actionResult("success", "La salida ya estaba registrada.");
  }

  const checkedOutAt = new Date().toISOString();
  const { error } = await supabase
    .from("reservations")
    .update({
      status: "checked_out",
      checked_out_at: checkedOutAt,
      checked_out_by: actor.id,
    })
    .eq("id", reservationId)
    .is("checked_out_at", null);

  if (error) {
    return actionResult("error", "No se pudo registrar la salida.");
  }

  const folio = unwrapAssignmentRelation(reservation.folios) as
    | { folio_code?: string; balance_due?: number }
    | undefined;
  await supabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "reservation_checked_out",
    entity_type: "reservation",
    entity_id: reservationId,
    metadata: {
      scheduled_check_out_date: reservation.check_out_date,
      checked_out_at: checkedOutAt,
      folio_id: reservation.folio_id,
      folio_code: folio?.folio_code ?? null,
      balance_due: Number(folio?.balance_due ?? 0),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/guests");
  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/folios");

  const balanceDue = Number(folio?.balance_due ?? 0);
  return actionResult(
    "success",
    balanceDue > 0
      ? `Estancia cerrada. El saldo de $${balanceDue.toFixed(2)} permanece en el folio.`
      : "Estancia cerrada.",
  );
}

export async function updateBedStatusAction(formData: FormData): Promise<OperationResult> {
  const actor = await getActorProfile();
  const bedId = String(formData.get("bed_id") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim() as BedStatus;

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return actionResult("error", "No tienes permiso para cambiar el estado de camas.");
  }

  if (!bedId || (nextStatus !== "available" && nextStatus !== "blocked")) {
    return actionResult("error", "Estado de cama inválido.");
  }

  const supabase = createAdminClient();
  const { data: bed } = await supabase
    .from("beds")
    .select("id, bed_number, zone, status")
    .eq("id", bedId)
    .maybeSingle();

  if (!bed) {
    return actionResult("error", "Cama no encontrada.");
  }

  const bedLabel = formatBedLabel(bed.bed_number, bed.zone) ?? String(bed.bed_number);

  if (bed.status === nextStatus) {
    return actionResult(
      "success",
      `${bedLabel} ya está ${nextStatus === "blocked" ? "bloqueada" : "disponible"}.`,
    );
  }

  const updatePayload: { status: BedStatus; notes?: string | null } = { status: nextStatus };
  if (nextStatus === "available") {
    updatePayload.notes = null;
  }

  const { error: updateError } = await supabase.from("beds").update(updatePayload).eq("id", bedId);

  if (updateError) {
    return actionResult("error", "No se pudo actualizar el estado de la cama.");
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "bed_status_updated",
    entity_type: "bed",
    entity_id: bedId,
    metadata: {
      bed_number: bed.bed_number,
      zone: bed.zone,
      from: bed.status,
      to: nextStatus,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/beds");

  const message =
    nextStatus === "blocked"
      ? `${bedLabel} bloqueada.`
      : `${bedLabel} disponible en inventario.`;

  return actionResult("success", message);
}

async function syncFolioTotals(supabase: ReturnType<typeof createAdminClient>, folioId: string) {
  const expectedTotal = await getFolioExpectedTotal(supabase, folioId);
  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("folio_id", folioId);

  const paidAmount = Math.max(
    0,
    Number((payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2)),
  );
  const balanceDue = Math.max(0, Number((expectedTotal - paidAmount).toFixed(2)));
  const paymentStatus =
    balanceDue === 0 && paidAmount > 0 ? "liquidated" : paidAmount > 0 ? "partial" : "pending";

  await supabase
    .from("folios")
    .update({
      total_amount: expectedTotal,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      payment_status: paymentStatus,
    })
    .eq("id", folioId);

  return { expectedTotal, balanceDue, paymentStatus };
}

export async function assignLockerAction(formData: FormData): Promise<OperationResult> {
  const supabase = createAdminClient();
  const actor = await getActorProfile();
  const reservationId = String(formData.get("reservation_id") ?? "");
  const guestId = String(formData.get("guest_id") ?? "");
  const wantsLocker = String(formData.get("add_locker") ?? "no") === "yes";
  const lockerNumberRaw = String(formData.get("locker_number") ?? "").trim();
  const lockerDaysRaw = String(formData.get("locker_days") ?? "").trim();

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return actionResult("error", "No autorizado.");
  }

  if (!reservationId || !guestId) {
    return actionResult("error", "Faltan datos para asignar el locker.");
  }

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, folio_id, nights, discount_percent, check_in_date, check_out_date, status, checked_out_at")
    .eq("id", reservationId)
    .single();

  if (!reservation?.folio_id) {
    return actionResult("error", "Reservación no encontrada.");
  }
  if (reservation.checked_out_at || ["cancelled", "checked_out"].includes(reservation.status)) {
    return actionResult("error", "La estancia ya está cerrada y solo se conserva como historial.");
  }

  const { data: currentRg } = await supabase
    .from("reservation_guests")
    .select("locker_number, locker_days, locker_price, locker_amount")
    .eq("reservation_id", reservationId)
    .eq("guest_id", guestId)
    .single();

  if (!currentRg) {
    return actionResult("error", "Huésped no encontrado en la reservación.");
  }

  const nights = Math.max(1, Number(reservation.nights ?? 1));
  const discountPercent = Number(reservation.discount_percent ?? 0);
  const prices = await getServicePrices();
  const lockerPriceWithDiscount = Math.round(prices.guest_locker_day * (100 - discountPercent)) / 100;

  let locker_days = Number(currentRg.locker_days ?? 0);
  let locker_price = Number(currentRg.locker_price ?? 0);
  let locker_amount = Number(currentRg.locker_amount ?? 0);
  let locker_number: string | null = normalizeLockerCode(currentRg.locker_number);

  if (wantsLocker) {
    const requestedDays = lockerDaysRaw ? Number(lockerDaysRaw) : locker_days || nights;
    locker_days = Math.min(Math.max(1, requestedDays), nights);
    locker_price = lockerPriceWithDiscount;
    locker_amount = Number((locker_days * locker_price).toFixed(2));
    if (lockerNumberRaw && !normalizeLockerCode(lockerNumberRaw)) {
      return actionResult(
        "error",
        "Código de locker inválido. Usa letras y/o números (ej. 12, A1, B-3).",
      );
    }
    locker_number = normalizeLockerCode(lockerNumberRaw);

    if (locker_number != null) {
      const { data: conflicting } = await supabase
        .from("reservation_guests")
        .select(
          "reservation_id, reservations!inner(check_in_date, check_out_date, status, checked_out_at)",
        )
        .eq("locker_number", locker_number)
        .neq("reservation_id", reservationId);

      for (const row of conflicting ?? []) {
        const overlap = row.reservations as unknown as {
          check_in_date: string;
          check_out_date: string;
          status: string;
          checked_out_at: string | null;
        };
        if (
          overlap.checked_out_at ||
          ["cancelled", "checked_out"].includes(overlap.status)
        ) continue;
        if (
          overlap.check_in_date < reservation.check_out_date &&
          overlap.check_out_date > reservation.check_in_date
        ) {
          return actionResult("error", `El locker ${locker_number} ya está asignado en esas fechas.`);
        }
      }
    }
  } else {
    locker_days = 0;
    locker_price = 0;
    locker_amount = 0;
    locker_number = null;
  }

  const { error: updateError } = await supabase
    .from("reservation_guests")
    .update({
      locker_number,
      locker_days,
      locker_price,
      locker_amount,
    })
    .eq("reservation_id", reservationId)
    .eq("guest_id", guestId);

  if (updateError) {
    return actionResult("error", "No se pudo actualizar el locker.");
  }

  await syncFolioTotals(supabase, reservation.folio_id);

  await supabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "locker_assigned",
    entity_type: "reservation",
    entity_id: reservationId,
    metadata: {
      guest_id: guestId,
      locker_number,
      locker_days,
      locker_amount,
      add_locker: wantsLocker,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/guests");

  const successMessage = wantsLocker
    ? locker_number
      ? `Locker ${locker_number} asignado.`
      : "Servicio de locker registrado (número pendiente)."
    : "Locker removido de la reservación.";

  return actionResult("success", successMessage);
}

export async function updateReceptionGuestAction(formData: FormData): Promise<OperationResult> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return actionResult("error", "No autorizado.");
  }

  const reservationId = String(formData.get("reservation_id") ?? "").trim();
  const guestId = String(formData.get("guest_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const newBedId = String(formData.get("bed_id") ?? "").trim();
  const lockerNumberRaw = String(formData.get("locker_number") ?? "").trim();

  if (!reservationId || !guestId) {
    return actionResult("error", "Faltan datos del huésped.");
  }
  if (!fullName) {
    return actionResult("error", "El nombre es obligatorio.");
  }
  if (phoneRaw && !isCompleteMexicanPhone(phoneRaw)) {
    return actionResult("error", "El teléfono debe tener 10 dígitos o quedar vacío.");
  }

  const supabase = createAdminClient();
  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, folio_id, status, checked_out_at, check_in_date, check_out_date")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation) {
    return actionResult("error", "Reservación no encontrada.");
  }
  if (reservation.status === "cancelled") {
    return actionResult("error", "No se puede editar una reservación cancelada.");
  }

  const { data: currentRg } = await supabase
    .from("reservation_guests")
    .select("id, bed_id, locker_number, locker_days")
    .eq("reservation_id", reservationId)
    .eq("guest_id", guestId)
    .maybeSingle();

  if (!currentRg) {
    return actionResult("error", "Huésped no encontrado en la reservación.");
  }

  const stayClosed = Boolean(reservation.checked_out_at) || reservation.status === "checked_out";
  const messages: string[] = [];

  if (!stayClosed) {
    if (newBedId && newBedId !== String(currentRg.bed_id ?? "")) {
      formData.set("new_bed_id", newBedId);
      const bedResult = await reassignBedAction(formData);
      if (bedResult.status === "error") {
        return bedResult;
      }
      messages.push(bedResult.message);
    }

    const nextLocker = lockerNumberRaw ? normalizeLockerCode(lockerNumberRaw) : null;
    if (lockerNumberRaw && !nextLocker) {
      return actionResult(
        "error",
        "Código de locker inválido. Usa letras y/o números (ej. 12, A1, B-3).",
      );
    }

    const currentLocker = normalizeLockerCode(currentRg.locker_number);
    if (nextLocker !== currentLocker) {
      if (nextLocker) {
        const { data: conflicting } = await supabase
          .from("reservation_guests")
          .select(
            "id, reservations!inner(check_in_date, check_out_date, status, checked_out_at)",
          )
          .eq("locker_number", nextLocker)
          .neq("id", currentRg.id);

        for (const row of conflicting ?? []) {
          const overlap = unwrapAssignmentRelation(row.reservations) as
            | {
                check_in_date?: string;
                check_out_date?: string;
                status?: string;
                checked_out_at?: string | null;
              }
            | undefined;
          if (
            !overlap ||
            overlap.checked_out_at ||
            ["cancelled", "checked_out"].includes(overlap.status ?? "")
          ) {
            continue;
          }
          if (
            overlap.check_in_date &&
            overlap.check_out_date &&
            overlap.check_in_date < reservation.check_out_date &&
            overlap.check_out_date > reservation.check_in_date
          ) {
            return actionResult("error", `El locker ${nextLocker} ya está asignado en esas fechas.`);
          }
        }
      }

      const { error: lockerError } = await supabase
        .from("reservation_guests")
        .update({ locker_number: nextLocker })
        .eq("id", currentRg.id);

      if (lockerError) {
        return actionResult("error", "No se pudo actualizar el locker.");
      }
      messages.push(nextLocker ? `Locker ${nextLocker} asignado.` : "Locker quitado.");
    }
  }

  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const { error: guestError } = await supabase
    .from("guests")
    .update({
      full_name: fullName,
      phone: phone || null,
      normalized_name: normalizeName(fullName),
      normalized_phone: phone || null,
    })
    .eq("id", guestId);

  if (guestError) {
    return actionResult("error", "No se pudo actualizar el nombre o teléfono.");
  }
  messages.unshift("Datos del huésped actualizados.");

  await supabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "reception_guest_updated",
    entity_type: "guest",
    entity_id: guestId,
    metadata: {
      reservation_id: reservationId,
      full_name: fullName,
      phone: phone || null,
      bed_id: newBedId || currentRg.bed_id,
      locker_number: lockerNumberRaw || null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/guests");
  revalidatePath("/dashboard/beds");

  return actionResult("success", messages.join(" "));
}

function deriveAnomalyFlagsForRecord(record: {
  bed_amount_written: number | null;
  bed_amount_calculated: number | null;
  locker_amount_written: number | null;
  locker_amount_calculated: number | null;
  total_written: number | null;
  total_calculated: number | null;
  bed_number: number | null;
  check_in_date: string | null;
  check_out_date: string | null;
  locker_number: number | null;
}): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  if (record.bed_amount_written !== null && Math.abs((record.bed_amount_written ?? 0) - (record.bed_amount_calculated ?? 0)) > 0.009) {
    flags.push("BED_AMOUNT_MISMATCH");
  }
  if (record.locker_amount_written !== null && Math.abs((record.locker_amount_written ?? 0) - (record.locker_amount_calculated ?? 0)) > 0.009) {
    flags.push("LOCKER_AMOUNT_MISMATCH");
  }
  if (record.total_written !== null && Math.abs((record.total_written ?? 0) - (record.total_calculated ?? 0)) > 0.009) {
    flags.push("TOTAL_MISMATCH");
  }
  if (record.total_written === null) flags.push("MISSING_TOTAL");
  if (record.bed_number === null) flags.push("MISSING_BED");
  if (record.check_in_date && record.check_out_date && record.check_out_date <= record.check_in_date) flags.push("INVALID_DATE_RANGE");
  if (record.locker_number !== null && (record.locker_amount_written === null || record.locker_amount_written === 0)) {
    flags.push("LOCKER_NUMBER_WITHOUT_CHARGE");
  }
  if (record.locker_number === null && record.locker_amount_written !== null && record.locker_amount_written > 0) {
    flags.push("LOCKER_CHARGE_WITHOUT_LOCKER_NUMBER");
  }
  if (flags.length > 0 && !flags.includes("NEEDS_MANUAL_REVIEW")) flags.push("NEEDS_MANUAL_REVIEW");
  return [...new Set(flags)];
}

async function recalculateImportedRecordInternal({
  supabase,
  recordId,
  actorId,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  recordId: string;
  actorId: string | null;
}) {
  const { data: record } = await supabase
    .from("imported_records")
    .select("id, nights, bed_price, locker_days, locker_price, bed_amount_written, locker_amount_written, total_written, bed_number, check_in_date, check_out_date, locker_number")
    .eq("id", recordId)
    .single();
  if (!record) return { ok: false as const, anomalyCount: 0 };

  const { data: extraRows } = await supabase
    .from("imported_record_extra_services")
    .select("amount")
    .eq("imported_record_id", recordId);
  const extraTotal = (extraRows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const bedCalc = Number(record.nights ?? 0) * Number(record.bed_price ?? 0);
  const lockerCalc = Number(record.locker_days ?? 0) * Number(record.locker_price ?? 0);
  const totalCalc = bedCalc + lockerCalc + extraTotal;
  const anomalyFlags = deriveAnomalyFlagsForRecord({
    bed_amount_written: record.bed_amount_written,
    bed_amount_calculated: bedCalc,
    locker_amount_written: record.locker_amount_written,
    locker_amount_calculated: lockerCalc,
    total_written: record.total_written,
    total_calculated: totalCalc,
    bed_number: record.bed_number,
    check_in_date: record.check_in_date,
    check_out_date: record.check_out_date,
    locker_number: record.locker_number,
  });

  await supabase
    .from("imported_records")
    .update({
      bed_amount_calculated: bedCalc,
      locker_amount_calculated: lockerCalc,
      extra_services_total: extraTotal,
      total_calculated: totalCalc,
      bed_amount_difference: Number(record.bed_amount_written ?? 0) - bedCalc,
      locker_amount_difference: Number(record.locker_amount_written ?? 0) - lockerCalc,
      total_difference: Number(record.total_written ?? 0) - totalCalc,
      needs_review: anomalyFlags.length > 0,
    })
    .eq("id", recordId);

  await supabase.from("imported_record_anomalies").delete().eq("imported_record_id", recordId);
  if (anomalyFlags.length) {
    await supabase.from("imported_record_anomalies").insert(
      anomalyFlags.map((flag) => ({ imported_record_id: recordId, flag, message: `Detected ${flag} during recalculation` })),
    );
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "import_record_recalculated",
    entity_type: "imported_record",
    entity_id: recordId,
    metadata: { anomaly_count: anomalyFlags.length },
  });
  return { ok: true as const, anomalyCount: anomalyFlags.length };
}

export async function recalculateImportedRecordAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/imported-records");
  const recordId = String(formData.get("record_id") ?? "");
  if (!recordId) return redirectWithResult(returnTo, "error", "Registro no especificado.");
  const result = await recalculateImportedRecordInternal({ supabase, recordId, actorId });
  if (!result.ok) return redirectWithResult(returnTo, "error", "Registro no encontrado.");

  revalidatePath("/dashboard/imported-records");
  return redirectWithResult(returnTo, "success", "Registro recalculado.");
}

export async function updateImportedRecordAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/imported-records");
  const recordId = String(formData.get("record_id") ?? "");
  if (!recordId) return redirectWithResult(returnTo, "error", "Registro no especificado.");

  const guestName = String(formData.get("guest_name") ?? "").trim() || null;
  const bedNumberRaw = String(formData.get("bed_number") ?? "").trim();
  const bedNumber = bedNumberRaw ? Number(bedNumberRaw) : null;
  const nightsRaw = String(formData.get("nights") ?? "").trim();
  const nights = nightsRaw ? Number(nightsRaw) : null;
  const bedPriceRaw = String(formData.get("bed_price") ?? "").trim();
  const bedPrice = bedPriceRaw ? Number(bedPriceRaw) : null;
  const lockerNumberRaw = String(formData.get("locker_number") ?? "").trim();
  const lockerNumber = lockerNumberRaw ? Number(lockerNumberRaw) : null;
  const lockerDaysRaw = String(formData.get("locker_days") ?? "").trim();
  const lockerDays = lockerDaysRaw ? Number(lockerDaysRaw) : null;
  const lockerPriceRaw = String(formData.get("locker_price") ?? "").trim();
  const lockerPrice = lockerPriceRaw ? Number(lockerPriceRaw) : null;
  const totalWrittenRaw = String(formData.get("total_written") ?? "").trim();
  const totalWritten = totalWrittenRaw ? Number(totalWrittenRaw) : null;

  await supabase
    .from("imported_records")
    .update({
      guest_name: guestName,
      bed_number: bedNumber,
      nights,
      bed_price: bedPrice,
      locker_number: lockerNumber,
      locker_days: lockerDays,
      locker_price: lockerPrice,
      total_written: totalWritten,
    })
    .eq("id", recordId);

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "import_record_updated",
    entity_type: "imported_record",
    entity_id: recordId,
    metadata: {},
  });

  await recalculateImportedRecordInternal({ supabase, recordId, actorId });
  revalidatePath("/dashboard/imported-records");
  return redirectWithResult(returnTo, "success", "Registro actualizado y recalculado.");
}

export async function addImportedRecordExtraServiceAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/imported-records");
  const importedRecordId = String(formData.get("imported_record_id") ?? "");
  const serviceName = String(formData.get("service_name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!importedRecordId || !serviceName || amount < 0) {
    return redirectWithResult(returnTo, "error", "Datos inválidos para extra service de histórico.");
  }

  await supabase.from("imported_record_extra_services").insert({
    imported_record_id: importedRecordId,
    service_name: serviceName,
    amount,
    notes: notes || null,
    created_by: actorId,
  });

  await recalculateImportedRecordInternal({ supabase, recordId: importedRecordId, actorId });
  revalidatePath("/dashboard/imported-records");
  return redirectWithResult(returnTo, "success", "Extra service agregado al registro histórico.");
}

export async function addFolioExtraServiceAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/folios");
  const folioId = String(formData.get("folio_id") ?? "");
  const serviceName = String(formData.get("service_name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!folioId || !serviceName || amount < 0) {
    return redirectWithResult(returnTo, "error", "Datos inválidos para extra service.");
  }

  await supabase.from("folio_extra_services").insert({
    folio_id: folioId,
    service_name: serviceName,
    amount,
    notes: notes || null,
    created_by: actorId,
  });

  const expectedTotal = await getFolioExpectedTotal(supabase, folioId);
  const { data: folio } = await supabase
    .from("folios")
    .select("paid_amount")
    .eq("id", folioId)
    .single();
  const paid = Number(folio?.paid_amount ?? 0);
  const balance = Math.max(0, expectedTotal - paid);
  const paymentStatus = balance === 0 ? "liquidated" : paid > 0 ? "partial" : "pending";

  await supabase
    .from("folios")
    .update({
      total_amount: expectedTotal,
      balance_due: balance,
      payment_status: paymentStatus,
    })
    .eq("id", folioId);

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "folio_extra_service_added",
    entity_type: "folio",
    entity_id: folioId,
    metadata: { service_name: serviceName, amount },
  });

  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/payments");
  return redirectWithResult(returnTo, "success", "Extra service agregado al folio.");
}

async function fetchReceptionReservationsByIds(
  supabase: ReturnType<typeof createAdminClient>,
  reservationIds: string[],
): Promise<ReceptionSearchResult[]> {
  if (reservationIds.length === 0) return [];

  const { data } = await supabase
    .from("reservations")
    .select(RECEPTION_RESERVATION_SELECT)
    .in("id", reservationIds)
    .not("status", "in", '("cancelled","checked_out")')
    .is("checked_out_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? [])
    .map((row) => mapReservationToReceptionSearch(row))
    .filter((row): row is ReceptionSearchResult => row != null);
}

export async function searchReservationsForReceptionAction(query: string): Promise<{
  success: boolean;
  results: ReceptionSearchResult[];
  message?: string;
}> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { success: false, results: [], message: "No autorizado." };
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { success: true, results: [], message: "Escribe al menos 2 caracteres." };
  }

  const supabase = createAdminClient();
  const safe = escapeIlike(trimmed);
  const reservationIds = new Set<string>();

  const { data: byFolio } = await supabase
    .from("reservations")
    .select(RECEPTION_RESERVATION_SELECT)
    .not("status", "in", '("cancelled","checked_out")')
    .is("checked_out_at", null)
    .ilike("folios.folio_code", `%${safe}%`)
    .limit(10);

  for (const row of byFolio ?? []) {
    reservationIds.add(row.id);
  }

  const normalizedPhone = normalizeMexicanPhone(trimmed);
  let guestFilter = `full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`;
  if (normalizedPhone) {
    guestFilter += `,normalized_phone.eq.${normalizedPhone}`;
  }

  const { data: matchingGuests } = await supabase.from("guests").select("id").or(guestFilter).limit(20);

  const guestIds = (matchingGuests ?? []).map((g) => g.id).filter(Boolean);
  if (guestIds.length > 0) {
    const { data: guestReservations } = await supabase
      .from("reservation_guests")
      .select("reservation_id, reservations!inner(status)")
      .in("guest_id", guestIds)
      .not("reservations.status", "in", '("cancelled","checked_out")')
      .limit(20);

    for (const row of guestReservations ?? []) {
      if (row.reservation_id) reservationIds.add(row.reservation_id);
    }
  }

  const results = await fetchReceptionReservationsByIds(supabase, Array.from(reservationIds));
  return { success: true, results };
}

export async function listRecentReservationsForReceptionAction(
  limit = 20,
): Promise<{
  success: boolean;
  results: ReceptionSearchResult[];
  message?: string;
}> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { success: false, results: [], message: "No autorizado." };
  }

  const safeLimit = normalizeRecentReservationLimit(limit);
  const supabase = createAdminClient();
  const results = await fetchRecentReceptionReservations(supabase, safeLimit);
  return { success: true, results };
}

export async function getReceptionReservationDetailAction(
  reservationId: string,
): Promise<{ success: boolean; result?: ReceptionSearchResult; message?: string }> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { success: false, message: "No autorizado." };
  }

  if (!reservationId) {
    return { success: false, message: "Reservación no indicada." };
  }

  const supabase = createAdminClient();
  const results = await fetchReceptionReservationsByIds(supabase, [reservationId]);
  const result = results[0];
  if (!result) {
    return { success: false, message: "No se encontró la reservación." };
  }

  return { success: true, result };
}

export async function completeReceptionCheckInAction(formData: FormData): Promise<ReceptionCheckInResult> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { ok: false, message: "No autorizado." };
  }

  const folioId = String(formData.get("folio_id") ?? "");
  const folioCode = String(formData.get("folio_code") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const notes =
    String(formData.get("notes") ?? "").trim() ||
    `Cobro recepción - Folio ${folioCode || folioId}`;

  if (!folioId) {
    return { ok: false, message: "Folio no indicado." };
  }

  const supabase = createAdminClient();
  const { data: reservation } = await supabase
    .from("reservations")
    .select(RECEPTION_RESERVATION_SELECT)
    .eq("folio_id", folioId)
    .not("status", "in", '("cancelled","checked_out")')
    .is("checked_out_at", null)
    .maybeSingle();

  const mapped = reservation ? mapReservationToReceptionSearch(reservation) : null;
  if (!mapped) {
    return { ok: false, message: "No se encontró la reservación." };
  }

  if (!mapped.allBedsAssigned) {
    return { ok: false, message: "Asigna todas las camas antes de confirmar." };
  }

  if (!mapped.allLockersAssigned) {
    return { ok: false, message: "Asigna todos los lockers pendientes antes de confirmar." };
  }

  if (mapped.balanceDue <= 0 || mapped.paymentStatus === "liquidated") {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reservations");
    revalidatePath("/dashboard/beds");
    return {
      ok: true,
      message: "Asignación completada. No hay saldo pendiente.",
      newStatus: mapped.paymentStatus === "liquidated" ? "liquidated" : "pending",
      balanceDue: mapped.balanceDue,
      folioCode: mapped.folioCode,
      folioId: mapped.folioId,
      whatsappSent: false,
      skippedPayment: true,
    };
  }

  if (amount <= 0) {
    return { ok: false, message: "Indica el monto recibido." };
  }

  const paymentResult = await registerPaymentCore({
    folioId,
    amount,
    method,
    effectiveDate: String(formData.get("effective_date") ?? getMexicoCityDateString()),
    notes,
  });

  if (!paymentResult.ok) {
    return { ok: false, message: paymentResult.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/beds");

  return {
    ok: true,
    message: paymentResult.message,
    newStatus: paymentResult.newStatus,
    balanceDue: paymentResult.balanceDue,
    folioCode: paymentResult.folioCode,
    folioId: paymentResult.folioId,
    whatsappSent: paymentResult.whatsappSent,
  };
}

/**
 * Consulta descuentos aplicables para una fecha de check-in y teléfono de huésped.
 * Retorna el mejor descuento encontrado (mayor porcentaje).
 */
export async function getApplicableDiscountsAction(checkInDate: string, guestPhone?: string) {
  "use server";
  const { getApplicableDiscounts, getBestDiscount } = await import("@/lib/discount-rules");
  const discounts = await getApplicableDiscounts(checkInDate, guestPhone);
  return getBestDiscount(discounts);
}

/**
 * Valida un código de descuento promo sin canjearlo.
 * Retorna los datos del código si es válido.
 */
export async function validatePromoCodeAction(code: string) {
  "use server";
  const { validatePromoCode } = await import("@/lib/promo-codes");
  return validatePromoCode(code);
}

export async function getBedsForStayRangeAction(
  checkInDate: string,
  checkOutDate: string,
) {
  await requireRole(["admin", "reception"]);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate) ||
    checkOutDate <= checkInDate
  ) {
    return [];
  }

  const supabase = createAdminClient();
  const [{ data: beds }, { data: assignments }] = await Promise.all([
    supabase
      .from("beds")
      .select("id, bed_number, zone, status, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("reservation_guests")
      .select(
        "bed_id, guests(full_name), reservations!inner(status, checked_out_at, check_in_date, check_out_date)",
      )
      .not("bed_id", "is", null),
  ]);

  const occupied = new Map<string, string>();
  for (const assignment of assignments ?? []) {
    if (!assignment.bed_id || occupied.has(assignment.bed_id)) continue;
    const reservation = unwrapAssignmentRelation(assignment.reservations) as
      | {
          status?: string;
          checked_out_at?: string | null;
          check_in_date?: string;
          check_out_date?: string;
        }
      | undefined;
    if (
      !reservation ||
      reservation.checked_out_at ||
      ["cancelled", "checked_out"].includes(reservation.status ?? "") ||
      !reservation.check_in_date ||
      !reservation.check_out_date ||
      reservation.check_in_date >= checkOutDate ||
      checkInDate >= reservation.check_out_date
    ) {
      continue;
    }
    const guest = unwrapAssignmentRelation(assignment.guests);
    occupied.set(assignment.bed_id, guest?.full_name ?? "Ocupada");
  }

  return (beds ?? []).map((bed) => ({
    id: bed.id,
    bed_number: String(bed.bed_number),
    zone: String(bed.zone ?? "mixta"),
    status: String(bed.status),
    occupied_by: occupied.get(bed.id) ?? null,
  }));
}

export type RegisterStaffStayResult =
  | {
      ok: true;
      message: string;
      reservationId: string;
      folioId: string;
      folioCode: string;
    }
  | { ok: false; message: string };

export async function registerStaffStayAction(
  formData: FormData,
): Promise<RegisterStaffStayResult> {
  await requireRole(["admin", "reception"]);

  const submissionId = String(formData.get("submission_id") ?? "").trim();
  const mode = String(formData.get("mode") ?? "") as StayRegistrationMode;
  const checkInDate = String(formData.get("check_in_date") ?? "");
  const checkOutDate = String(formData.get("check_out_date") ?? "");
  const today = getMexicoCityDateString();
  const dateError = ["new", "current", "finished"].includes(mode)
    ? validateStayDates(mode, checkInDate, checkOutDate, today)
    : "Tipo de estancia no válido.";

  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return { ok: false, message: "No se pudo identificar este registro. Recarga e intenta de nuevo." };
  }
  if (dateError) return { ok: false, message: dateError };

  let guests: unknown;
  try {
    guests = JSON.parse(String(formData.get("guests_data") ?? "[]"));
  } catch {
    return { ok: false, message: "La lista de huéspedes no es válida." };
  }
  if (!Array.isArray(guests) || guests.length === 0) {
    return { ok: false, message: "Captura al menos un huésped." };
  }

  const totalAmount = Number(formData.get("total_amount") ?? 0);
  const paymentAmount = Number(formData.get("payment_amount") ?? 0);
  const discountPercent = Number(formData.get("discount_percent") ?? 0);
  if (
    !Number.isFinite(totalAmount) ||
    totalAmount < 0 ||
    !Number.isFinite(paymentAmount) ||
    paymentAmount < 0 ||
    paymentAmount > totalAmount ||
    !Number.isFinite(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    return { ok: false, message: "Revisa los totales, el descuento y el pago." };
  }

  const paymentDate = String(formData.get("payment_date") ?? "");
  if (paymentAmount > 0 && (!paymentDate || paymentDate > today)) {
    return { ok: false, message: "La fecha real del pago es obligatoria y no puede ser futura." };
  }

  const payload = {
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    folio_code: String(formData.get("folio_code") ?? "").trim().toUpperCase() || null,
    total_amount: totalAmount,
    discount_percent: discountPercent,
    payment_amount: paymentAmount,
    payment_method: String(formData.get("payment_method") ?? "cash"),
    payment_date: paymentAmount > 0 ? paymentDate : null,
    payment_notes: String(formData.get("payment_notes") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    guests,
  };

  const userSupabase = await createClient();
  const { data, error } = await userSupabase.rpc("register_staff_stay", {
    p_submission_id: submissionId,
    p_mode: mode,
    p_payload: payload,
  });
  if (error) {
    console.error("[registerStaffStayAction] RPC failed:", error);
    return {
      ok: false,
      message: error.code === "23505" ? "Ese folio ya existe." : error.message,
    };
  }

  const result = (data ?? {}) as {
    reservation_id?: string;
    folio_id?: string;
    folio_code?: string;
  };
  if (!result.reservation_id || !result.folio_id || !result.folio_code) {
    return { ok: false, message: "La base de datos no confirmó el registro." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/register-stay");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/guests");

  const modeLabel =
    mode === "new"
      ? "Nueva estancia"
      : mode === "current"
        ? "Estancia en curso"
        : "Estancia terminada";
  return {
    ok: true,
    message: `${modeLabel} registrada con folio ${result.folio_code}.`,
    reservationId: result.reservation_id,
    folioId: result.folio_id,
    folioCode: result.folio_code,
  };
}

/**
 * Hard-delete a guest and their exclusive stays/folios/payments (admin only).
 * Used while loading real + test data so finance totals stay accurate.
 */
export async function deleteGuestAction(formData: FormData): Promise<void> {
  await requireRole(["admin"]);

  const guestId = String(formData.get("guest_id") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/guests");

  if (!guestId) {
    return redirectWithResult(returnTo, "error", "Huésped no especificado.");
  }

  const userSupabase = await createClient();
  const { data, error } = await userSupabase.rpc("admin_delete_guest", {
    p_guest_id: guestId,
  });

  if (error) {
    return redirectWithResult(returnTo, "error", error.message);
  }

  const result = (data ?? {}) as {
    full_name?: string;
    folios_deleted?: number;
    payments_deleted?: number;
  };
  const name = result.full_name?.trim() || "Huésped";
  const folios = Number(result.folios_deleted ?? 0);
  const payments = Number(result.payments_deleted ?? 0);
  const detail =
    folios > 0
      ? ` Se eliminaron ${folios} folio(s) y ${payments} pago(s).`
      : "";

  revalidatePath("/dashboard/guests");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");

  return redirectWithResult(returnTo, "success", `${name} eliminado.${detail}`);
}
