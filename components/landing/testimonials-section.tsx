import { FadeInView, MotionSection, StaggerGrid, StaggerItem } from "./motion";

const testimonials = [
  { quote: "Excelente ubicación y trato amable.", name: "María G.", initials: "MG" },
  { quote: "Ideal para descansar antes de un viaje temprano.", name: "Carlos R.", initials: "CR" },
  { quote: "Proceso de reserva muy fácil y rápido.", name: "Lucía T.", initials: "LT" },
] as const;

function StarRow() {
  return (
    <div className="flex gap-0.5 text-mkt-terracotta" aria-label="5 de 5 estrellas">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M10 1.5 12.4 7.2l6.1.5-4.6 4 1.4 6-5.3-3.2L4.5 18l1.4-6-4.6-4 6.1-.5L10 1.5Z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <MotionSection
      id="opiniones"
      subtle
      className="border-y border-mkt-border bg-mkt-canvas-elevated px-4 py-12 md:px-6 md:py-14"
      aria-labelledby="opiniones-heading"
    >
      <div className="mx-auto max-w-6xl">
        <FadeInView className="mx-auto max-w-2xl text-center">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-chocolate">Testimonios</p>
          <h2 id="opiniones-heading" className="mt-2 text-3xl font-semibold tracking-tight text-mkt-ink">
            Lo que dicen nuestros huéspedes
          </h2>
        </header>
        </FadeInView>

        <StaggerGrid className="mt-10 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-mkt-border">
          {testimonials.map(({ quote, name, initials }) => (
            <StaggerItem key={name} className="md:px-8 md:first:pl-0 md:last:pr-0">
              <figure className="relative flex flex-col items-center text-center md:items-start md:text-left">
                <span
                  className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 font-serif text-6xl leading-none text-mkt-terracotta/20 md:left-0 md:translate-x-0"
                  aria-hidden
                >
                  &ldquo;
                </span>
                <StarRow />
                <blockquote className="relative mt-4 text-base leading-relaxed text-mkt-ink md:text-[1.05rem]">
                  {quote}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mkt-slate/15 text-sm font-semibold text-mkt-slate"
                    aria-hidden
                  >
                    {initials}
                  </span>
                  <span className="text-sm font-semibold text-mkt-chocolate">{name}</span>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </MotionSection>
  );
}
