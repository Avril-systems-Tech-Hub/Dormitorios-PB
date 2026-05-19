import Image from "next/image";
import { ReservationWizardTrigger } from "@/components/forms/reservation-wizard-trigger";
import {
  ADDRESS_LINE,
  MAP_SEARCH_HREF,
  SITE_HOST,
  SITE_URL,
  WHATSAPP_DISPLAY,
  WHATSAPP_HREF,
} from "./constants";

export function LandingFooter() {
  return (
    <footer className="bg-mkt-footer px-4 py-10 text-white md:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <Image src="/logo-dorm.png" alt="Dormitorios Plaza Basílica" width={36} height={36} className="rounded-full" />
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-white/90">DORMITORIOS</p>
              <p className="text-sm font-semibold">Plaza Basílica</p>
            </div>
          </div>
          <p className="mt-3 max-w-md text-sm text-white/75">Renta de camas por noche en CDMX. Atención humana y reservas ágiles.</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Navegación</p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            <li>
              <a href="#camas" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta">
                Camas y precio
              </a>
            </li>
            <li>
              <a href="#servicios" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta">
                Servicios
              </a>
            </li>
            <li>
              <a href="#opiniones" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta">
                Opiniones
              </a>
            </li>
            <li>
              <ReservationWizardTrigger className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta">
                Reservar
              </ReservationWizardTrigger>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Contacto</p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            <li>
              <a href={WHATSAPP_HREF} className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta" target="_blank" rel="noopener noreferrer">
                WhatsApp +52 {WHATSAPP_DISPLAY}
              </a>
            </li>
            <li>
              <a href={SITE_URL} className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta" target="_blank" rel="noopener noreferrer">
                {SITE_HOST}
              </a>
            </li>
            <li>
              <a href={MAP_SEARCH_HREF} className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta" target="_blank" rel="noopener noreferrer">
                {ADDRESS_LINE}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
