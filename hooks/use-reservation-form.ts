"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { searchGuestByPhoneAction, getApplicableDiscountsAction, validatePromoCodeAction } from "@/actions/operations";
import { normalizeMexicanPhone } from "@/lib/phone";
import { captureReservationScroll, restoreReservationScroll, withPreservedScroll } from "@/lib/preserve-scroll";
import type { CreateGuestReservationResult, GuestConfirmationPayload } from "@/lib/guest-reservation-confirmation";
import type { ApplicableDiscount } from "@/lib/discount-rules";
import type { PromoCode } from "@/lib/promo-codes";

export const LOCKER_DAILY_PRICE = 30;

export type GuestPhoneMatch = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  sex: string | null;
};

export type GuestFormRow = {
  full_name: string;
  phone: string;
  email: string;
  sex: string;
  existing_guest_id: string;
  match_decision: "" | "reuse" | "create_new";
  matched_guest: GuestPhoneMatch | null;
  phone_lookup_status: "idle" | "searching" | "matched" | "none" | "error";
  add_locker: "no" | "yes";
  locker_days: number;
  locker_number: string;
};

export type ReservationDateErrors = Partial<
  Record<"check_in_date" | "check_out_date", string>
>;

export function emptyGuest(): GuestFormRow {
  return {
    full_name: "",
    phone: "",
    email: "",
    sex: "unknown",
    existing_guest_id: "",
    match_decision: "",
    matched_guest: null,
    phone_lookup_status: "idle",
    add_locker: "no",
    locker_days: 1,
    locker_number: "",
  };
}

export function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 1;
  const from = new Date(`${checkIn}T00:00:00`);
  const to = new Date(`${checkOut}T00:00:00`);
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

export function validateGuestRow(guest: GuestFormRow, contactRequired = true): string | null {
  if (!guest.full_name.trim()) return "Ingresa el nombre completo.";
  if (contactRequired && !guest.phone.trim()) return "Ingresa el teléfono.";
  if (contactRequired && !guest.email.trim()) return "Ingresa el correo electrónico.";
  if (guest.phone.trim() && normalizeMexicanPhone(guest.phone).length !== 10) {
    return "El teléfono debe tener 10 dígitos.";
  }
  if (guest.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())) {
    return "Ingresa un correo electrónico válido.";
  }
  if (!guest.sex || guest.sex === "unknown") return "Selecciona el sexo.";
  return null;
}

type UseReservationFormOptions = {
  action: (formData: FormData) => Promise<CreateGuestReservationResult | void>;
  onConfirmed?: (data: GuestConfirmationPayload) => void;
  reservationSource?: "guest_app" | "cashier_counter";
  returnTo?: string;
  allowLockerSelection?: boolean;
  /** Keep document scroll stable around async updates. Disable in fullscreen overlays. */
  preservePageScroll?: boolean;
  recurringGuest?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    sex?: string | null;
  } | null;
};

