/** TrustStrip / reservation panels — slate brand gradient (homepage). */
export const BRAND_GRADIENT_SURFACE_CLASS =
  "bg-gradient-to-br from-mkt-slate-deep via-mkt-slate to-mkt-slate text-white";

/** @deprecated Use BRAND_GRADIENT_SURFACE_CLASS */
export const UBICACION_SURFACE_CLASS = BRAND_GRADIENT_SURFACE_CLASS;

export const BRAND_GRADIENT_PANEL_CLASS = `rounded-2xl border border-white/15 shadow-md shadow-mkt-slate-deep/20 ${BRAND_GRADIENT_SURFACE_CLASS}`;

/** @deprecated Use `.dashboard-canvas` in globals.css (Tailwind skips dynamic lib strings). */
export const DASHBOARD_CANVAS_CLASS = "dashboard-canvas";
