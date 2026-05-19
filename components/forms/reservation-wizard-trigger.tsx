"use client";

import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";
import { requestOpenReservationWizard } from "@/components/forms/reservation-wizard-bridge";

type ReservationWizardTriggerProps = {
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
} & Omit<ComponentPropsWithoutRef<"a">, "href" | "children" | "onClick">;

/** Opens the reservation wizard. Keeps #reserva in href for no-JS fallback. */
export function ReservationWizardTrigger({
  children,
  className,
  onClick,
  ...rest
}: ReservationWizardTriggerProps) {
  return (
    <a
      href="#reserva"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        requestOpenReservationWizard();
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
