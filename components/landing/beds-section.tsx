import Image from "next/image";
import { FadeInView, MotionSection, StaggerGrid, StaggerItem } from "./motion";
import { PriceBadge } from "./price-badge";

const bedImages = [
  {
    src: "/marketing/beds-hero.png",
    alt: "Literas de tres niveles en Dormitorios Plaza Basílica",
    caption: "Literas cómodas",
  },
  {
    src: "/marketing/beds-detail.png",
    alt: "Detalle de cama con colchón y almohada",
    caption: "Tu espacio por noche",
  },
  {
    src: "/marketing/beds-room.png",
    alt: "Interior del dormitorio con literas y cortinas",
    caption: "Dormitorio compartido",
  },
  {
    src: "/marketing/beds-gender-sections.png",
    alt: "Ilustración: dormitorios separados para hombres y mujeres en Dormitorios Plaza Basílica",
    caption: "Espacios separados para hombres y mujeres",
  },
] as const;

export function BedsSection() {
  return (
    <MotionSection
      id="camas"
      className="border-y border-mkt-border bg-mkt-canvas-elevated px-4 py-12 md:px-6 md:py-14"
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <FadeInView className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-chocolate">Camas por noche</p>
            <h2 className="text-3xl font-semibold tracking-tight text-mkt-ink">Una tarifa, sin sorpresas</h2>
            <p className="text-mkt-ink-muted">
              Pagas por noche de uso de cama. Consulta disponibilidad en el panel o reserva aquí mismo. Más detalles y
              fotos del lugar en la sección{" "}
              <a href="#asi-somos" className="font-semibold text-mkt-terracotta underline-offset-2 hover:underline">
                Así somos
              </a>
              .
            </p>
          </div>
          <PriceBadge className="shrink-0" />
        </FadeInView>

        <StaggerGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {bedImages.map(({ src, alt, caption }) => (
            <StaggerItem key={src}>
              <figure className="group overflow-hidden rounded-2xl border border-mkt-border bg-mkt-card p-2 shadow-sm transition hover:shadow-md">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-mkt-canvas">
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <figcaption className="mt-2 px-1 pb-1 text-center text-xs font-medium leading-snug text-mkt-ink-muted">
                  {caption}
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </MotionSection>
  );
}
