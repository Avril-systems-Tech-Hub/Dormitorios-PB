export type StayRegistrationMode = "new" | "current" | "finished";

export const STAY_REGISTRATION_MODES: Array<{
  value: StayRegistrationMode;
  label: string;
  description: string;
}> = [
  {
    value: "new",
    label: "Nueva estancia",
    description: "La entrada es hoy o en una fecha futura.",
  },
  {
    value: "current",
    label: "Estancia en curso",
    description: "La persona ya está hospedada y ocupa una cama.",
  },
  {
    value: "finished",
    label: "Estancia terminada",
    description: "La persona ya salió; se registra sin afectar camas.",
  },
];

export function daysBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0;
  const from = Date.parse(`${checkIn}T12:00:00Z`);
  const to = Date.parse(`${checkOut}T12:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function validateStayDates(
  mode: StayRegistrationMode,
  checkIn: string,
  checkOut: string,
  today: string,
): string | null {
  if (!checkIn || !checkOut) return "Selecciona las fechas de entrada y salida.";
  if (checkOut <= checkIn) return "La salida debe ser posterior a la entrada.";

  if (mode === "new" && checkIn < today) {
    return "Una nueva estancia debe iniciar hoy o en una fecha futura.";
  }
  if (mode === "current" && !(checkIn < today && checkOut > today)) {
    return "Una estancia en curso debe haber iniciado antes de hoy y terminar después de hoy.";
  }
  if (mode === "finished" && checkOut > today) {
    return "Una estancia terminada no puede tener una salida futura.";
  }
  return null;
}