export function useReservationForm({
  action,
  onConfirmed,
  reservationSource = "guest_app",
  returnTo = "/",
  allowLockerSelection = false,
  preservePageScroll = true,
  recurringGuest,
}: UseReservationFormOptions) {
  const captureScroll = useCallback(() => {
    if (preservePageScroll) captureReservationScroll();
  }, [preservePageScroll]);
  const restoreScroll = useCallback(() => {
    if (preservePageScroll) restoreReservationScroll();
  }, [preservePageScroll]);
  const withScroll = useCallback(
    <T,>(fn: () => Promise<T>) => (preservePageScroll ? withPreservedScroll(fn) : fn()),
    [preservePageScroll],
  );
  const [guests, setGuests] = useState<GuestFormRow[]>(() => {
    const guest = emptyGuest();
    if (recurringGuest) {
      guest.full_name = recurringGuest.full_name || guest.full_name;
      guest.phone = recurringGuest.phone || guest.phone;
      guest.email = recurringGuest.email || guest.email;
    }
    return [guest];
  });
  const [appliedRecurringGuest, setAppliedRecurringGuest] = useState(recurringGuest);
  const [reservationData, setReservationDataState] = useState({
    check_in_date: "",
    check_out_date: "",
    notes: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [recurringGuestMatched, setRecurringGuestMatched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [applicableDiscount, setApplicableDiscount] = useState<ApplicableDiscount | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoCodeValidating, setPromoCodeValidating] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<{ valid: boolean; promo?: PromoCode; error?: string } | null>(null);
  const contactRequired = reservationSource === "guest_app";

  if (recurringGuest !== appliedRecurringGuest) {
    setAppliedRecurringGuest(recurringGuest);
    if (recurringGuest) {
      setGuests((prev) => {
        const newGuests = [...prev];
        newGuests[0] = {
          ...newGuests[0],
          full_name: recurringGuest.full_name || newGuests[0].full_name,
          phone: recurringGuest.phone || newGuests[0].phone,
          email: recurringGuest.email || newGuests[0].email,
        };
        return newGuests;
      });
    }
  }

  const guestCount = guests.length;
  const setGuestCount: Dispatch<SetStateAction<number>> = useCallback((value) => {
    setGuests((prev) => {
      const nextCount = typeof value === "function" ? value(prev.length) : value;
      const newGuests = [...prev];
      if (nextCount > prev.length) {
        for (let i = prev.length; i < nextCount; i++) {
          newGuests.push(emptyGuest());
        }
      } else if (nextCount < prev.length) {
        newGuests.splice(nextCount);
      }
      return newGuests;
    });
  }, []);

  const setReservationData: Dispatch<SetStateAction<typeof reservationData>> = useCallback(
    (value) => {
      const next = typeof value === "function" ? value(reservationData) : value;
      setReservationDataState(next);
      const nextStayNights = nightsBetween(next.check_in_date, next.check_out_date);
      setGuests((prev) =>
        prev.map((guest) =>
          guest.add_locker === "yes" ? { ...guest, locker_days: nextStayNights } : guest,
        ),
      );
      if (!next.check_in_date) setApplicableDiscount(null);
    },
    [reservationData],
  );

  const validatePromo = useCallback(async (code: string) => {
    if (!code || code.trim().length < 3) {
      setPromoCodeResult(null);
      return;
    }
    setPromoCodeValidating(true);
    captureScroll();
    try {
      const result = await validatePromoCodeAction(code.trim());
      setPromoCodeResult(result);
    } catch {
      setPromoCodeResult({ valid: false, error: "Error al validar el código." });
    } finally {
      setPromoCodeValidating(false);
      restoreScroll();
    }
  }, [captureScroll, restoreScroll]);

  const clearPromoCode = useCallback(() => {
    setPromoCodeInput("");
    setPromoCodeResult(null);
  }, []);

  const resetForm = useCallback(() => {
    setGuests([emptyGuest()]);
    setReservationDataState({ check_in_date: "", check_out_date: "", notes: "" });
    setTouched({});
    setSubmitAttempted(false);
    setSearchPhone("");
    setSearchError("");
    setRecurringGuestMatched(false);
    setSubmitResult(null);
    setApplicableDiscount(null);
    setPromoCodeInput("");
    setPromoCodeResult(null);
  }, []);

  const stayNights = useMemo(
    () => nightsBetween(reservationData.check_in_date, reservationData.check_out_date),
    [reservationData.check_in_date, reservationData.check_out_date],
  );

  const primaryGuestPhone = guests[0]?.phone ?? "";

  // Fetch applicable discounts when check_in_date changes or guest phone is known
  useEffect(() => {
    if (!reservationData.check_in_date) return;
    const phone = primaryGuestPhone ? normalizeMexicanPhone(primaryGuestPhone) : undefined;
    if (!phone) {
      // Only fetch date-range discounts (no phone)
    }
    let cancelled = false;
    captureScroll();
    getApplicableDiscountsAction(reservationData.check_in_date, phone)
      .then((discount) => {
        if (!cancelled) setApplicableDiscount(discount);
      })
      .catch(() => {
        if (!cancelled) setApplicableDiscount(null);
      })
      .finally(() => {
        if (!cancelled) restoreScroll();
      });
    return () => {
      cancelled = true;
    };
  }, [reservationData.check_in_date, primaryGuestPhone, captureScroll, restoreScroll]);

  const dateErrors = useMemo<ReservationDateErrors>(() => {
    const next: ReservationDateErrors = {};
    if (!reservationData.check_in_date) next.check_in_date = "Selecciona fecha de entrada.";
    if (!reservationData.check_out_date) next.check_out_date = "Selecciona fecha de salida.";
    if (
      reservationData.check_in_date &&
      reservationData.check_out_date &&
      reservationData.check_out_date <= reservationData.check_in_date
    ) {
      next.check_out_date = "La salida debe ser posterior al check-in.";
    }
    return next;
  }, [reservationData]);

  const hasDateErrors = Object.keys(dateErrors).length > 0;

  const updateGuest = useCallback(
    (index: number, field: keyof GuestFormRow, value: string | number) => {
      setSubmitResult(null);
      setGuests((prev) => {
        const newGuests = [...prev];
        const current = { ...newGuests[index] };
        if (field === "add_locker") {
          const addLocker = value === "yes" ? "yes" : "no";
          current.add_locker = addLocker;
          if (addLocker === "yes") {
            current.locker_days = stayNights;
          } else {
            current.locker_number = "";
          }
        } else if (field === "locker_days") {
          const days = Number(value);
          current.locker_days = Math.min(Math.max(1, Number.isFinite(days) ? days : 1), stayNights);
        } else {
          (current as unknown as Record<string, string | number>)[field] = value;
          if (field === "phone") {
            current.existing_guest_id = "";
            current.match_decision = "";
            current.matched_guest = null;
            current.phone_lookup_status = "idle";
          }
        }
        newGuests[index] = current;
        return newGuests;
      });
    },
    [stayNights],
  );

  const clearRecurringGuest = useCallback(() => {
    setRecurringGuestMatched(false);
    setSearchError("");
    const phone = searchPhone;
    setGuests((prev) => {
      const newGuests = [...prev];
      newGuests[0] = { ...emptyGuest(), phone };
      return newGuests;
    });
  }, [searchPhone]);

  const handleSearch = async () => {
    setSearchError("");
    if (!searchPhone) return;
    setIsSearching(true);
    captureScroll();
    try {
      const res = await searchGuestByPhoneAction(searchPhone);
      if (res.success && res.guest) {
        setGuests((prev) => {
          const newGuests = [...prev];
          newGuests[0] = {
            ...newGuests[0],
            full_name: res.guest.full_name || newGuests[0].full_name,
            phone: res.guest.phone || newGuests[0].phone,
            email: res.guest.email || newGuests[0].email,
            sex: res.guest.sex || newGuests[0].sex,
            existing_guest_id: res.guest.id,
            match_decision: "reuse",
            matched_guest: res.guest,
            phone_lookup_status: "matched",
          };
          return newGuests;
        });
        setRecurringGuestMatched(true);
      } else {
        setRecurringGuestMatched(false);
        setSearchError("No se encontró el número.");
      }
    } catch {
      setRecurringGuestMatched(false);
      setSearchError("Error al buscar.");
    } finally {
      setIsSearching(false);
      restoreScroll();
    }
  };

  const lookupGuestForRow = useCallback(async (index: number) => {
    const phone = guests[index]?.phone ?? "";
    if (normalizeMexicanPhone(phone).length !== 10) {
      setGuests((prev) =>
        prev.map((guest, guestIndex) =>
          guestIndex === index ? { ...guest, phone_lookup_status: "error" as const } : guest,
        ),
      );
      return;
    }

    setGuests((prev) =>
      prev.map((guest, guestIndex) =>
        guestIndex === index ? { ...guest, phone_lookup_status: "searching" as const } : guest,
      ),
    );
    try {
      const result = await searchGuestByPhoneAction(phone);
      setGuests((prev) =>
        prev.map((guest, guestIndex) =>
          guestIndex === index
            ? {
                ...guest,
                existing_guest_id: "",
                match_decision: "",
                matched_guest: result.success ? result.guest : null,
                phone_lookup_status: result.success ? "matched" as const : "none" as const,
              }
            : guest,
        ),
      );
    } catch {
      setGuests((prev) =>
        prev.map((guest, guestIndex) =>
          guestIndex === index ? { ...guest, phone_lookup_status: "error" as const } : guest,
        ),
      );
    }
  }, [guests]);

  const decideGuestMatch = useCallback((index: number, decision: "reuse" | "create_new") => {
    setGuests((prev) =>
      prev.map((guest, guestIndex) => {
        if (guestIndex !== index || !guest.matched_guest) return guest;
        if (decision === "create_new") {
          return { ...guest, existing_guest_id: "", match_decision: "create_new" };
        }
        return {
          ...guest,
          full_name: guest.matched_guest.full_name,
          phone: guest.matched_guest.phone ?? guest.phone,
          email: guest.matched_guest.email ?? "",
          sex: guest.matched_guest.sex ?? "unknown",
          existing_guest_id: guest.matched_guest.id,
          match_decision: "reuse",
        };
      }),
    );
  }, []);

  const submitReservation = async () => {
    setSubmitAttempted(true);
    setSubmitResult(null);

    if (hasDateErrors) return { ok: false as const, message: dateErrors.check_in_date || dateErrors.check_out_date || "Revisa las fechas." };

    const guestError = guests.find((g) => validateGuestRow(g, contactRequired) !== null);
    if (guestError) {
      const msg = contactRequired
        ? "Todos los huéspedes deben tener nombre, teléfono, correo y sexo."
        : "Todos los huéspedes deben tener nombre y sexo; teléfono y correo son opcionales.";
      setSubmitResult({ success: false, message: msg });
      return { ok: false as const, message: msg };
    }

    setIsSubmitting(true);
    captureScroll();
    try {
      const formData = new FormData();
      const guestsPayload = allowLockerSelection
        ? guests
        : guests.map((guest) => ({
            ...guest,
            add_locker: "no" as const,
            locker_days: 0,
            locker_number: "",
          }));
      formData.set("guests_data", JSON.stringify(guestsPayload));
      formData.set("check_in_date", reservationData.check_in_date);
      formData.set("check_out_date", reservationData.check_out_date);
      formData.set("notes", reservationData.notes);
      formData.set("reservation_source", reservationSource);
      formData.set("return_to", returnTo);
      // Determine best discount: promo code vs applicable discount rule (pick highest)
      const promoDiscount = promoCodeResult?.valid ? promoCodeResult.promo : null;
      const ruleDiscount = applicableDiscount;
      if (promoDiscount && promoDiscount.discount_percent >= (ruleDiscount?.rule.discount_percent ?? 0)) {
        formData.set("promo_code", promoDiscount.code);
        formData.set("discount_percent", String(promoDiscount.discount_percent));
      } else if (ruleDiscount) {
        formData.set("discount_rule_id", ruleDiscount.rule.id);
        formData.set("discount_percent", String(ruleDiscount.rule.discount_percent));
      }

      const result = await withScroll(() => action(formData));
      if (result) {
        if (result.ok) {
          onConfirmed?.(result.confirmation);
          return { ok: true as const, confirmation: result.confirmation };
        }
        setSubmitResult({ success: false, message: result.error });
        return { ok: false as const, message: result.error };
      }
      return { ok: true as const, confirmation: undefined };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      if (
        typeof err === "object" &&
        err !== null &&
        "digest" in err &&
        (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      const message = "Ocurrió un error al registrar la reservación.";
      setSubmitResult({ success: false, message });
      return { ok: false as const, message };
    } finally {
      setIsSubmitting(false);
      restoreScroll();
    }
  };

  const showDateError = (name: keyof ReservationDateErrors) =>
    (submitAttempted || touched[name]) && Boolean(dateErrors[name]);

  const estimatedBedTotal = (bedPricePerNight: number) => guestCount * stayNights * bedPricePerNight;

  const estimatedLockerTotal = (discountPercent = 0) => {
    if (!allowLockerSelection) return 0;
    const lockerPrice =
      discountPercent > 0
        ? Math.round(LOCKER_DAILY_PRICE * (100 - discountPercent)) / 100
        : LOCKER_DAILY_PRICE;
    return guests.reduce((sum, g) => {
      if (g.add_locker !== "yes") return sum;
      return sum + g.locker_days * lockerPrice;
    }, 0);
  };

  return {
    guestCount,
    setGuestCount,
    guests,
    reservationData,
    setReservationData,
    touched,
    setTouched,
    submitAttempted,
    searchPhone,
    setSearchPhone,
    isSearching,
    searchError,
    isSubmitting,
    submitResult,
    stayNights,
    dateErrors,
    hasDateErrors,
    updateGuest,
    handleSearch,
    clearRecurringGuest,
    recurringGuestMatched,
    contactRequired,
    lookupGuestForRow,
    decideGuestMatch,
    submitReservation,
    showDateError,
    resetForm,
    estimatedBedTotal,
    estimatedLockerTotal,
    applicableDiscount,
    promoCodeInput,
    setPromoCodeInput,
    promoCodeValidating,
    promoCodeResult,
    validatePromo,
    clearPromoCode,
  };
}
