"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AnomalyFlag,
  CashMovementCategory,
  CashMovementDirection,
  ExpenseConcept,
  PaymentMethod,
} from "@/types/domain";
import { EXPENSE_CONCEPTS } from "@/lib/expense-concepts";
import { getMexicoCityDateString } from "@/lib/dates";
import { parseTsvToRows } from "@/lib/imports/tsv";
import { sendWhatsAppTemplateMessage, sendWhatsAppDocument, buildPaymentConfirmationMessage } from "@/lib/ycloud";
import { generatePaymentConfirmationPdf } from "@/lib/payment-pdf";
import type { CreateGuestReservationResult, GuestConfirmationPayload } from "@/lib/guest-reservation-confirmation";

const BASE_NIGHTLY_RATE = 120;
const LOCKER_DAILY_PRICE = 30;

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

function buildRedirectPath(basePath: string, status: "success" | "error", message: string) {
  const safeBase = basePath.startsWith("/") ? basePath : "/";
  const [pathWithoutHash, hash = ""] = safeBase.split("#");
  const joiner = pathWithoutHash.includes("?") ? "&" : "?";
  const queryPart = `${pathWithoutHash}${joiner}status=${status}&message=${encodeURIComponent(message)}`;
  return hash ? `${queryPart}#${hash}` : queryPart;
}

function redirectWithResult(basePath: string, status: "success" | "error", message: string): never {
  redirect(buildRedirectPath(basePath, status, message));
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
  const { data: allBeds } = await supabase.from("beds").select("id, bed_number, status").order("bed_number");

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
    .select("id, check_in_date, check_out_date, status")
    .neq("status", "cancelled");

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
  console.log("[pickAvailableBeds] Free beds:", freeBeds.length, freeBeds.map(b => `Cama ${b.bed_number}`));

  return freeBeds.slice(0, count).map(b => b.id);
}

