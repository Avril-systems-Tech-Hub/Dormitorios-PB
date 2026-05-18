import Image from "next/image";
import type { ComponentType } from "react";
import { FadeInView, MotionSection, StaggerGrid, StaggerItem } from "./motion";

const iconClass = "h-6 w-6";

function IconWifi({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M3 9.5a15 15 0 0 1 18 0" />
      <path d="M6.5 13a10 10 0 0 1 11 0" />
      <path d="M10 16.5a5 5 0 0 1 4 0" />
      <circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconReception({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M3 18h18" />
      <path d="M6 18v-4.5A2.5 2.5 0 0 1 8.5 11h7A2.5 2.5 0 0 1 18 13.5V18" />
      <path d="M10.5 11V8.8a1.5 1.5 0 0 1 3 0V11" />
    </svg>
  );
}

function IconShower({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M4 4v4M7 4v4M10 4v4M13 4v4M16 4v4M19 4v4" />
      <path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
      <path d="M8 20v2M16 20v2" />
    </svg>
  );
}

const services: {
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
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
    Icon: IconShower,
  },
];

export function ServicesSection() {
  return (
    <MotionSection id="servicios" subtle className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14">
      <FadeInView className="mb-8 max-w-2xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-terracotta">Servicios</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-mkt-ink">Todo lo que necesitas para tu noche</h2>
        <p className="mt-2 text-mkt-ink-muted">Comodidades incluidas en tu estancia, sin costos ocultos.</p>
      </header>
      </FadeInView>

      <FadeInView className="mb-8 flex flex-col items-center gap-5 rounded-2xl border border-dashed border-mkt-border bg-mkt-canvas-elevated/60 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6 lg:gap-8" delay={0.06}>
        <div className="min-w-0 flex-1 text-center sm:text-left sm:pr-2">
          <p className="text-lg font-semibold leading-snug tracking-tight text-mkt-ink sm:text-xl">
            Dormitorios Plaza Basílica
          </p>
          <p className="mt-2 text-base leading-relaxed text-mkt-ink-muted sm:mt-2.5 sm:text-[1.0625rem] lg:text-lg lg:leading-relaxed">
            Literas, áreas comunes y atención en recepción para que solo te preocupes por descansar.
          </p>
        </div>
        <div className="relative w-[10.5rem] shrink-0 sm:w-[11.5rem] lg:w-[12.5rem]" aria-hidden>
          <Image
            src="/illustrations/1.png"
            alt=""
            width={500}
            height={500}
            className="h-auto w-full object-contain"
            sizes="(max-width: 640px) 168px, 200px"
          />
        </div>
      </FadeInView>

      <StaggerGrid className="grid gap-5 md:grid-cols-3 md:gap-6">
        {services.map(({ title, body, Icon }) => (
          <StaggerItem key={title}>
            <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-mkt-border/90 bg-gradient-to-br from-mkt-card to-mkt-canvas-elevated p-6 shadow-md shadow-mkt-chocolate/8 transition hover:border-mkt-terracotta/35 hover:shadow-lg hover:shadow-mkt-chocolate/12">
              <div className="border-b-4 border-mkt-terracotta pb-5">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-mkt-terracotta/15 text-mkt-terracotta transition group-hover:bg-mkt-terracotta group-hover:text-white">
                  <Icon />
                </span>
              </div>
              <div className="pt-5">
                <h3 className="text-lg font-semibold text-mkt-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-mkt-ink-muted">{body}</p>
              </div>
            </article>
          </StaggerItem>
        ))}
      </StaggerGrid>
    </MotionSection>
  );
}
