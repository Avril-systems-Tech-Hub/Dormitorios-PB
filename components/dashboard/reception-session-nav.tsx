"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function ReceptionSessionNav() {
  const router = useRouter();

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-2.5 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:h-9 sm:px-3 sm:text-sm"
      >
        Regreso
      </button>
      <Link
        href="/dashboard"
        className="inline-flex h-8 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-2.5 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:h-9 sm:px-3 sm:text-sm"
      >
        Inicio
      </Link>
    </div>
  );
}