export async function searchGuestByPhoneAction(phoneRaw: string) {
  let phone = phoneRaw.replace(/\D/g, "");
  if (phone.startsWith("52") && phone.length === 12) {
    phone = phone.slice(2);
  }

  if (!phone) return { success: false, guest: null };

  const supabase = createAdminClient();
  const { data: guest } = await supabase
    .from("guests")
    .select("full_name, email, phone, sex")
    .eq("normalized_phone", phone)
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
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/");
  const requestedSource = String(formData.get("reservation_source") ?? "").trim();

  const guestsJson = String(formData.get("guests_data") ?? "[]");
  let guests: {
    full_name: string;
    phone: string;
    email: string;
    sex: string;
    add_locker?: string;
    locker_days?: number;
  }[] = [];
  try {
    guests = JSON.parse(guestsJson);
  } catch (e) {}

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
  const bedIds = await pickAvailableBeds({ count: guests.length, checkInDate, checkOutDate });

  if (bedIds.length < guests.length) {
    return reservationFlowError(
      formData,
      returnTo,
      `Solo hay ${bedIds.length} camas disponibles para esas fechas.`,
    );
  }

  const guestIds: string[] = [];

  for (const guest of guests) {
    const fullName = guest.full_name.trim();
    const phone = normalizePhone(guest.phone);
    const email = guest.email.trim().toLowerCase();
    const sex = guest.sex || "unknown";

    if (!fullName || !phone) continue;

    const { data: existingGuest } = await supabase
      .from("guests")
      .select("id")
      .eq("normalized_phone", phone)
      .maybeSingle();

    if (existingGuest) {
      guestIds.push(existingGuest.id);
      await supabase
        .from("guests")
        .update({
          full_name: fullName,
          email,
          sex,
          normalized_name: normalizeName(fullName),
        })
        .eq("id", existingGuest.id);
    } else {
      const { data: newGuest, error: guestError } = await supabase
        .from("guests")
        .insert({
          full_name: fullName,
          phone,
          email,
          sex,
          normalized_name: normalizeName(fullName),
          normalized_phone: phone,
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
  const nightlyRate = BASE_NIGHTLY_RATE;
  const discountRuleId = String(formData.get("discount_rule_id") ?? "") || null;
  const discountPercent = Number(formData.get("discount_percent") ?? 0) || 0;
  const discountAmountPerNight = Math.round(nightlyRate * discountPercent) / 100;
  const finalRate = nightlyRate - discountAmountPerNight;

  const lockerByGuest = guests.slice(0, guestIds.length).map((guest) => {
    const wantsLocker = guest.add_locker === "yes";
    if (!wantsLocker) {
      return { locker_days: 0, locker_price: 0, locker_amount: 0 };
    }
    const requestedDays = Number(guest.locker_days ?? nights);
    const locker_days = Math.min(Math.max(1, requestedDays), nights);
    return {
      locker_days,
      locker_price: LOCKER_DAILY_PRICE,
      locker_amount: locker_days * LOCKER_DAILY_PRICE,
    };
  });

  const lockerTotal = lockerByGuest.reduce((sum, row) => sum + row.locker_amount, 0);
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

  const reservationSource =
    requestedSource === "cashier_counter" || (actorId && requestedSource !== "guest_app")
      ? "cashier_counter"
      : "guest_app";

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .insert({
      folio_id: folio.id,
      created_by: actorId,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      check_in_at: `${checkInDate}T15:00:00`,
      check_out_at: `${checkOutDate}T12:00:00`,
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
      bed_id: bedIds[i],
      nightly_rate: nightlyRate,
      discount_amount: discountAmountPerNight,
      final_rate: finalRate,
      locker_number: null,
      locker_price: locker.locker_price,
      locker_days: locker.locker_days,
      locker_amount: locker.locker_amount,
      social_bonus_status: "captured",
    };
  });

  const { error: guestReservationError } = await supabase.from("reservation_guests").insert(guestInserts);

  if (guestReservationError) {
    return reservationFlowError(formData, returnTo, "No se pudo guardar la asignación de camas.");
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
        auto_assign: true,
        nights,
        total_amount: totalAmount,
        locker_total: lockerTotal,
        reservation_source: reservationSource,
        discount_rule_id: discountRuleId,
        discount_percent: discountPercent,
      },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/beds");

  const bedSubtotal = finalRate * nights * guestIds.length;

  if (reservationSource === "guest_app") {
    const { data: bedsData } = await supabase.from("beds").select("id, bed_number").in("id", bedIds);
    const bedNumberById = new Map((bedsData ?? []).map((bed) => [bed.id, bed.bed_number]));

    const confirmationPayload: GuestConfirmationPayload = {
      folio: folioCode,
      check_in: checkInDate,
      check_out: checkOutDate,
      nights,
      bed_subtotal: bedSubtotal,
      locker_total: lockerTotal,
      total_amount: totalAmount,
      discount_percent: discountPercent > 0 ? discountPercent : undefined,
      discount_amount: discountPercent > 0 ? (nightlyRate * guestIds.length * nights) - bedSubtotal : undefined,
      original_total: discountPercent > 0 ? (nightlyRate * guestIds.length * nights) + lockerTotal : undefined,
      notes: notes || undefined,
      guests: guests.slice(0, guestIds.length).map((guest, index) => ({
        full_name: guest.full_name.trim(),
        phone: guest.phone.trim(),
        email: guest.email.trim(),
        locker_days: lockerByGuest[index]?.locker_days ?? 0,
        locker_amount: lockerByGuest[index]?.locker_amount ?? 0,
        bed_number: bedNumberById.get(bedIds[index]),
      })),
    };

    return { ok: true, confirmation: confirmationPayload };
  }

  return redirectWithResult(returnTo, "success", `Reserva registrada. Folio ${folioCode}.`);
}

export async function registerPaymentAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actor = await getActorProfile();
  const actorId = actor?.id ?? null;
  const returnTo = String(formData.get("return_to") ?? "/dashboard/payments");
  const folioId = String(formData.get("folio_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const notes = String(formData.get("notes") ?? "");
  const isOverride = String(formData.get("admin_override") ?? "") === "on";
  const overrideReason = String(formData.get("override_reason") ?? "").trim();

  if (!folioId || amount <= 0) {
    return redirectWithResult(returnTo, "error", "Folio y monto son obligatorios.");
  }

  const { data: folio } = await supabase
    .from("folios")
    .select("id, total_amount, paid_amount, balance_due, folio_code")
    .eq("id", folioId)
    .single();

  if (!folio) {
    return redirectWithResult(returnTo, "error", "No se encontró el folio.");
  }

  const expectedTotal = await getFolioExpectedTotal(supabase, folioId);
  const nextPaid = Number(folio.paid_amount) + amount;
  const paymentDifference = Number((nextPaid - expectedTotal).toFixed(2));
  if (paymentDifference !== 0) {
    const isAdmin = actor?.role === "admin";
    if (!isAdmin || !isOverride || !overrideReason) {
      return redirectWithResult(
        returnTo,
        "error",
        `Monto inválido. Diferencia contra esperado: ${paymentDifference.toFixed(2)}.`,
      );
    }
  }

  const newPaidAmount = Number(folio.paid_amount) + amount;
  const newBalance = Math.max(0, expectedTotal - newPaidAmount);
  const newStatus = newBalance === 0 ? "liquidated" : "partial";

  const paymentType = newStatus === "liquidated" ? "settlement" : "advance";
  await supabase.from("payments").insert({
    folio_id: folioId,
    amount,
    method,
    payment_type: paymentType,
    received_by: actorId,
    notes,
  });

  await supabase
    .from("folios")
    .update({
      total_amount: expectedTotal,
      paid_amount: newPaidAmount,
      balance_due: newBalance,
      payment_status: newStatus,
    })
    .eq("id", folioId);

  if (newStatus === "liquidated") {
    await supabase.from("reservations").update({ status: "confirmed" }).eq("folio_id", folioId);
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "payment_registered",
    entity_type: "folio",
    entity_id: folioId,
    metadata: {
      folio_code: folio.folio_code,
      amount,
      method,
      paid_amount: newPaidAmount,
      balance_due: newBalance,
      expected_total: expectedTotal,
      payment_difference: paymentDifference,
      admin_override: isOverride,
      override_reason: overrideReason || null,
    },
  });

  // --- Generar PDF y enviar WhatsApp automático al huésped ---
  try {
    const { data: reservationForFolio } = await supabase
      .from("reservations")
      .select("id, check_in_date, check_out_date, nights, discount_percent, reservation_guests(guests(id, full_name, phone))")
      .eq("folio_id", folioId)
      .limit(1)
      .maybeSingle();

    if (reservationForFolio) {
      const guestRows = Array.isArray(reservationForFolio.reservation_guests)
        ? reservationForFolio.reservation_guests
        : [];
      const mainGuestRow = guestRows[0] as {
        guests?: { id?: string; full_name?: string; phone?: string };
      } | undefined;
      const mainGuest = mainGuestRow?.guests;

      if (mainGuest?.phone) {
        const guestPhone = normalizePhone(mainGuest.phone);
        if (guestPhone) {
          // 1. Generar PDF de confirmación de pago
          const pdfBytes = await generatePaymentConfirmationPdf({
            guestName: mainGuest.full_name ?? "Huésped",
            folioCode: folio.folio_code,
            amount,
            method,
            balanceDue: newBalance,
            paymentStatus: newStatus,
            checkInDate: reservationForFolio.check_in_date,
            checkOutDate: reservationForFolio.check_out_date,
            nights: reservationForFolio.nights,
            guestCount: guestRows.length,
            totalAmount: expectedTotal,
            discountPercent: Number(reservationForFolio.discount_percent ?? 0) || undefined,
            discountAmount: Number(reservationForFolio.discount_percent ?? 0) > 0
              ? Math.round(BASE_NIGHTLY_RATE * Number(reservationForFolio.discount_percent) / 100 * guestRows.length * reservationForFolio.nights * 100) / 100
              : undefined,
            originalTotal: Number(reservationForFolio.discount_percent ?? 0) > 0
              ? expectedTotal + Math.round(BASE_NIGHTLY_RATE * Number(reservationForFolio.discount_percent) / 100 * guestRows.length * reservationForFolio.nights * 100) / 100
              : undefined,
          });

          // 2. Subir PDF a Supabase Storage
          const bucketName = "whatsapp-pdfs";
          await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});
          const pdfFileName = `pago-${folio.folio_code}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(pdfFileName, pdfBytes, { contentType: "application/pdf", upsert: true });

          let waResult;
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(pdfFileName);
            const pdfPublicUrl = publicUrlData.publicUrl;

            waResult = await sendWhatsAppTemplateMessage(
              guestPhone,
              process.env.YCLOUD_TEMPLATE_NAME || "payment_confirmation",
              process.env.YCLOUD_TEMPLATE_LANGUAGE || "es",
              [mainGuest.full_name ?? "Huésped", folio.folio_code, `$${amount.toFixed(2)} MXN`],
              undefined,
              { pdfUrl: pdfPublicUrl, filename: `comprobante-${folio.folio_code}.pdf` },
            );
          } else {
            // Fallback: enviar solo texto si falla la subida del PDF
            console.error("[registerPaymentAction] Error subiendo PDF:", uploadError);
            const whatsappMessage = buildPaymentConfirmationMessage({
              guestName: mainGuest.full_name ?? "Huésped",
              folioCode: folio.folio_code,
              amount,
              method,
              balanceDue: newBalance,
              paymentStatus: newStatus,
              checkInDate: reservationForFolio.check_in_date,
              checkOutDate: reservationForFolio.check_out_date,
              nights: reservationForFolio.nights,
            });
            const { sendWhatsAppTextMessage } = await import("@/lib/ycloud");
            waResult = await sendWhatsAppTextMessage(guestPhone, whatsappMessage);
          }

          // Registrar el mensaje en whatsapp_messages
          await supabase.from("whatsapp_messages").insert({
            guest_id: mainGuest.id ?? null,
            reservation_id: reservationForFolio.id,
            folio_id: folioId,
            status: waResult.success ? "sent" : "failed",
            phone: guestPhone,
            payload: {
              folio_code: folio.folio_code,
              amount,
              method,
              ycloud_result: waResult,
            },
            delivered_at: waResult.success ? new Date().toISOString() : null,
            error_message: waResult.error ?? null,
          });
        }
      }
    }
  } catch (waError) {
    // No bloquear el flujo principal si falla WhatsApp
    console.error("[registerPaymentAction] Error enviando WhatsApp:", waError);
  }

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard");

  return redirectWithResult(
    returnTo,
    "success",
    newStatus === "liquidated"
      ? `Pago completo aplicado al folio ${folio.folio_code}.`
      : `Pago parcial aplicado al folio ${folio.folio_code}.`,
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

export async function createExpenseAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const actor = await getActorProfile();
  const actorId = actor?.id ?? null;

  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return redirectWithResult("/dashboard", "error", "No tienes permiso para registrar gastos.");
  }

  const returnTo = String(formData.get("return_to") ?? "/dashboard");
  const expenseConcept = String(formData.get("expense_concept") ?? "");
  const conceptDetail = String(formData.get("concept_detail") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const notes = String(formData.get("notes") ?? "").trim();
  const receiptFile = formData.get("receipt_image");

  if (!isExpenseConcept(expenseConcept)) {
    return redirectWithResult(returnTo, "error", "Selecciona un concepto de gasto válido.");
  }
  if (amount <= 0 || Number.isNaN(amount)) {
    return redirectWithResult(returnTo, "error", "El monto debe ser mayor a cero.");
  }
  if (expenseConcept === "extras" && conceptDetail.length < 3) {
    return redirectWithResult(returnTo, "error", "Para extras, describe el gasto (mínimo 3 caracteres).");
  }
  if (!["cash", "transfer", "card"].includes(method)) {
    return redirectWithResult(returnTo, "error", "Método de pago no válido.");
  }

  const movementDate = getMexicoCityDateString();

  const { data: openShift } = await supabase
    .from("shifts")
    .select("id")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const movementId = crypto.randomUUID();
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
  });

  if (insertError) {
    console.error("[createExpenseAction] insert failed:", insertError.message, insertError);
    return redirectWithResult(
      returnTo,
      "error",
      `No se pudo registrar el gasto: ${insertError.message}`,
    );
  }

  const movement = { id: movementId };

  if (receiptFile instanceof File && receiptFile.size > 0) {
    await adminSupabase.storage.createBucket(EXPENSE_RECEIPTS_BUCKET, { public: false }).catch(() => {});
    const extension = receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const objectPath = `${movementDate}/${movement.id}.${extension}`;
    const fileBuffer = Buffer.from(await receiptFile.arrayBuffer());
    const contentType = receiptFile.type || "image/jpeg";

    const { error: uploadError } = await adminSupabase.storage
      .from(EXPENSE_RECEIPTS_BUCKET)
      .upload(objectPath, fileBuffer, { contentType, upsert: true });

    if (!uploadError) {
      await adminSupabase.from("cash_movements").update({ receipt_image_path: objectPath }).eq("id", movement.id);
    }
  }

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "expense_created",
    entity_type: "cash_movement",
    entity_id: movement.id,
    metadata: {
      expense_concept: expenseConcept,
      concept_detail: expenseConcept === "extras" ? conceptDetail : null,
      amount,
      method,
      movement_date: movementDate,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard/expenses");
  return redirectWithResult(returnTo, "success", "Gasto registrado correctamente.");
}

export async function createDailyCashCutAction(): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const today = new Date().toISOString().slice(0, 10);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, method")
    .gte("received_at", `${today}T00:00:00`)
    .lte("received_at", `${today}T23:59:59`);

  const { data: movements } = await supabase
    .from("cash_movements")
    .select("amount, direction")
    .eq("movement_date", today);

  const totalCash = (payments ?? [])
    .filter((p) => p.method === "cash")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalTransfer = (payments ?? [])
    .filter((p) => p.method === "transfer")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCard = (payments ?? [])
    .filter((p) => p.method === "card")
    .reduce((sum, p) => sum + Number(p.amount), 0);
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

  const { data: liquidatedFolios } = await supabase
    .from("folios")
    .select("id,reservations!inner(id,reservation_source)")
    .eq("payment_status", "liquidated")
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  let expectedIncome = 0;
  for (const folio of liquidatedFolios ?? []) {
    expectedIncome += await getFolioExpectedTotal(supabase, folio.id);
  }
  const cashierCreatedCount = (liquidatedFolios ?? []).filter((folio) => {
    const reservation = Array.isArray(folio.reservations) ? folio.reservations[0] : folio.reservations;
    return reservation?.reservation_source === "cashier_counter";
  }).length;
  const appCreatedCount = Math.max(0, (liquidatedFolios ?? []).length - cashierCreatedCount);
  const actualCashCounted = totalIncome;
  const difference = Number((expectedIncome - actualCashCounted).toFixed(2));
  const leakageFlag = Math.abs(difference) > 0.009;

  let { data: currentShift } = await supabase.from("shifts").select("id").eq("status", "open").order("opened_at").limit(1).maybeSingle();
  if (!currentShift) {
    const { data: createdShift } = await supabase
      .from("shifts")
      .insert({ opened_by: actorId, status: "open" })
      .select("id")
      .single();
    currentShift = createdShift ?? null;
  }

  if (!currentShift) {
    return redirectWithResult("/dashboard/cash-cuts", "error", "No se pudo abrir un turno para generar el corte.");
  }

  await supabase.from("cash_cuts").insert({
    shift_id: currentShift.id,
    generated_by: actorId,
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
    notes: `Corte diario automático ${today}`,
  });

  await supabase
    .from("shifts")
    .update({ status: "closed", closed_by: actorId, closed_at: new Date().toISOString() })
    .eq("id", currentShift.id);

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "daily_cash_cut_generated",
    entity_type: "cash_cut",
    metadata: {
      date: today,
      total_income: totalIncome,
      total_guest_income: totalGuestIncome,
      total_expenses: totalExpenses,
      net_result: netResult,
      expected_income: expectedIncome,
      difference,
      leakage_flag: leakageFlag,
      cashier_created_count: cashierCreatedCount,
      app_created_count: appCreatedCount,
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
    .select("id, check_in_date, check_out_date, nights, discount_percent, reservation_guests(guests(id, full_name, phone))")
    .eq("folio_id", folioId)
    .limit(1)
    .maybeSingle();

  if (!reservationForFolio) {
    return redirectWithResult(returnTo, "error", "No se encontró reservación para ese folio.");
  }

  const guestRows = Array.isArray(reservationForFolio.reservation_guests)
    ? reservationForFolio.reservation_guests
    : [];
  const mainGuestRow = guestRows[0] as {
    guests?: { id?: string; full_name?: string; phone?: string };
  } | undefined;
  const mainGuest = mainGuestRow?.guests;

  if (!mainGuest?.phone) {
    return redirectWithResult(returnTo, "error", "No hay teléfono válido para enviar el comprobante.");
  }

  const guestPhone = normalizePhone(mainGuest.phone);
  if (!guestPhone) {
    return redirectWithResult(returnTo, "error", "Teléfono inválido.");
  }

  const amount = Number(folio.paid_amount ?? 0);
  const discPercent = Number(reservationForFolio.discount_percent ?? 0) || 0;
  const discAmount = discPercent > 0
    ? Math.round(BASE_NIGHTLY_RATE * discPercent / 100 * guestRows.length * reservationForFolio.nights * 100) / 100
    : 0;
  const originalTotal = discPercent > 0 ? Number(folio.total_amount ?? 0) + discAmount : 0;

  // Generate PDF
  const pdfBytes = await generatePaymentConfirmationPdf({
    guestName: mainGuest.full_name ?? "Huésped",
    folioCode: folio.folio_code,
    amount,
    method: "cash",
    balanceDue: Number(folio.balance_due ?? 0),
    paymentStatus: folio.payment_status,
    checkInDate: reservationForFolio.check_in_date,
    checkOutDate: reservationForFolio.check_out_date,
    nights: reservationForFolio.nights,
    guestCount: guestRows.length,
    totalAmount: Number(folio.total_amount ?? 0),
    discountPercent: discPercent || undefined,
    discountAmount: discAmount || undefined,
    originalTotal: originalTotal || undefined,
  });

  // Upload PDF
  const bucketName = "whatsapp-pdfs";
  await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});
  const pdfFileName = `pago-${folio.folio_code}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(pdfFileName, pdfBytes, { contentType: "application/pdf", upsert: true });

  let waResult;
  if (!uploadError) {
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(pdfFileName);
    const pdfPublicUrl = publicUrlData.publicUrl;

    waResult = await sendWhatsAppTemplateMessage(
      guestPhone,
      process.env.YCLOUD_TEMPLATE_NAME || "payment_confirmation",
      process.env.YCLOUD_TEMPLATE_LANGUAGE || "es",
      [mainGuest.full_name ?? "Huésped", folio.folio_code, `$${amount.toFixed(2)} MXN`],
      undefined,
      { pdfUrl: pdfPublicUrl, filename: `comprobante-${folio.folio_code}.pdf` },
    );
  } else {
    console.error("[resendPaymentReceipt] Error subiendo PDF:", uploadError);
    const whatsappMessage = buildPaymentConfirmationMessage({
      guestName: mainGuest.full_name ?? "Huésped",
      folioCode: folio.folio_code,
      amount,
      method: "cash",
      balanceDue: Number(folio.balance_due ?? 0),
      paymentStatus: folio.payment_status,
      checkInDate: reservationForFolio.check_in_date,
      checkOutDate: reservationForFolio.check_out_date,
      nights: reservationForFolio.nights,
    });
    const { sendWhatsAppTextMessage } = await import("@/lib/ycloud");
    waResult = await sendWhatsAppTextMessage(guestPhone, whatsappMessage);
  }

  await supabase.from("whatsapp_messages").insert({
    guest_id: mainGuest.id ?? null,
    reservation_id: reservationForFolio.id,
    folio_id: folioId,
    status: waResult.success ? "sent" : "failed",
    phone: guestPhone,
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
    metadata: { folio_code: folio.folio_code, phone: guestPhone, success: waResult.success },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");

  return redirectWithResult(
    returnTo,
    waResult.success ? "success" : "error",
    waResult.success
      ? `Comprobante reenviado a ${guestPhone} para folio ${folio.folio_code}.`
      : `Error al reenviar comprobante: ${waResult.error ?? "desconocido"}`,
  );
}

export async function getBedReservations(bedId: string) {
  const supabase = createAdminClient();

  const { data: rgRows } = await supabase
    .from("reservation_guests")
    .select("reservation_id, reservations!inner(check_in_date, check_out_date, status, reservation_guests(guests(full_name)))")
    .eq("bed_id", bedId)
    .neq("reservations.status", "cancelled");

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

  const { data: beds } = await supabase
    .from("beds")
    .select("id, bed_number, status")
    .order("bed_number", { ascending: true });

  const { data: rgRows } = await supabase
    .from("reservation_guests")
    .select("bed_id, reservation_id, guests(full_name)")
    .not("bed_id", "is", null);

  const bedGuestMap = new Map<string, string>();
  for (const rg of rgRows ?? []) {
    if (rg.bed_id && !bedGuestMap.has(rg.bed_id)) {
      const guest = rg.guests as { full_name?: string } | undefined;
      bedGuestMap.set(rg.bed_id, guest?.full_name ?? "Ocupada");
    }
  }

  return (beds ?? []).map((bed) => ({
    id: bed.id,
    bed_number: bed.bed_number,
    status: bed.status,
    occupied_by: bedGuestMap.get(bed.id) ?? null,
  }));
}

export async function reassignBedAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/reservations");
  const reservationId = String(formData.get("reservation_id") ?? "");
  const guestId = String(formData.get("guest_id") ?? "");
  const newBedId = String(formData.get("new_bed_id") ?? "");

  if (!reservationId || !guestId || !newBedId) {
    return redirectWithResult(returnTo, "error", "Faltan datos para reasignar la cama.");
  }

  // Verify the bed is not blocked
  const { data: bed } = await supabase.from("beds").select("id, status, bed_number").eq("id", newBedId).single();
  if (!bed || bed.status === "blocked") {
    return redirectWithResult(returnTo, "error", "La cama seleccionada no está disponible.");
  }

  // Verify no overlapping reservation occupies this bed
  const { data: reservation } = await supabase
    .from("reservations")
    .select("check_in_date, check_out_date")
    .eq("id", reservationId)
    .single();
  if (!reservation) {
    return redirectWithResult(returnTo, "error", "Reservación no encontrada.");
  }

  const { data: overlappingRg } = await supabase
    .from("reservation_guests")
    .select("reservation_id, reservations!inner(check_in_date, check_out_date)")
    .eq("bed_id", newBedId)
    .neq("reservation_id", reservationId);

  for (const rg of overlappingRg ?? []) {
    const overlap = rg.reservations as unknown as { check_in_date: string; check_out_date: string };
    if (overlap.check_in_date < reservation.check_out_date && overlap.check_out_date > reservation.check_in_date) {
      return redirectWithResult(returnTo, "error", `Cama ${bed.bed_number} está ocupada en esas fechas.`);
    }
  }

  // Get old bed for audit
  const { data: currentRg } = await supabase
    .from("reservation_guests")
    .select("bed_id, beds(bed_number)")
    .eq("reservation_id", reservationId)
    .eq("guest_id", guestId)
    .single();

  const oldBedNumber = (currentRg?.beds as { bed_number?: number } | undefined)?.bed_number;

  // Update the assignment
  const { error: updateError } = await supabase
    .from("reservation_guests")
    .update({ bed_id: newBedId })
    .eq("reservation_id", reservationId)
    .eq("guest_id", guestId);

  if (updateError) {
    return redirectWithResult(returnTo, "error", "No se pudo actualizar la asignación de cama.");
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actorId,
    action: "bed_reassigned",
    entity_type: "reservation",
    entity_id: reservationId,
    metadata: {
      guest_id: guestId,
      old_bed: oldBedNumber ?? "Sin cama",
      new_bed: bed.bed_number,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/folios");

  return redirectWithResult(returnTo, "success", `Cama cambiada a ${bed.bed_number}.`);
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
