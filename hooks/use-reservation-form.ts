"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { searchGuestByPhoneAction, getApplicableDiscountsAction } from "@/actions/operations";
import type { CreateGuestReservationResult, GuestConfirmationPayload } from "@/lib/guest-reservation-confirmation";
import type { ApplicableDiscount } from "@/lib/discount-rules";

export const LOCKER_DAILY_PRICE = 30;

export type GuestFormRow = {
  full_name: string;
  phone: string;
  email: string;
  sex: string;
  add_locker: "no" | "yes";
  locker_days: number;
};

export type ReservationDateErrors = Partial<
  Record<"check_in_date" | "check_out_date", string>
>;

export function emptyGuest(): GuestFormRow {
  return { full_name: "", phone: "", email: "", sex: "unknown", add_locker: "no", locker_days: 1 };
}

export function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 1;
  const from = new Date(`${checkIn}T00:00:00`);
  const to = new Date(`${checkOut}T00:00:00`);
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

export function validateGuestRow(guest: GuestFormRow): string | null {
  if (!guest.full_name.trim()) return "Ingresa el nombre completo.";
  if (!guest.phone.trim()) return "Ingresa el teléfono.";
  return null;
}

type UseReservationFormOptions = {
  action: (formData: FormData) => Promise<CreateGuestReservationResult | void>;
  onConfirmed?: (data: GuestConfirmationPayload) => void;
  recurringGuest?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    sex?: string | null;
  } | null;
};

export function useReservationForm({ action, onConfirmed, recurringGuest }: UseReservationFormOptions) {
  const [guestCount, setGuestCount] = useState(1);
  const [guests, setGuests] = useState<GuestFormRow[]>([emptyGuest()]);
  const [reservationData, setReservationData] = useState({
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

  const resetForm = useCallback(() => {
    setGuestCount(1);
    setGuests([emptyGuest()]);
    setReservationData({ check_in_date: "", check_out_date: "", notes: "" });
    setTouched({});
    setSubmitAttempted(false);
    setSearchPhone("");
    setSearchError("");
    setRecurringGuestMatched(false);
    setSubmitResult(null);
    setApplicableDiscount(null);
  }, []);

  useEffect(() => {
    setGuests((prev) => {
      const newGuests = [...prev];
      if (guestCount > prev.length) {
        for (let i = prev.length; i < guestCount; i++) {
          newGuests.push(emptyGuest());
        }
      } else if (guestCount < prev.length) {
        newGuests.splice(guestCount);
      }
      return newGuests;
    });
  }, [guestCount]);

  useEffect(() => {
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
  }, [recurringGuest]);

  const stayNights = useMemo(
    () => nightsBetween(reservationData.check_in_date, reservationData.check_out_date),
    [reservationData.check_in_date, reservationData.check_out_date],
  );

  // Fetch applicable discounts when check_in_date changes or guest phone is known
  useEffect(() => {
    if (!reservationData.check_in_date) {
      setApplicableDiscount(null);
      return;
    }
    const phone = guests[0]?.phone?.replace(/\D/g, "") || undefined;
    if (!phone) {
      // Only fetch date-range discounts (no phone)
    }
    let cancelled = false;
    getApplicableDiscountsAction(reservationData.check_in_date, phone).then((discount) => {
      if (!cancelled) setApplicableDiscount(discount);
    }).catch(() => {
      if (!cancelled) setApplicableDiscount(null);
    });
    return () => { cancelled = true; };
  }, [reservationData.check_in_date, guests[0]?.phone]);

  useEffect(() => {
    setGuests((prev) =>
      prev.map((guest) => {
        if (guest.add_locker !== "yes") return guest;
        const locker_days = Math.min(Math.max(1, guest.locker_days), stayNights);
        return { ...guest, locker_days };
      }),
    );
  }, [stayNights]);

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
      setGuests((prev) => {
        const newGuests = [...prev];
        const current = { ...newGuests[index] };
        if (field === "add_locker") {
          const addLocker = value === "yes" ? "yes" : "no";
          current.add_locker = addLocker;
          if (addLocker === "yes") {
            current.locker_days = stayNights;
          }
        } else if (field === "locker_days") {
          const days = Number(value);
          current.locker_days = Math.min(Math.max(1, Number.isFinite(days) ? days : 1), stayNights);
        } else {
          (current as Record<string, string | number>)[field] = value;
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
    }
  };

  const submitReservation = async () => {
    setSubmitAttempted(true);
    setSubmitResult(null);

    if (hasDateErrors) return { ok: false as const, message: dateErrors.check_in_date || dateErrors.check_out_date || "Revisa las fechas." };

    const guestError = guests.find((g, i) => validateGuestRow(g) !== null);
    if (guestError) {
      const msg = "Todos los huéspedes deben tener nombre y teléfono.";
      setSubmitResult({ success: false, message: msg });
      return { ok: false as const, message: msg };
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("guests_data", JSON.stringify(guests));
      formData.set("check_in_date", reservationData.check_in_date);
      formData.set("check_out_date", reservationData.check_out_date);
      formData.set("notes", reservationData.notes);
      formData.set("reservation_source", "guest_app");
      formData.set("return_to", "/");

      const result = await action(formData);
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
    }
  };

  const showDateError = (name: keyof ReservationDateErrors) =>
    (submitAttempted || touched[name]) && Boolean(dateErrors[name]);

  const estimatedBedTotal = (bedPricePerNight: number) => guestCount * stayNights * bedPricePerNight;

  const estimatedLockerTotal = () =>
    guests.reduce((sum, g) => {
      if (g.add_locker !== "yes") return sum;
      return sum + g.locker_days * LOCKER_DAILY_PRICE;
    }, 0);

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
    submitReservation,
    showDateError,
    resetForm,
    estimatedBedTotal,
    estimatedLockerTotal,
    applicableDiscount,
  };
}
