export const MEXICO_CITY_TZ = "America/Mexico_City";

export function getMexicoCityDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MEXICO_CITY_TZ }).format(date);
}

/** CDMX is UTC−6 year-round (no DST since 2022). */
const CDMX_OFFSET = "-06:00";

/** Parse YYYY-MM-DD as noon CDMX so labels/weekdays match on UTC servers (e.g. Vercel). */
export function mexicoCityCalendarDate(dateString: string) {
  return new Date(`${dateString}T12:00:00.000${CDMX_OFFSET}`);
}

/** Wall-clock time in CDMX as an ISO timestamptz string (for DB inserts). */
export function mexicoCityDateTime(dateString: string, time: string) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${dateString}T${normalized}${CDMX_OFFSET}`;
}

/** Format an instant (timestamptz / ISO) for display in Mexico City. */
export function formatMexicoCityDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  return new Date(value).toLocaleString("es-MX", { ...options, timeZone: MEXICO_CITY_TZ });
}

function daysInCalendarMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function mexicoCityYmdFromDate(date: Date) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(date);
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

export function mexicoCityMondayFirstColumnOffset(dateString: string) {
  return (mexicoCityWeekday(dateString) + 6) % 7;
}

function mexicoCityWeekday(dateString: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
  }).format(mexicoCityCalendarDate(dateString));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

export function paymentReceivedAtToMexicoDate(receivedAt: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(
    new Date(receivedAt),
  );
}

export function getMexicoCityDayBounds(dateString: string) {
  return {
    start: dateString,
    end: dateString,
    startAt: `${dateString}T00:00:00.000${CDMX_OFFSET}`,
    endAt: `${dateString}T23:59:59.999${CDMX_OFFSET}`,
  };
}

export function getMexicoCityMonthBounds(dateString: string) {
  const [yearStr, monthStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = `${yearStr}-${monthStr}-01`;
  const lastDay = daysInCalendarMonth(year, month);
  const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  const startBounds = getMexicoCityDayBounds(start);
  const endBounds = getMexicoCityDayBounds(end);

  return {
    start,
    end,
    startAt: startBounds.startAt,
    endAt: endBounds.endAt,
  };
}

export function formatMexicoCityMonthLabel(dateString: string) {
  const monthKey = dateString.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  return mexicoCityCalendarDate(formatDateParts(year, month, 15)).toLocaleDateString("es-MX", {
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

export function getMexicoCityMonthBoundsFromKey(monthKey: string) {
  return getMexicoCityMonthBounds(financeMonthKeyToAnchorDate(monthKey));
}

export function formatMexicoCityDayLabel(dateString: string) {
  return mexicoCityCalendarDate(dateString).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

export function isDateInMonth(dateString: string, monthKey: string) {
  const { start, end } = getMexicoCityMonthBoundsFromKey(monthKey);
  return dateString >= start && dateString <= end;
}

export function parseFinanceDayKey(
  value: string | string[] | undefined,
  monthKey: string,
  fallbackDate = getMexicoCityDateString(),
) {
  const { start, end } = getMexicoCityMonthBoundsFromKey(monthKey);
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw >= start && raw <= end) {
    return raw;
  }
  if (fallbackDate >= start && fallbackDate <= end) return fallbackDate;
  return end;
}

export function parseFinanceWeekAnchor(
  value: string | string[] | undefined,
  monthKey: string,
  fallbackDate = getMexicoCityDateString(),
) {
  const dayInMonth = parseFinanceDayKey(value, monthKey, fallbackDate);
  const weekBounds = getMexicoCityWeekBounds(dayInMonth);
  const { start: monthStart, end: monthEnd } = getMexicoCityMonthBoundsFromKey(monthKey);

  if (weekBounds.end >= monthStart && weekBounds.start <= monthEnd) {
    return weekBounds.start;
  }

  return monthStart;
}

export function getFinanceDayOptions(monthKey: string) {
  const { start, end } = getMexicoCityMonthBoundsFromKey(monthKey);
  let { year, month, day } = (() => {
    const [y, m, d] = start.split("-").map(Number);
    return { year: y, month: m, day: d };
  })();
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const options: { value: string; label: string }[] = [];

  while (
    year < endYear ||
    (year === endYear && month < endMonth) ||
    (year === endYear && month === endMonth && day <= endDay)
  ) {
    const value = formatDateParts(year, month, day);
    options.push({
      value,
      label: formatMexicoCityDayLabel(value),
    });
    if (value === end) break;
    ({ year, month, day } = addDays(year, month, day, 1));
  }

  return options.reverse();
}

export function getFinanceWeekOptions(monthKey: string) {
  const days = getFinanceDayOptions(monthKey);
  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [];

  for (const day of days) {
    const { start } = getMexicoCityWeekBounds(day.value);
    if (seen.has(start)) continue;
    seen.add(start);
    options.push({
      value: start,
      label: getReservationPeriodBounds("week", day.value).label,
    });
  }

  return options.reverse();
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
  const date = mexicoCityCalendarDate(formatDateParts(year, month, day));
  date.setTime(date.getTime() + delta * 24 * 60 * 60 * 1000);
  return mexicoCityYmdFromDate(date);
}

export function getMexicoCityWeekBounds(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const dayOfWeek = mexicoCityWeekday(dateString);
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const startParts = addDays(year, month, day, -daysFromMonday);
  const endParts = addDays(startParts.year, startParts.month, startParts.day, 6);
  const start = formatDateParts(startParts.year, startParts.month, startParts.day);
  const end = formatDateParts(endParts.year, endParts.month, endParts.day);
  const startBounds = getMexicoCityDayBounds(start);
  const endBounds = getMexicoCityDayBounds(end);

  return {
    start,
    end,
    startAt: startBounds.startAt,
    endAt: endBounds.endAt,
  };
}

export function getReservationPeriodBounds(
  period: ReservationPeriod,
  dateString = getMexicoCityDateString(),
) {
  if (period === "day") {
    const { startAt, endAt } = getMexicoCityDayBounds(dateString);
    const label = mexicoCityCalendarDate(dateString).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Mexico_City",
    });
    return { start: dateString, end: dateString, startAt, endAt, label };
  }

  if (period === "week") {
    const bounds = getMexicoCityWeekBounds(dateString);
    const startLabel = mexicoCityCalendarDate(bounds.start).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      timeZone: "America/Mexico_City",
    });
    const endLabel = mexicoCityCalendarDate(bounds.end).toLocaleDateString("es-MX", {
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
