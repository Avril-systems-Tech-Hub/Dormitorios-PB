"use client";

import { useMemo, useState, useEffect } from "react";
import { searchGuestByPhoneAction } from "@/actions/operations";

type ReservationFormProps = {
  action: (formData: FormData) => Promise<void>;
  beds: { bed_number: number }[];
  recurringGuest?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    sex?: string | null;
  } | null;
};

type FieldErrors = Partial<Record<"full_name" | "phone" | "email" | "check_in_date" | "check_out_date", string>>;

export function ReservationForm({ action, beds, recurringGuest }: ReservationFormProps) {
  const [guestCount, setGuestCount] = useState(1);
  const [guests, setGuests] = useState([
    { full_name: "", phone: "", email: "", sex: "unknown" }
  ]);

  const [reservationData, setReservationData] = useState({
    check_in_date: "",
    check_out_date: "",
    notes: ""
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Cuando cambie el número de huéspedes, ajustamos el arreglo
  useEffect(() => {
    setGuests(prev => {
      const newGuests = [...prev];
      if (guestCount > prev.length) {
        for (let i = prev.length; i < guestCount; i++) {
          newGuests.push({ full_name: "", phone: "", email: "", sex: "unknown" });
        }
      } else if (guestCount < prev.length) {
        newGuests.splice(guestCount);
      }
      return newGuests;
    });
  }, [guestCount]);

  const [searchPhone, setSearchPhone] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (recurringGuest) {
      setGuests((prev) => {
        const newGuests = [...prev];
        newGuests[0] = {
          ...newGuests[0],
          full_name: recurringGuest.full_name || newGuests[0].full_name,
          phone: recurringGuest.phone || newGuests[0].phone,
          email: recurringGuest.email || newGuests[0].email,
        };
        return newGuests;
      });
    }
  }, [recurringGuest]);

  const handleSearch = async () => {
    setSearchError("");
    if (!searchPhone) return;
    setIsSearching(true);
    try {
      const res = await searchGuestByPhoneAction(searchPhone);
      if (res.success && res.guest) {
        setGuests((prev) => {
          const newGuests = [...prev];
          newGuests[0] = {
            ...newGuests[0],
            full_name: res.guest.full_name || newGuests[0].full_name,
            phone: res.guest.phone || newGuests[0].phone,
            email: res.guest.email || newGuests[0].email,
            sex: res.guest.sex || newGuests[0].sex,
          };
          return newGuests;
        });
      } else {
        setSearchError("No se encontró el número.");
      }
    } catch (e) {
      setSearchError("Error al buscar.");
    } finally {
      setIsSearching(false);
    }
  };

  const errors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {};
    if (!reservationData.check_in_date) next.check_in_date = "Selecciona fecha de entrada.";
    if (!reservationData.check_out_date) next.check_out_date = "Selecciona fecha de salida.";
    if (reservationData.check_in_date && reservationData.check_out_date && reservationData.check_out_date <= reservationData.check_in_date) {
      next.check_out_date = "La salida debe ser posterior al check-in.";
    }
    return next;
  }, [reservationData]);

  const updateGuest = (index: number, field: string, value: string) => {
    setGuests(prev => {
      const newGuests = [...prev];
      newGuests[index] = { ...newGuests[index], [field]: value };
      return newGuests;
    });
  };

  const handleWhatsappSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    // Verificar si hay errores antes de enviar
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) return;

    let text = `Hola, estos son los datos de mi reservación en Dormitorios Plaza Basilica.\n\n`;
    text += `Entrada: ${reservationData.check_in_date}\n`;
    text += `Salida: ${reservationData.check_out_date}\n`;
    text += `Personas: ${guestCount}\n\n`;

    guests.forEach((g, i) => {
      text += `--- Huésped ${i + 1} ---\n`;
      text += `Nombre: ${g.full_name}\n`;
      text += `WhatsApp: ${g.phone}\n`;
      text += `Correo: ${g.email}\n`;
      text += `Sexo: ${g.sex === "unknown" ? "No especificado" : g.sex}\n\n`;
    });

    if (reservationData.notes) {
      text += `Notas: ${reservationData.notes}\n`;
    }

    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send/?phone=527712929008&text=${encodedText}`;
    window.open(url, "_blank");
  };

  const showError = (name: keyof FieldErrors) => (submitAttempted || touched[name]) && Boolean(errors[name]);

  return (
    <div className="flex flex-col gap-4">
      {/* Buscador de Cliente Recurrente (Client-side, sin recargar página) */}
      <div className="rounded-2xl border border-mkt-border bg-mkt-card p-4 shadow-sm">
        <p className="text-sm font-semibold text-mkt-ink">Cliente recurrente</p>
        <p className="mt-1 text-xs text-mkt-ink-muted">
          Ingresa teléfono para autocompletar y aplicar descuento.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-mkt-border bg-white px-3 text-sm text-mkt-ink outline-none focus:border-mkt-slate"
            placeholder="Teléfono (ej. 7712...)"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-lg bg-mkt-slate px-4 text-sm font-semibold text-white transition hover:bg-mkt-slate-deep disabled:opacity-50"
          >
            {isSearching ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {searchError && <p className="mt-2 text-xs text-red-500">{searchError}</p>}
      </div>

      <form
        className="rounded-3xl border border-mkt-border bg-mkt-card p-6 shadow-sm"
        onSubmit={handleWhatsappSubmit}
        noValidate
      >
        {/* Rango de Fechas y Personas (Nivel Reservación) */}
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-mkt-ink-muted">Entrada</label>
            <input
              name="check_in_date"
              type="date"
              className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
              required
              value={reservationData.check_in_date}
              onChange={(e) => setReservationData((prev) => ({ ...prev, check_in_date: e.target.value }))}
              onBlur={() => setTouched((prev) => ({ ...prev, check_in_date: true }))}
            />
            {showError("check_in_date") ? <p className="mt-1 text-xs text-red-600">{errors.check_in_date}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mkt-ink-muted">Salida</label>
            <input
              name="check_out_date"
              type="date"
              className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
              required
              value={reservationData.check_out_date}
              onChange={(e) => setReservationData((prev) => ({ ...prev, check_out_date: e.target.value }))}
              onBlur={() => setTouched((prev) => ({ ...prev, check_out_date: true }))}
            />
            {showError("check_out_date") ? <p className="mt-1 text-xs text-red-600">{errors.check_out_date}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mkt-ink-muted">Personas</label>
            <input
              type="number"
              min="1"
              max="20"
              className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Tarjetas de Huéspedes Dinámicas */}
        <div className="space-y-4">
          <p className="text-xs text-mkt-ink-muted">* Nota: El Husped 1 sera el Huesped Principal</p>
          {guests.map((guest, index) => (
            <div key={index} className="rounded-xl border border-mkt-border bg-gray-50/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-mkt-ink">Huésped {index + 1}</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
                  placeholder="Nombre completo"
                  value={guest.full_name}
                  required
                  onChange={(e) => updateGuest(index, "full_name", e.target.value)}
                />
                <input
                  type="tel"
                  className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
                  placeholder="Teléfono"
                  value={guest.phone}
                  required
                  onChange={(e) => updateGuest(index, "phone", e.target.value)}
                />
                <input
                  type="email"
                  className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
                  placeholder="Correo electrónico"
                  value={guest.email}
                  required
                  onChange={(e) => updateGuest(index, "email", e.target.value)}
                />
                <select
                  className="rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
                  value={guest.sex}
                  onChange={(e) => updateGuest(index, "sex", e.target.value)}
                >
                  <option value="unknown">Sexo</option>
                  <option value="f">Femenino</option>
                  <option value="m">Masculino</option>
                  <option value="x">Otro</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Notas Generales */}
        <textarea
          name="notes"
          className="mt-6 min-h-20 w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
          placeholder="Notas de la reservación (opcional)"
          value={reservationData.notes}
          onChange={(e) => setReservationData(prev => ({ ...prev, notes: e.target.value }))}
        />
        <p className="mt-3 text-xs text-mkt-ink-muted">Las camas serán asignadas por el recepcionista a su llegada.</p>
        <button type="submit" className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-[#25D366] px-4 font-semibold text-white transition-colors hover:bg-[#1DA851]">
          <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 fill-current" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
          Enviar reservación
        </button>
      </form >
    </div >
  );
}
