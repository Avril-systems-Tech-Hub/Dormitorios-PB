import Image from "next/image";
import { ReservationWizardTrigger } from "@/components/forms/reservation-wizard-trigger";
import { NIGHTLY_PRICE_MXN } from "./constants";
import { FadeInView, MotionSection } from "./motion";
import { PriceBadge } from "./price-badge";

export function RestCtaSection() {
  return (
    <MotionSection
      subtle
      className="relative overflow-hidden border-y border-mkt-border bg-gradient-to-br from-mkt-slate-deep via-mkt-slate to-mkt-slate px-4 py-12 text-white md:px-6 md:py-16"
      aria-labelledby="descansar-heading"
    >
      <div
        className="pointer-events-none absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-mkt-terracotta/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-mkt-sky/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <FadeInView className="mx-auto w-full max-w-xs lg:col-span-5 lg:mx-0 lg:max-w-none" x={-24}>
          <figure>
            <div className="relative aspect-square w-full">
              <Image
                src="/illustrations/12.png"
                alt="Ilustración: descanso en litera en Dormitorios Plaza Basílica"
                width={500}
                height={500}
                className="h-full w-full object-contain"
                sizes="(max-width: 1024px) 320px, 380px"
              />
            </div>
          </figure>
        </FadeInView>

        <FadeInView className="flex flex-col gap-6 lg:col-span-7" x={24} delay={0.1}>
          <header className="max-w-xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mkt-canvas/80">
              Dormitorios Plaza Basílica
            </p>
            <h2 id="descansar-heading" className="text-3xl font-semibold tracking-tight md:text-4xl">
              ¿Necesitas descansar?
            </h2>
            <p className="text-base leading-relaxed text-white/85 md:text-lg">
              Tarifa única <strong className="font-semibold text-white">${NIGHTLY_PRICE_MXN} MXN</strong> por cama y
              noche. Reserva con anticipación cuando puedas.
            </p>
          </header>

          <PriceBadge className="w-fit shadow-md shadow-black/10" />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ReservationWizardTrigger className="inline-flex h-12 w-full items-center justify-center rounded-full bg-mkt-terracotta px-7 text-sm font-semibold text-white shadow-md shadow-black/15 transition hover:bg-mkt-terracotta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto sm:min-w-[200px]">
              Reservar ahora
            </ReservationWizardTrigger>
            <a
              href="#camas"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/30 bg-white/5 px-7 text-sm font-semibold text-white transition hover:border-white/45 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              Ver camas
            </a>
          </div>
        </FadeInView>
      </div>
    </MotionSection>
  );
}
