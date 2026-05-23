import Image from "next/image";
import type { ReactNode } from "react";
import { ReservationWizardTrigger } from "@/components/forms/reservation-wizard-trigger";
import { FadeInView, MotionSection, StaggerGrid, StaggerItem } from "./motion";
import {
  ADDRESS_LINE,
  MAP_SEARCH_HREF,
  METRO_COPY,
  SITE_HOST,
  WHATSAPP_DISPLAY,
  WHATSAPP_HREF,
} from "./constants";

const iconClass = "h-5 w-5 shrink-0";

function IconPin({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconTransit({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M4 11h16M8 21h8M10 17v4M14 17v4" />
    </svg>
  );
}

function IconWhatsApp({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

function IconGlobe({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z" />
    </svg>
  );
}

function IconMap({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2-5 2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

const linkButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function InfoCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="flex gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mkt-terracotta/20 text-mkt-canvas">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{label}</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white md:text-[0.9375rem]">{children}</p>
        </div>
      </div>
    </article>
  );
}

export function TrustStrip() {
  return (
    <MotionSection
      subtle
      id="ubicacion"
      className="border-y border-mkt-border bg-gradient-to-br from-mkt-slate-deep via-mkt-slate to-mkt-slate px-4 py-12 text-white md:px-6 md:py-14"
      aria-labelledby="ubicacion-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
          <FadeInView className="lg:col-span-5 xl:col-span-4" x={-28}>
            <figure>
              <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-mkt-canvas p-2 shadow-xl shadow-black/25 lg:mx-0 lg:max-w-none">
                <Image
                  src="/marketing/ubicacion-facade.png"
                  alt="Ilustración de la fachada de Dormitorios Plaza Basílica en la calle"
                  width={500}
                  height={500}
                  className="h-auto w-full rounded-xl"
                  sizes="(max-width: 1024px) 320px, 360px"
                />
              </div>
            </figure>
          </FadeInView>

          <FadeInView className="flex flex-col gap-8 lg:col-span-7 xl:col-span-8" x={28} delay={0.08}>
            <header className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mkt-canvas/80">Ubicación</p>
              <h2 id="ubicacion-heading" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                En el corazón de Tepeyac, CDMX
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/75">
                A pocos minutos de la Basílica de Guadalupe y con acceso rápido al Metrobús.
              </p>
            </header>

            <StaggerGrid className="grid gap-4 sm:grid-cols-2">
              <StaggerItem>
                <InfoCard icon={<IconPin />} label="Dirección">
                  {ADDRESS_LINE}
                </InfoCard>
              </StaggerItem>
              <StaggerItem>
                <InfoCard icon={<IconTransit />} label="Cómo llegar">
                  {METRO_COPY}
                </InfoCard>
              </StaggerItem>
            </StaggerGrid>

            <FadeInView delay={0.12} className="border-t border-white/10 pt-8">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Contacto</h3>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {/*<a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-mkt-terracotta px-6 text-sm font-semibold text-white shadow-md shadow-black/15 transition hover:bg-mkt-terracotta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto sm:min-w-[220px]"
                >
                  <IconWhatsApp className="h-5 w-5" />
                  WhatsApp +52 {WHATSAPP_DISPLAY}
                </a>*/}
                <ReservationWizardTrigger className={`${linkButtonClass} w-full sm:w-auto`}>
                  <IconGlobe className="h-4 w-4 opacity-90" />
                  {SITE_HOST}
                </ReservationWizardTrigger>
                <a href={MAP_SEARCH_HREF} target="_blank" rel="noopener noreferrer" className={`${linkButtonClass} w-full sm:w-auto`}>
                  <IconMap className="h-4 w-4 opacity-90" />
                  Ver en mapa
                </a>
              </div>
            </FadeInView>
          </FadeInView>
        </div>
      </div>
    </MotionSection>
  );
}
