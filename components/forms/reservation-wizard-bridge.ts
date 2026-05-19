"use client";

type OpenWizardFn = () => void;

let openWizard: OpenWizardFn | null = null;

/** Registered by ReservationWizardProvider on mount. */
export function registerReservationWizardOpener(fn: OpenWizardFn | null) {
  openWizard = fn;
}

export function requestOpenReservationWizard() {
  openWizard?.();
}
