import { createReservationAction } from "@/actions/operations";
import { BedsSection } from "@/components/landing/beds-section";
import { BentoGallery } from "@/components/landing/bento-gallery";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { FadeInView, MotionSection, StaggerGrid, StaggerItem } from "@/components/landing/motion";
import { RestCtaSection } from "@/components/landing/rest-cta-section";
import { ServicesSection } from "@/components/landing/services-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { TrustStrip } from "@/components/landing/trust-strip";
import { NIGHTLY_PRICE_MXN } from "@/components/landing/constants";
import { ReservationBookingSection } from "@/components/forms/reservation-booking-section";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

const iconClassName = "h-5 w-5";

const IconLocation = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const IconBed = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M3 14V6a2 2 0 0 1 2-2h4v10" />
    <path d="M9 14V4h10a2 2 0 0 1 2 2v8" />
    <path d="M3 18v2M21 18v2M3 14h18v4H3z" />
  </svg>
);

const IconPrice = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M4 7.5V5h7.2a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8L15.2 19a2 2 0 0 1-2.8 0l-6.8-6.8A2 2 0 0 1 5 10.8V7.5h-.1A.9.9 0 0 1 4 6.6v.9Z" />
    <circle cx="8.2" cy="8.2" r="1.2" />
  </svg>
);

const featureHighlights = [
  {
    title: "Ubicación práctica",
    body: "Cerca de la Basílica y del Metrobús Deportivo 18 de marzo.",
    Icon: IconLocation,
  },
  {
    title: "Tarifa clara",
    body: `Una sola tarifa: $${NIGHTLY_PRICE_MXN} MXN por cama y noche.`,
    Icon: IconPrice,
  },
  {
    title: "Camas listas",
    body: "Espacios para descansar: secciones ordenadas y literas.",
    Icon: IconBed,
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = createAdminClient();

  const { data: beds } = await supabase
    .from("beds")
    .select("bed_number, status")
    .eq("status", "available")
    .order("bed_number")
    .limit(60);

  return (
    <main className="landing-marketing min-h-screen font-sans antialiased">
      <LandingHeader />
      <LandingHero />
      <TrustStrip />

      <MotionSection className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
        <StaggerGrid className="grid gap-5 md:grid-cols-3">
          {featureHighlights.map(({ title, body, Icon }) => (
            <StaggerItem key={title}>
              <article className="h-full rounded-2xl border border-mkt-border bg-mkt-card p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-mkt-sky/60 text-mkt-slate">
                  <Icon />
                </div>
                <h3 className="font-semibold text-mkt-ink">{title}</h3>
                <p className="mt-2 text-sm text-mkt-ink-muted">{body}</p>
              </article>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </MotionSection>

      <MotionSection id="reserva" className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-14">
        <FadeInView className="mb-8 max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-terracotta">Reserva tu cama</p>
          <h2 className="text-3xl font-semibold tracking-tight text-mkt-terracotta">Check-in rápido y sencillo</h2>
          <p className="text-mkt-ink-muted">
            Cliente nuevo o recurrente: captura datos, elige cama o autoasigna, genera folio y paga en caja.
          </p>
        </FadeInView>
        <FadeInView className="mx-auto max-w-4xl" delay={0.08}>
          <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-mkt-slate/30" />}>
            <ReservationBookingSection action={createReservationAction} beds={beds ?? []} />
          </Suspense>
        </FadeInView>
      </MotionSection>

      <BedsSection />

      <BentoGallery />

      <RestCtaSection />

      <ServicesSection />

      <TestimonialsSection />


      <LandingFooter />
    </main>
  );
}
