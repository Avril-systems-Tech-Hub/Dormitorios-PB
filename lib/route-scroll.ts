const STORAGE_PREFIX = "dormitorios:route-scroll:";

export function routeScrollKey(pathname: string, search: string): string {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return qs ? `${pathname}?${qs}` : pathname;
}

function storageKey(routeKey: string): string {
  return `${STORAGE_PREFIX}${routeKey}`;
}

export function readRouteScroll(routeKey: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(routeKey));
    if (raw == null) return null;
    const y = Number(raw);
    return Number.isFinite(y) && y >= 0 ? y : null;
  } catch {
    return null;
  }
}

export function saveRouteScroll(routeKey: string, y: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(y) || y < 0) return;
  try {
    sessionStorage.setItem(storageKey(routeKey), String(Math.round(y)));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function captureRouteScroll(pathname: string, search: string): void {
  if (typeof window === "undefined") return;
  saveRouteScroll(routeScrollKey(pathname, search), window.scrollY);
}
