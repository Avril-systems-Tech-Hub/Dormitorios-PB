import { createReservationAction } from "@/actions/operations";
import { BentoGallery } from "@/components/landing/bento-gallery";
import { BrandLockups } from "@/components/landing/brand-lockups";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { MotionSection, StaggerGrid, StaggerItem } from "@/components/landing/motion";
import { PriceBadge } from "@/components/landing/price-badge";
import { TrustStrip } from "@/components/landing/trust-strip";
import { NewsletterCta } from "@/components/landing/newsletter-cta";
import { NIGHTLY_PRICE_MXN } from "@/components/landing/constants";
import { ReservationForm } from "@/components/forms/reservation-form";
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

const IconWifi = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M3 9.5a15 15 0 0 1 18 0" />
    <path d="M6.5 13a10 10 0 0 1 11 0" />
    <path d="M10 16.5a5 5 0 0 1 4 0" />
    <circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const IconReception = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M3 18h18" />
    <path d="M6 18v-4.5A2.5 2.5 0 0 1 8.5 11h7A2.5 2.5 0 0 1 18 13.5V18" />
    <path d="M10.5 11V8.8a1.5 1.5 0 0 1 3 0V11" />
  </svg>
);

const IconClean = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="m6 14 5-8h4l-5 8H6Z" />
    <path d="m12.8 12.5 2.7 4.5" />
    <path d="M9 18h9" />
    <path d="m5 6 1.2-1.2" />
  </svg>
);

const IconQuote = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M9.5 9.5H6a1 1 0 0 0-1 1v3.3A2.2 2.2 0 0 0 7.2 16H9a1 1 0 0 1 1 1v.5A1.5 1.5 0 0 1 8.5 19H7" />
    <path d="M19.5 9.5H16a1 1 0 0 0-1 1v3.3a2.2 2.2 0 0 0 2.2 2.2H19a1 1 0 0 1 1 1v.5a1.5 1.5 0 0 1-1.5 1.5H17" />
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

const services = [
  {
    title: "Wifi estable",
    body: "Conexión en habitaciones y áreas comunes.",
    Icon: IconWifi,
  },
  {
    title: "Recepción",
    body: "Check-in y orientación cuando llegas.",
    Icon: IconReception,
  },
  {
    title: "Higiene",
    body: "Regaderas con agua caliente y áreas cuidadas.",
    Icon: IconClean,
  },
];

const testimonials = [
  ["Excelente ubicación y trato amable.", "María G."],
  ["Ideal para descansar antes de un viaje temprano.", "Carlos R."],
  ["Proceso de reserva muy fácil y rápido.", "Lucía T."],
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const recurrentPhoneRaw = String(params.phone ?? "");
  const recurrentPhone = recurrentPhoneRaw.replace(/\D/g, "");

  const supabase = createAdminClient();
  const { data: recurringGuest } = recurrentPhone
    ? await supabase
        .from("guests")
        .select("full_name, email, phone, sex")
        .eq("normalized_phone", recurrentPhone)
        .maybeSingle()
    : { data: null };

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
      <BrandLockups />
      <TrustStrip />

      <section className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
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
      </section>

      <section id="reserva" className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:px-6 md:py-14">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-chocolate">Reserva tu cama</p>
          <h2 className="text-3xl font-semibold tracking-tight text-mkt-ink">Check-in rápido, control en caja</h2>
          <p className="text-mkt-ink-muted">
            Cliente nuevo o recurrente: captura datos, elige cama o autoasigna, genera folio y paga en caja.
          </p>
          <form method="get" className="mt-4 rounded-2xl border border-mkt-border bg-mkt-card p-4 shadow-sm">
            <p className="text-sm font-semibold text-mkt-ink">Cliente recurrente</p>
            <p className="mt-1 text-xs text-mkt-ink-muted">
              Ingresa solo teléfono para recuperar nombre/correo y aplicar descuento por captura completa.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                name="phone"
                defaultValue={recurrentPhone}
                className="h-10 flex-1 rounded-lg border border-mkt-border bg-white px-3 text-sm text-mkt-ink"
                placeholder="Teléfono"
              />
              <button
                className="rounded-lg bg-mkt-slate px-4 text-sm font-semibold text-white transition hover:bg-mkt-slate-deep"
                type="submit"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>
        <ReservationForm action={createReservationAction} beds={beds ?? []} recurringGuest={recurringGuest} />
      </section>

      <section id="camas" className="border-y border-mkt-border bg-mkt-canvas-elevated px-4 py-12 md:px-6 md:py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-chocolate">Camas por noche</p>
            <h2 className="text-3xl font-semibold tracking-tight text-mkt-ink">Una tarifa, sin sorpresas</h2>
            <p className="text-mkt-ink-muted">
              Pagas por noche de uso de cama. Consulta disponibilidad en el panel o reserva aquí mismo. Más detalles y
              fotos del lugar en la sección <a href="#asi-somos" className="font-semibold text-mkt-terracotta underline-offset-2 hover:underline">Así somos</a>.
            </p>
          </div>
          <PriceBadge />
        </div>
      </section>

      <BentoGallery />

      <MotionSection className="relative my-6 overflow-hidden bg-mkt-slate px-4 py-14 text-white md:px-6 md:py-16">
        <div className="absolute inset-0 bg-gradient-to-r from-mkt-slate-deep via-mkt-slate to-mkt-terracotta/55" aria-hidden />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-white/80">Dormitorios Plaza Basílica</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">¿Necesitas descansar?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/90 md:text-base">
            Tarifa única <strong>${NIGHTLY_PRICE_MXN} MXN</strong> por cama y noche. Reserva con anticipación cuando
            puedas.
          </p>
          <a
            href="#reserva"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-mkt-slate transition hover:bg-mkt-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Reservar ahora
          </a>
        </div>
      </MotionSection>

      <section id="servicios" className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14">
        <StaggerGrid className="grid gap-6 md:grid-cols-3">
          {services.map(({ title, body, Icon }) => (
            <StaggerItem key={title}>
              <article className="h-full rounded-2xl border border-mkt-border bg-mkt-card p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-mkt-sky/60 text-mkt-slate">
                  <Icon />
                </div>
                <h3 className="font-semibold text-mkt-ink">{title}</h3>
                <p className="mt-2 text-sm text-mkt-ink-muted">{body}</p>
              </article>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      <section id="opiniones" className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-mkt-chocolate">Testimonios</p>
        <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-mkt-ink">Lo que dicen nuestros huéspedes</h2>
        <StaggerGrid className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map(([quote, name]) => (
            <StaggerItem key={name}>
              <article className="h-full rounded-2xl border border-mkt-border bg-mkt-card p-6 shadow-sm">
                <div className="mb-3 text-mkt-slate">
                  <IconQuote />
                </div>
                <p className="text-sm text-mkt-ink-muted">&ldquo;{quote}&rdquo;</p>
                <p className="mt-4 text-sm font-semibold text-mkt-chocolate">{name}</p>
              </article>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      <section className="bg-mkt-canvas-elevated px-4 py-14 md:px-6 md:py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-mkt-border bg-mkt-card p-8 text-center shadow-sm">
          <h2 className="text-3xl font-semibold tracking-tight text-mkt-ink">Suscríbete para ofertas exclusivas</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-mkt-ink-muted">
            Recibe promociones y novedades. Mientras tanto, también puedes escribirnos por WhatsApp.
          </p>
          <NewsletterCta />
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
