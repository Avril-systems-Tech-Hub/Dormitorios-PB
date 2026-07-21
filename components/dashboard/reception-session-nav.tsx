"use client";

import { usePathname, useRouter } from "next/navigation";

export function ReceptionSessionNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/dashboard") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-white/30 bg-white/10 px-2.5 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:h-9 sm:px-3 sm:text-sm"
      aria-label="Regresar a la pantalla anterior"
    >
      <span aria-hidden="true">←</span>
      Regreso
    </button>
  );
}
