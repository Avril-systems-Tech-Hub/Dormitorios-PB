"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBedsMapForChange, getBedReservations, reassignBedAction } from "@/actions/operations";

type BedInfo = {
  id: string;
  bed_number: number;
  status: string;
  occupied_by: string | null;
};

type BedReservation = {
  checkIn: string;
  checkOut: string;
  guestName: string;
  status: string;
};

/** Mini calendario mensual que muestra los días reservados */
function BedCalendar({
  reservations,
  month,
  year,
  onPrev,
  onNext,
}: {
  reservations: BedReservation[];
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const dayNames = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  // Build set of reserved dates
  const reservedDates = new Set<string>();
  for (const res of reservations) {
    const start = new Date(`${res.checkIn}T00:00:00`);
    const end = new Date(`${res.checkOut}T00:00:00`);
    const current = new Date(start);
    while (current < end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
      reservedDates.add(key);
      current.setDate(current.getDate() + 1);
    }
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday=0, Sunday=6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: Array<{
    day: number;
    dateStr: string;
    isReserved: boolean;
    isToday: boolean;
    isCurrentMonth: boolean;
  }> = [];

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    cells.push({ day: 0, dateStr: "", isReserved: false, isToday: false, isCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      day: d,
      dateStr,
      isReserved: reservedDates.has(dateStr),
      isToday: dateStr === todayStr,
      isCurrentMonth: true,
    });
  }

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between mb-1">
        <button type="button" onClick={onPrev} className="text-xs px-1 hover:text-blue-600">◀</button>
        <span className="text-xs font-semibold text-text-main">{monthNames[month]} {year}</span>
        <button type="button" onClick={onNext} className="text-xs px-1 hover:text-blue-600">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dayNames.map((dn) => (
          <div key={dn} className="text-[9px] font-medium text-text-muted py-0.5">{dn}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.isCurrentMonth) {
            return <div key={`e-${i}`} />;
          }
          return (
            <div
              key={cell.dateStr}
              className={`text-[10px] leading-tight rounded px-0.5 py-0.5 ${
                cell.isReserved
                  ? "bg-red-100 text-red-700 font-bold"
                  : cell.isToday
                    ? "bg-blue-100 text-blue-700 font-semibold"
                    : "text-text-main"
              }`}
              title={cell.isReserved ? "Reservada" : cell.isToday ? "Hoy" : undefined}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
      {reservations.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {reservations.map((res, i) => (
            <div key={i} className="text-[10px] text-text-muted flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${res.status === "active" ? "bg-yellow-400" : "bg-green-400"}`} />
              <span className="font-medium">{res.guestName}</span>
              <span>{res.checkIn} → {res.checkOut}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BedChangeButton({
  reservationId,
  guestId,
  bedNumber = null,
  returnTo = "/dashboard/reservations",
}: {
  reservationId: string;
  guestId: string;
  bedNumber?: number | null;
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [beds, setBeds] = useState<BedInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Calendar state
  const [calendarBedId, setCalendarBedId] = useState<string | null>(null);
  const [calendarReservations, setCalendarReservations] = useState<BedReservation[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const handleOpen = () => {
    setOpen(true);
    setLoading(true);
    setSelected(null);
    setCalendarBedId(null);
    getBedsMapForChange().then((data) => {
      setBeds(data);
      setLoading(false);
    });
  };

  const handleShowCalendar = (bedId: string) => {
    if (calendarBedId === bedId) {
      setCalendarBedId(null);
      return;
    }
    setCalendarBedId(bedId);
    setCalendarLoading(true);
    setCalendarReservations([]);
    const now = new Date();
    setCalendarMonth({ month: now.getMonth(), year: now.getFullYear() });
    getBedReservations(bedId).then((data) => {
      setCalendarReservations(data);
      setCalendarLoading(false);
    });
  };

  const hasBed = bedNumber != null && bedNumber > 0;

  const closeModal = () => {
    setOpen(false);
    setSelected(null);
    setCalendarBedId(null);
  };

  const handleAssign = () => {
    if (!selected) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reservation_id", reservationId);
      fd.set("guest_id", guestId);
      fd.set("new_bed_id", selected);
      fd.set("return_to", returnTo);
      const result = await reassignBedAction(fd);
      if (result.status === "success") {
        toast.success(result.message);
        closeModal();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      {hasBed ? (
        <>
          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-text-main">
            Cama {bedNumber}
          </span>
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex h-7 items-center rounded-md border border-border-soft bg-white px-2 text-xs font-medium text-text-main transition hover:bg-surface-soft"
          >
            Cambiar
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex h-7 items-center rounded-md border border-brand-primary/30 bg-brand-primary/5 px-2.5 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10"
        >
          Agregar cama
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-main">
                {hasBed ? "Cambiar cama" : "Asignar cama"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-text-muted hover:text-text-main text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Selecciona una cama libre para el huésped.
              {hasBed ? (
                <>
                  {" "}
                  Actual: <span className="font-medium text-text-main">Cama {bedNumber}</span>
                </>
              ) : null}
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-text-muted text-center">Cargando mapa de camas...</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {beds.map((bed) => {
                    const isBlocked = bed.status === "blocked";
                    const isOccupied = !!bed.occupied_by;
                    const isSelected = selected === bed.id;
                    const isDisabled = isBlocked || isOccupied;
                    const showingCalendar = calendarBedId === bed.id;

                    return (
                      <div key={bed.id} className="contents">
                        <div className="relative">
                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setSelected(bed.id)}
                            className={`w-full rounded-lg border px-2 py-2 text-center text-xs transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
                                : isBlocked
                                  ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed"
                                  : isOccupied
                                    ? "border-yellow-200 bg-yellow-50 text-yellow-700 cursor-not-allowed"
                                    : "border-border-soft bg-gray-50 hover:border-green-400 hover:bg-green-50 cursor-pointer"
                            }`}
                          >
                            <p className="font-semibold">{bed.bed_number}</p>
                            {isBlocked ? (
                              <p className="text-[10px] mt-0.5">Bloqueada</p>
                            ) : isOccupied ? (
                              <p className="text-[10px] mt-0.5 truncate">{bed.occupied_by}</p>
                            ) : (
                              <p className="text-[10px] mt-0.5 text-green-600">Libre</p>
                            )}
                          </button>
                          {/* Calendar toggle button */}
                          <button
                            type="button"
                            onClick={() => handleShowCalendar(bed.id)}
                            className={`absolute -top-1 -right-1 rounded-full w-4 h-4 flex items-center justify-center text-[8px] transition ${
                              showingCalendar
                                ? "bg-blue-500 text-white"
                                : "bg-gray-200 text-gray-500 hover:bg-blue-100 hover:text-blue-600"
                            }`}
                            title="Ver calendario de reservaciones"
                          >
                            📅
                          </button>
                        </div>
                        {/* Show calendar below the bed card */}
                        {showingCalendar && (
                          <div className="col-span-5 rounded-lg border border-blue-200 bg-blue-50/50 p-2 mt-1">
                            <p className="text-xs font-semibold text-text-main mb-1">
                              📅 Reservaciones — Cama {bed.bed_number}
                            </p>
                            {calendarLoading ? (
                              <p className="text-[10px] text-text-muted">Cargando...</p>
                            ) : calendarReservations.length === 0 ? (
                              <p className="text-[10px] text-green-600">Sin reservaciones futuras</p>
                            ) : (
                              <BedCalendar
                                reservations={calendarReservations}
                                month={calendarMonth.month}
                                year={calendarMonth.year}
                                onPrev={() => {
                                  const m = calendarMonth.month - 1;
                                  if (m < 0) setCalendarMonth({ month: 11, year: calendarMonth.year - 1 });
                                  else setCalendarMonth({ month: m, year: calendarMonth.year });
                                }}
                                onNext={() => {
                                  const m = calendarMonth.month + 1;
                                  if (m > 11) setCalendarMonth({ month: 0, year: calendarMonth.year + 1 });
                                  else setCalendarMonth({ month: m, year: calendarMonth.year });
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-text-muted">
                    {selected
                      ? `Seleccionada: Cama ${beds.find((b) => b.id === selected)?.bed_number}`
                      : "Haz click en una cama libre"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-md border border-border-soft bg-white px-3 py-1.5 text-xs font-medium text-text-main hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!selected || pending}
                      onClick={handleAssign}
                      className="rounded-md bg-mkt-slate px-3 py-1.5 text-xs font-medium text-white hover:bg-mkt-slate-deep transition disabled:opacity-40"
                    >
                      {pending ? "Asignando..." : hasBed ? "Confirmar cambio" : "Asignar cama"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}