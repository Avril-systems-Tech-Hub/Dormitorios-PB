import Image from "next/image";
import { NIGHTLY_PRICE_MXN } from "./constants";
import { FadeInView, MotionSection, StaggerGrid, StaggerItem } from "./motion";

const bullets = [
  "Sección para hombres y mujeres",
  "Regaderas con agua caliente",
  "Wifi en el alojamiento",
  "Metrobús Deportivo 18 de marzo a pocos minutos",
];

export function BentoGallery() {
  return (
    <MotionSection id="asi-somos" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <FadeInView className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-chocolate">Así somos</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-mkt-ink">Hospedaje económico en la CDMX</h2>
        <p className="mt-2 text-mkt-ink-muted">
          Fotos reales del lugar y de la fachada, tal como las compartimos en redes. Tarifa única:{" "}
          <strong className="text-mkt-terracotta">${NIGHTLY_PRICE_MXN} MXN</strong> por cama y noche.
        </p>
      </FadeInView>

      <StaggerGrid className="grid gap-6 lg:grid-cols-2 lg:items-start" stagger={0.1}>
        <StaggerItem>
          <div className="overflow-hidden rounded-3xl border border-mkt-border bg-mkt-card shadow-md">
            <div className="relative aspect-square w-full sm:aspect-[5/4]">
              <Image
                src="/marketing/images.png"
                alt="Hospedaje económico en la CDMX: camas, fachada y tarifa en Dormitorios Plaza Basílica"
                fill
                className="object-contain object-center bg-mkt-canvas-elevated"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="flex flex-col justify-center space-y-6 rounded-3xl border border-mkt-border bg-mkt-card p-6 shadow-sm md:p-8">
            <p className="text-lg font-semibold text-mkt-ink">Lo esencial para tu estancia</p>
            <ul className="space-y-3 text-mkt-ink">
              {bullets.map((line) => (
                <li key={line} className="flex gap-3 text-sm md:text-base">
                  <span
                    className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-mkt-terracotta"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-mkt-sky/80 px-4 py-3 text-sm text-mkt-ink">
              <strong className="text-mkt-terracotta">Tip:</strong> reserva en línea y llega con tu folio listo para
              caja.
            </div>
          </div>
        </StaggerItem>
      </StaggerGrid>
    </MotionSection>
  );
}
