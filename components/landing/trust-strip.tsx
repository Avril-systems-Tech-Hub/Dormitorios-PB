import { ADDRESS_LINE, MAP_SEARCH_HREF, METRO_COPY, SITE_URL, WHATSAPP_DISPLAY, WHATSAPP_HREF } from "./constants";

export function TrustStrip() {
  return (
    <section
      id="ubicacion"
      className="border-y border-mkt-border bg-mkt-slate px-4 py-6 text-white md:px-6"
      aria-label="Ubicación y contacto"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-6">
        <p className="max-w-xl text-sm leading-relaxed text-white/90">
          <span className="font-semibold text-white">Dirección.</span> {ADDRESS_LINE}
        </p>
        <p className="text-sm text-white/85 md:max-w-xs">
          <span className="font-semibold text-white">Cómo llegar.</span> {METRO_COPY}
        </p>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-mkt-terracotta px-4 py-2 text-sm font-semibold text-white transition hover:bg-mkt-terracotta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            WhatsApp {WHATSAPP_DISPLAY}
          </a>
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            dormitoriosplazabasilica.mx
          </a>
          <a
            href={MAP_SEARCH_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Ver en mapa
          </a>
        </div>
      </div>
    </section>
  );
}
