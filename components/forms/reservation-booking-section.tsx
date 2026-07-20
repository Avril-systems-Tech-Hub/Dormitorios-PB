"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReservationForm } from "@/components/forms/reservation-form";
import { ReservationConfirmation } from "@/components/forms/reservation-confirmation";
import {
  decodeGuestConfirmationPayload,
  type CreateGuestReservationResult,
  type GuestConfirmationPayload,
} from "@/lib/guest-reservation-confirmation";
import { restoreReservationScroll } from "@/lib/preserve-scroll";

type ReservationBookingSectionProps = {
  action: (formData: FormData) => Promise<CreateGuestReservationResult | void>;
  beds: { bed_number: string | number; zone?: string }[];
  /** Decoded on the server from searchParams so SSR and hydration match. */
  initialConfirmation?: GuestConfirmationPayload | null;
};

export function ReservationBookingSection({
  action,
  beds,
  initialConfirmation = null,
}: ReservationBookingSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [confirmationData, setConfirmationData] = useState<GuestConfirmationPayload | null>(
    initialConfirmation,
  );

  useEffect(() => {
    if (searchParams.get("confirmed") !== "1") return;
    const encoded = searchParams.get("confirmation");
    if (!encoded) return;
    const decoded = decodeGuestConfirmationPayload(encoded);
    if (decoded) setConfirmationData(decoded);
  }, [searchParams]);

  const activeConfirmation = confirmationData;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Keep page position stable around form updates; on confirm, anchor to the section.
  useLayoutEffect(() => {
    if (activeConfirmation) {
      document.getElementById("reserva")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    restoreReservationScroll();
    const id = window.setTimeout(restoreReservationScroll, 100);
    return () => window.clearTimeout(id);
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
