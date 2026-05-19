"use client";

import { ReservationWizardTrigger } from "@/components/forms/reservation-wizard-trigger";
import { HeroCarousel } from "./hero-carousel";
import { FadeIn } from "./motion";
import { PriceBadge } from "./price-badge";

export function LandingHero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:gap-10 md:px-6 md:py-16">
      <div className="space-y-5">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mkt-chocolate">Renta de camas por noche</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-mkt-ink md:text-5xl lg:text-6xl">
            Hospedaje económico cerca de la{" "}
            <span className="text-mkt-terracotta">Basílica de Guadalupe</span>
          </h1>
          <p className="max-w-xl text-mkt-ink-muted">
            Camas por noche en Ciudad de México: ubicación práctica, wifi y regaderas con agua caliente. Ideal si
            necesitas descansar sin complicarte.
          </p>
        </FadeIn>
        <FadeIn delay={0.08} className="flex flex-wrap items-center gap-4">
          <PriceBadge />
        </FadeIn>
        <FadeIn delay={0.12} className="flex flex-wrap gap-3">
          <ReservationWizardTrigger className="inline-flex h-11 items-center justify-center rounded-full bg-mkt-terracotta px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta">
            Reservar ahora
          </ReservationWizardTrigger>
          <a
            href="#reserva"
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-mkt-slate bg-transparent px-6 text-sm font-semibold text-mkt-slate transition hover:bg-mkt-slate/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta"
          >
            Ver disponibilidad
          </a>
        </FadeIn>
      </div>
      <FadeIn delay={0.06} className="order-first md:order-none">
        <div className="overflow-hidden rounded-[1.75rem] border border-mkt-border bg-mkt-card p-2 shadow-lg shadow-mkt-slate/10">
          <HeroCarousel />
        </div>
      </FadeIn>
    </section>
  );
}
