"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AnomalyFlag,
  CashMovementCategory,
  CashMovementDirection,
  PaymentMethod,
} from "@/types/domain";
import { parseTsvToRows } from "@/lib/imports/tsv";

const BASE_NIGHTLY_RATE = 120;
const BED_DATA_DISCOUNT = 10;

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
  const { data: allBeds } = await supabase.from("beds").select("id, bed_number, status").eq("status", "available");

  if (!allBeds?.length) return [];

  const { data: overlappingReservations } = await supabase
    .from("reservations")
    .select("id")
    .lt("check_in_date", checkOutDate)
    .gt("check_out_date", checkInDate)
    .in("status", ["active", "confirmed"]);

  const overlappingIds = overlappingReservations?.map((r) => r.id) ?? [];
  if (!overlappingIds.length) {
    const freeBeds = [...allBeds].sort((a, b) => a.bed_number - b.bed_number);
    return freeBeds.slice(0, count).map(b => b.id);
  }

  const { data: occupiedRows } = await supabase
    .from("reservation_guests")
    .select("bed_id")
    .in("reservation_id", overlappingIds);

  const occupied = new Set((occupiedRows ?? []).map((row) => row.bed_id));
  const freeBeds = allBeds.filter((bed) => !occupied.has(bed.id)).sort((a, b) => a.bed_number - b.bed_number);

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

export async function createReservationAction(formData: FormData): Promise<void> {
  const supabase = createAdminClient();
  const actorId = await getActorProfileId();
  const returnTo = String(formData.get("return_to") ?? "/");
  const requestedSource = String(formData.get("reservation_source") ?? "").trim();

  const guestsJson = String(formData.get("guests_data") ?? "[]");
  let guests: { full_name: string; phone: string; email: string; sex: string }[] = [];
  try {
    guests = JSON.parse(guestsJson);
  } catch (e) {}

  if (!guests.length) {
    return redirectWithResult(returnTo, "error", "Se requiere al menos un huésped para crear la reserva.");
  }

  const checkInDate = String(formData.get("check_in_date") ?? "");
  const checkOutDate = String(formData.get("check_out_date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!checkInDate || !checkOutDate) {
    return redirectWithResult(returnTo, "error", "Faltan las fechas de reservación.");
  }

  const nights = dateDiffInNights(checkInDate, checkOutDate);
  const bedIds = await pickAvailableBeds({ count: guests.length, checkInDate, checkOutDate });

  if (bedIds.length < guests.length) {
    return redirectWithResult(returnTo, "error", `Solo hay ${bedIds.length} camas disponibles para esas fechas.`);
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
        return redirectWithResult(returnTo, "error", `No se pudo registrar al huésped ${fullName}.`);
      }
      guestIds.push(newGuest.id);
    }
  }

  if (guestIds.length === 0) {
    return redirectWithResult(returnTo, "error", "Datos de huéspedes inválidos.");
  }

  const folioCode = generateFolioCode();
  const nightlyRate = BASE_NIGHTLY_RATE;
  const discountAmount = BED_DATA_DISCOUNT;
  const finalRate = Math.max(0, nightlyRate - discountAmount);
  
  // Total = (tarifa final x noches) x numero de huespedes
  const totalAmount = finalRate * nights * guestIds.length;

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
    return redirectWithResult(returnTo, "error", "No se pudo crear el folio.");
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
      notes,
    })
    .select("id")
    .single();

  if (reservationError || !reservation) {
    return redirectWithResult(returnTo, "error", "No se pudo crear la reservación.");
  }

  const guestInserts = guestIds.map((gId, i) => ({
    reservation_id: reservation.id,
    guest_id: gId,
    bed_id: bedIds[i],
    nightly_rate: nightlyRate,
    discount_amount: discountAmount,
    final_rate: finalRate,
    locker_number: null,
    locker_price: 0,
    locker_days: 0,
    locker_amount: 0,
    social_bonus_status: "captured",
  }));

  const { error: guestReservationError } = await supabase.from("reservation_guests").insert(guestInserts);

  if (guestReservationError) {
    return redirectWithResult(returnTo, "error", "No se pudo guardar la asignación de camas.");
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
      reservation_source: reservationSource,
    },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/folios");
  revalidatePath("/dashboard/beds");

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
  const returnTo = String(formData.get("return_to") ?? "/dashboard");
  const folioId = String(formData.get("folio_id") ?? "");
  const paymentState = String(formData.get("payment_state") ?? "not_paid");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!folioId) {
    return redirectWithResult(returnTo, "error", "No se encontró el folio para esta reservación.");
  }

  if (paymentState !== "paid") {
    return redirectWithResult(returnTo, "success", "Reservación marcada como no pagada.");
  }

  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return redirectWithResult(returnTo, "error", "Para marcar como pagada, captura un monto válido.");
  }

  const paymentFormData = new FormData();
  paymentFormData.set("return_to", returnTo);
  paymentFormData.set("folio_id", folioId);
  paymentFormData.set("amount", String(amount));
  paymentFormData.set("method", method);
  paymentFormData.set("notes", notes || "Pago registrado desde dashboard recepción.");

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

  const totalIncome = totalCash + totalTransfer + totalCard + movementIncome - movementExpense;

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
