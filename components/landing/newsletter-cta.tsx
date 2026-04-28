"use client";

import { toast } from "sonner";

export function NewsletterCta() {
  return (
    <form
      className="mx-auto mt-5 flex max-w-xl flex-col gap-3 md:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        toast.message("Boletín en preparación. Escríbenos por WhatsApp para promociones.");
      }}
    >
      <input
        name="email"
        className="h-11 flex-1 rounded-full border border-mkt-border bg-white px-4 text-sm text-mkt-ink"
        placeholder="Tu correo electrónico"
        type="email"
      />
      <button
        type="submit"
        className="h-11 rounded-full bg-mkt-terracotta px-6 text-sm font-semibold text-white transition hover:bg-mkt-terracotta-hover"
      >
        Suscribirme
      </button>
    </form>
  );
}
