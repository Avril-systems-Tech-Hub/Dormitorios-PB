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

export function getMexicoCityMonthBoundsFromKey(monthKey: string) {
  return getMexicoCityMonthBounds(financeMonthKeyToAnchorDate(monthKey));
}

export function formatMexicoCityDayLabel(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("es-MX", {
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
