"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";

export function FolioFilterInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? searchParams.get("folio") ?? "";
  const [value, setValue] = useState(currentQuery);

  useEffect(() => {
    setValue(currentQuery);
  }, [currentQuery]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("folio");
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    router.push(`/dashboard/beds?${params.toString()}`);
  }, [value, router, searchParams]);

  const handleClear = useCallback(() => {
    setValue("");
    router.push("/dashboard/beds");
  }, [router]);

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por folio, nombre o teléfono…"
        className="h-9 rounded-lg border border-border-soft bg-white px-3 text-sm text-text-main outline-none focus:border-mkt-slate"
      />
      <button
        type="submit"
        className="h-9 rounded-lg bg-mkt-slate px-4 text-sm font-semibold text-white transition hover:bg-mkt-slate-deep"
      >
        Filtrar
      </button>
      {currentQuery && (
        <button
          type="button"
          onClick={handleClear}
          className="h-9 rounded-lg border border-border-soft px-3 text-sm text-text-muted transition hover:bg-gray-50"
        >
          Limpiar
        </button>
      )}
    </form>
  );
}