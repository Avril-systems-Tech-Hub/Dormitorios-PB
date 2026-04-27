import Image from "next/image";
import Link from "next/link";
import { createReservationAction } from "@/actions/operations";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReservationForm } from "@/components/forms/reservation-form";

const iconClassName = "h-5 w-5";

const IconLocation = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const IconShield = ({ className = iconClassName }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
    <path d="M12 3 5.5 5.8v6.4c0 4.4 2.9 7.5 6.5 8.8 3.6-1.3 6.5-4.4 6.5-8.8V5.8L12 3Z" />
    <path d="m9.5 12 1.8 1.8 3.2-3.2" />
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

const rooms = [
  {
    title: "Habitación Estándar",
    description: "Cama cómoda, ventilación natural y descanso garantizado.",
    price: "$490 / noche",
  },
  {
    title: "Habitación Familiar",
    description: "Espacio amplio para grupos y familias que visitan la Basílica.",
    price: "$790 / noche",
  },
  {
    title: "Suite Ejecutiva",
    description: "Mayor privacidad y confort para estancias largas.",
    price: "$990 / noche",
  },
];

const featureHighlights = [
  {
    title: "Ubicación ideal",
    body: "A minutos de la Basílica y zonas clave.",
    Icon: IconLocation,
  },
  {
    title: "Atención 24/7",
    body: "Soporte y asistencia en todo momento.",
    Icon: IconShield,
  },
  {
    title: "Mejor precio",
    body: "Tarifas flexibles para estancias cortas y largas.",
    Icon: IconPrice,
  },
];

const services = [
  {
    title: "Wifi estable",
    body: "Conexión rápida en habitaciones y áreas comunes.",
    Icon: IconWifi,
  },
  {
    title: "Recepción activa",
    body: "Soporte de check-in y checkout ágil.",
    Icon: IconReception,
  },
  {
    title: "Limpieza diaria",
    body: "Habitaciones ordenadas y listas para descansar.",
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
    <main className="min-h-screen bg-[#f7f6f3] text-[#1f3f54]">
      <section className="border-b border-[#d8d5cd] bg-white/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-dorm.png" alt="Logo Dormitorios" width={40} height={40} className="rounded-full" />
            <p className="text-sm font-semibold tracking-[0.2em] text-[#6f3f14]">DORMITORIOS Plaza Basílica</p>
          </div>
          <div className="hidden items-center gap-6 text-sm md:flex">
            <a href="#habitaciones" className="hover:text-[#c66a43]">Habitaciones</a>
            <a href="#servicios" className="hover:text-[#c66a43]">Servicios</a>
            <a href="#opiniones" className="hover:text-[#c66a43]">Opiniones</a>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#1f5a78] px-5 text-sm font-medium text-white transition hover:bg-[#184860]"
          >
            Entrar
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-2 md:items-center">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6f3f14]">Hotel y descanso</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
            Disfruta tu estancia en <span className="text-[#c66a43]">Dormitorios Plaza Basílica</span>
          </h1>
          <p className="max-w-xl text-[#436276]">
            Hospedaje cómodo, ubicación estratégica y atención cálida para viajeros, familias y
            grupos que buscan tranquilidad en Ciudad de México.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#reserva"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#c66a43] px-6 text-sm font-semibold text-white transition hover:bg-[#a95432]"
            >
              Reservar ahora
            </a>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#1f5a78] px-6 text-sm font-semibold text-[#1f5a78] transition hover:bg-[#e8f1f6]"
            >
              Ver disponibilidad
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-[2rem] border border-[#d7d7d7] bg-white p-3 shadow-xl">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem]">
            <Image
              src="/screencapture-ethemestudio-demo-rovero-2026-04-21-01_30_03.png"
              alt="Inspiración visual del hotel"
              fill
              className="object-cover object-top"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-5 md:grid-cols-3">
          {featureHighlights.map(({ title, body, Icon }) => (
            <article key={title} className="rounded-2xl border border-[#dfddd8] bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f2f7] text-[#1f5a78]">
                <Icon />
              </div>
              <h3 className="font-semibold text-[#1f3f54]">{title}</h3>
              <p className="mt-2 text-sm text-[#567183]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="reserva" className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f3f14]">Reserva tu habitación</p>
          <h2 className="text-3xl font-semibold">Check-in rápido, control total de caja</h2>
          <p className="text-[#567183]">
            Cliente nuevo o recurrente: captura datos, elige cama o autoasigna, genera folio y paga en caja.
          </p>
          <form method="get" className="mt-4 rounded-2xl border border-[#d8d4ce] bg-white p-4">
            <p className="text-sm font-semibold text-[#1f3f54]">Cliente recurrente</p>
            <p className="mt-1 text-xs text-[#567183]">
              Ingresa solo teléfono para recuperar nombre/correo y aplicar descuento por captura completa.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                name="phone"
                defaultValue={recurrentPhone}
                className="h-10 flex-1 rounded-lg border border-[#d9d9d9] px-3 text-sm"
                placeholder="Teléfono"
              />
              <button className="rounded-lg bg-[#1f5a78] px-4 text-sm font-semibold text-white hover:bg-[#184860]" type="submit">
                Buscar
              </button>
            </div>
          </form>
        </div>
        <ReservationForm action={createReservationAction} beds={beds ?? []} recurringGuest={recurringGuest} />
      </section>

      <section id="habitaciones" className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f3f14]">Nuestras habitaciones</p>
            <h2 className="text-3xl font-semibold">Espacios cómodos para cada viaje</h2>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {rooms.map((room) => (
            <article key={room.title} className="overflow-hidden rounded-2xl border border-[#e1ddd6] bg-white">
              <div className="h-44 bg-gradient-to-br from-[#3f708d] via-[#5f87a1] to-[#c66a43]" />
              <div className="space-y-2 p-5">
                <h3 className="font-semibold">{room.title}</h3>
                <p className="text-sm text-[#587485]">{room.description}</p>
                <p className="pt-1 font-semibold text-[#6f3f14]">{room.price}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative my-12 overflow-hidden bg-[#214d66] px-6 py-16 text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1e4a62] via-[#255873] to-[#c66a43]/70" />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-white/80">Oferta de temporada</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Conoce tu vida al estilo Dormitorios</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/85 md:text-base">
            Descuentos especiales en reservas anticipadas y estancias extendidas.
          </p>
          <a
            href="#reserva"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#1f4f68]"
          >
            Reservar promoción
          </a>
        </div>
      </section>

      <section id="servicios" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {services.map(({ title, body, Icon }) => (
            <article key={title} className="rounded-2xl border border-[#e1ddd6] bg-white p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4f8] text-[#1f5a78]">
                <Icon />
              </div>
              <h3 className="font-semibold text-[#1f3f54]">{title}</h3>
              <p className="mt-2 text-sm text-[#587485]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="opiniones" className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#6f3f14]">Testimonios</p>
        <h2 className="mt-2 text-center text-3xl font-semibold">Lo que dicen nuestros huéspedes</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map(([quote, name]) => (
            <article key={name} className="rounded-2xl border border-[#dfddd8] bg-white p-6">
              <div className="mb-3 text-[#1f5a78]">
                <IconQuote />
              </div>
              <p className="text-sm text-[#38586c]">&ldquo;{quote}&rdquo;</p>
              <p className="mt-4 text-sm font-semibold text-[#6f3f14]">{name}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#f0ece6] px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-[#ddd7ce] bg-white p-8 text-center">
          <h2 className="text-3xl font-semibold text-[#1f3f54]">Suscríbete para ofertas exclusivas</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[#567183]">
            Recibe promociones de temporada y noticias de disponibilidad.
          </p>
          <div className="mx-auto mt-5 flex max-w-xl flex-col gap-3 md:flex-row">
            <input
              className="h-11 flex-1 rounded-full border border-[#d8d8d8] px-4 text-sm"
              placeholder="Tu correo electrónico"
            />
            <button className="h-11 rounded-full bg-[#c66a43] px-6 text-sm font-semibold text-white hover:bg-[#ad5a36]">
              Suscribirme
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-[#12364a] px-6 py-10 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <Image src="/logo-dorm.png" alt="Logo Dormitorios" width={34} height={34} className="rounded-full" />
              <p className="text-sm font-semibold tracking-[0.2em]">DORMITORIOS</p>
            </div>
            <p className="mt-3 max-w-md text-sm text-white/75">
              Hospedaje cómodo cerca de la Basílica, con atención humana y procesos ágiles.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Navegación</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li><a href="#habitaciones">Habitaciones</a></li>
              <li><a href="#servicios">Servicios</a></li>
              <li><a href="#opiniones">Opiniones</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Contacto</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li>+52 55 0000 0000</li>
              <li>Ciudad de México</li>
              <li>reservas@dormitorios.mx</li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
