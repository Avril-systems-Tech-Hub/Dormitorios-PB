"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReservationForm } from "@/components/forms/reservation-form";
import { ReservationConfirmation } from "@/components/forms/reservation-confirmation";
import {
  decodeGuestConfirmationPayload,
  type CreateGuestReservationResult,
  type GuestConfirmationPayload,
} from "@/lib/guest-reservation-confirmation";

type ReservationBookingSectionProps = {
  action: (formData: FormData) => Promise<CreateGuestReservationResult | void>;
  beds: { bed_number: number }[];
};

export function ReservationBookingSection({ action, beds }: ReservationBookingSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [confirmationData, setConfirmationData] = useState<GuestConfirmationPayload | null>(null);

  const confirmationFromUrl = useMemo(() => {
    if (searchParams.get("confirmed") !== "1") return null;
    const encoded = searchParams.get("confirmation");
    if (!encoded) return null;
    return decodeGuestConfirmationPayload(encoded);
  }, [searchParams]);

  useEffect(() => {
    if (confirmationFromUrl) {
      setConfirmationData(confirmationFromUrl);
    }
  }, [confirmationFromUrl]);

  const activeConfirmation = confirmationData ?? confirmationFromUrl;

  useEffect(() => {
    if (activeConfirmation) {
      const el = document.getElementById("reserva");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeConfirmation]);

  const handleConfirmed = useCallback((data: GuestConfirmationPayload) => {
    setConfirmationData(data);
  }, []);

  const handleNewReservation = useCallback(() => {
    setConfirmationData(null);
    router.replace("/#reserva", { scroll: false });
  }, [router]);

  if (activeConfirmation) {
    return <ReservationConfirmation data={activeConfirmation} onNewReservation={handleNewReservation} />;
  }

  return <ReservationForm action={action} onConfirmed={handleConfirmed} beds={beds} />;
}
