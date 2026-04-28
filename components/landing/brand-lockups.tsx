import Image from "next/image";

/** Social-style horizontal lockups for brand continuity. */
export function BrandLockups() {
  return (
    <section className="border-b border-mkt-border bg-mkt-card/90 py-5" aria-label="Identidad visual">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 md:flex-row md:gap-10 md:px-6">
        <Image
          src="/marketing/brand-banner-light.png"
          alt="Dormitorios Plaza Basílica — Renta de camas por noche"
          width={420}
          height={120}
          className="h-auto max-h-24 w-full max-w-md object-contain"
        />
        <Image
          src="/marketing/brand-banner-dark.png"
          alt="Dormitorios Plaza Basílica — variante oscura"
          width={420}
          height={120}
          className="h-auto max-h-24 w-full max-w-md object-contain"
        />
      </div>
    </section>
  );
}
