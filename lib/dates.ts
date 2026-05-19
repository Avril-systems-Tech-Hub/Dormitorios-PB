export function getMexicoCityDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(date);
}

export function getMexicoCityDayBounds(dateString: string) {
  return {
    start: `${dateString}T00:00:00`,
    end: `${dateString}T23:59:59`,
  };
}
