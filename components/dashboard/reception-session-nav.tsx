"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getReceptionSessionBackHref } from "@/lib/reception-check-in";

export function ReceptionSessionNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = getReceptionSessionBackHref(pathname, searchParams);

  if (!backHref) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => router.push(backHref)}
      className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-white/30 bg-white/10 px-2.5 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:h-9 sm:px-3 sm:text-sm"
      aria-label="Regresar a la pantalla anterior"
    >
      <span aria-hidden="true">←</span>
      Regreso
    </button>
  );
}
