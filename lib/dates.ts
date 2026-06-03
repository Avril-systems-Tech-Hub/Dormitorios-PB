export function getMexicoCityDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(date);
}

export function getMexicoCityDayBounds(dateString: string) {
  return {
    start: `${dateString}T00:00:00`,
    end: `${dateString}T23:59:59`,
  };
}

export function getMexicoCityMonthBounds(dateString: string) {
  const [yearStr, monthStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  return {
    start,
    end,
    startAt: `${start}T00:00:00`,
    endAt: `${end}T23:59:59`,
  };
}

export function formatMexicoCityMonthLabel(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

export function getMexicoCityMonthKey(dateString = getMexicoCityDateString()) {
  return dateString.slice(0, 7);
}

export function parseFinanceMonthKey(
  value: string | string[] | undefined,
  fallbackDate = getMexicoCityDateString(),
) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    if (month >= 1 && month <= 12) return raw;
  }
  return getMexicoCityMonthKey(fallbackDate);
}

export function financeMonthKeyToAnchorDate(monthKey: string) {
  return `${monthKey}-01`;
}

export function getFinanceMonthOptions(count = 24, anchorDate = getMexicoCityDateString()) {
  const [year, month] = anchorDate.split("-").map(Number);
  let cursorYear = year;
  let cursorMonth = month;
  const options: { value: string; label: string }[] = [];

  for (let i = 0; i < count; i++) {
    const value = `${cursorYear}-${String(cursorMonth).padStart(2, "0")}`;
    options.push({
      value,
      label: formatMexicoCityMonthLabel(financeMonthKeyToAnchorDate(value)),
    });

    cursorMonth -= 1;
    if (cursorMonth === 0) {
      cursorMonth = 12;
      cursorYear -= 1;
    }
  }

  return options;
}

export type ReservationPeriod = "day" | "week" | "month";

export function parseReservationPeriod(
  value: string | string[] | undefined,
): ReservationPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "day" || raw === "week" || raw === "month") return raw;
  return "month";
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function getMexicoCityWeekBounds(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const anchor = new Date(year, month - 1, day);
  const dayOfWeek = anchor.getDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const startParts = addDays(year, month, day, -daysFromMonday);
  const endParts = addDays(startParts.year, startParts.month, startParts.day, 6);
  const start = formatDateParts(startParts.year, startParts.month, startParts.day);
  const end = formatDateParts(endParts.year, endParts.month, endParts.day);

  return {
    start,
    end,
    startAt: `${start}T00:00:00`,
    endAt: `${end}T23:59:59`,
  };
}

export function getReservationPeriodBounds(
  period: ReservationPeriod,
  dateString = getMexicoCityDateString(),
) {
  if (period === "day") {
    const { start, end } = getMexicoCityDayBounds(dateString);
    const label = new Date(`${dateString}T12:00:00`).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Mexico_City",
    });
    return { start: dateString, end: dateString, startAt: start, endAt: end, label };
  }

  if (period === "week") {
    const bounds = getMexicoCityWeekBounds(dateString);
    const startLabel = new Date(`${bounds.start}T12:00:00`).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      timeZone: "America/Mexico_City",
    });
    const endLabel = new Date(`${bounds.end}T12:00:00`).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Mexico_City",
    });
    return {
      ...bounds,
      label: `${startLabel} – ${endLabel}`,
    };
  }

  const bounds = getMexicoCityMonthBounds(dateString);
  return {
    start: bounds.start,
    end: bounds.end,
    startAt: bounds.startAt,
    endAt: bounds.endAt,
    label: formatMexicoCityMonthLabel(dateString),
  };
}
