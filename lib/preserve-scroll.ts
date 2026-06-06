const RESERVATION_SCROLL_KEY = "dormitorios:reservation-scroll-y";
const RESERVATION_SCROLL_AT_KEY = "dormitorios:reservation-scroll-at";
const SCROLL_RESTORE_TTL_MS = 800;

export function captureReservationScroll() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RESERVATION_SCROLL_KEY, String(window.scrollY));
  sessionStorage.setItem(RESERVATION_SCROLL_AT_KEY, String(Date.now()));
}

export function clearReservationScrollCapture() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RESERVATION_SCROLL_KEY);
  sessionStorage.removeItem(RESERVATION_SCROLL_AT_KEY);
}

export function restoreReservationScroll() {
  if (typeof window === "undefined") return;

  const raw = sessionStorage.getItem(RESERVATION_SCROLL_KEY);
  const capturedAt = sessionStorage.getItem(RESERVATION_SCROLL_AT_KEY);
  if (raw == null || capturedAt == null) return;

  if (Date.now() - Number(capturedAt) > SCROLL_RESTORE_TTL_MS) {
    clearReservationScrollCapture();
    return;
  }

  const y = Number(raw);
  if (!Number.isFinite(y)) {
    clearReservationScrollCapture();
    return;
  }

  const apply = () => {
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
  };

  apply();
  requestAnimationFrame(apply);
  requestAnimationFrame(() => requestAnimationFrame(apply));
}

export async function withPreservedScroll<T>(fn: () => Promise<T>): Promise<T> {
  captureReservationScroll();
  try {
    return await fn();
  } finally {
    restoreReservationScroll();
    window.setTimeout(restoreReservationScroll, 0);
    window.setTimeout(restoreReservationScroll, 50);
    window.setTimeout(restoreReservationScroll, 150);
  }
}
