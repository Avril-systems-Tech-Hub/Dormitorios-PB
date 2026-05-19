"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ReservationWizard } from "@/components/forms/reservation-mobile-wizard";
import { registerReservationWizardOpener } from "@/components/forms/reservation-wizard-bridge";
import type { CreateGuestReservationResult } from "@/lib/guest-reservation-confirmation";

type ReservationWizardProviderProps = {
  action: (formData: FormData) => Promise<CreateGuestReservationResult | void>;
  children: ReactNode;
};

export function ReservationWizardProvider({ action, children }: ReservationWizardProviderProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    registerReservationWizardOpener(() => setOpen(true));
    return () => registerReservationWizardOpener(null);
  }, []);

  return (
    <>
      {children}
      <ReservationWizard open={open} onOpenChange={setOpen} action={action} />
    </>
  );
}
