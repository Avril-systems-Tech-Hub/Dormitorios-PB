import type { AnomalyFlag, GuestSex } from "@/types/domain";

const NULL_TOKENS = new Set(["", "n/a", "-", "="]);

export type ParsedImportRow = {
  source_day: string | null;
  source_name: string | null;
  source_client_no: string | null;
  source_sex: string | null;
  source_bed: string | null;
  source_locker: string | null;
  source_check_in_date: string | null;
  source_check_in_time: string | null;
  source_check_out_date: string | null;
  source_nights: string | null;
  source_bed_price: string | null;
  source_bed_amount: string | null;
  source_locker_price: string | null;
  source_locker_days: string | null;
  source_locker_amount: string | null;
  source_total: string | null;
  guest_name: string | null;
  guest_sex: GuestSex;
  bed_number: number | null;
  locker_number: number | null;
  check_in_date: string | null;
  check_in_time: string | null;
  check_out_date: string | null;
  nights: number | null;
  bed_price: number | null;
  locker_price: number | null;
  locker_days: number | null;
  bed_amount_written: number | null;
  locker_amount_written: number | null;
  total_written: number | null;
  bed_amount_calculated: number;
  locker_amount_calculated: number;
  extra_services_total: number;
  total_calculated: number;
  bed_amount_difference: number;
  locker_amount_difference: number;
  total_difference: number;
  needs_review: boolean;
  anomaly_flags: AnomalyFlag[];
  unreadable_fields: string[];
};

export function toNullableToken(value: string | undefined) {
  const normalized = (value ?? "").trim();
  if (NULL_TOKENS.has(normalized.toLowerCase())) return null;
  return normalized;
}

export function parseNullableNumber(value: string | null) {
  if (!value) return null;
  const sanitized = value.replace(/[$,\s]/g, "");
  const n = Number(sanitized);
  if (Number.isNaN(n)) return null;
  return n;
}

export function parseNullableInt(value: string | null) {
  const n = parseNullableNumber(value);
  if (n === null) return null;
  return Math.trunc(n);
}

function normalizeSex(value: string | null): GuestSex {
  if (!value) return "unknown";
  const v = value.trim().toLowerCase();
  if (v === "m" || v === "masculino" || v === "h") return "m";
  if (v === "f" || v === "femenino" || v === "mujer") return "f";
  if (v === "x" || v === "otro") return "x";
  return "unknown";
}

export function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year = 2000 + year;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const d = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return d;
}

function normalizeTime(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

export function parseTsvToRows(tsv: string): ParsedImportRow[] {
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];
  const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1);

  const get = (parts: string[], headerOptions: string[]) => {
    const idx = headers.findIndex((h) => headerOptions.includes(h));
    return idx >= 0 ? toNullableToken(parts[idx]) : null;
  };

  return rows.map((line) => {
    const parts = line.split("\t");
    const source_day = get(parts, ["dia"]);
    const source_name = get(parts, ["nombre"]);
    const source_client_no = get(parts, ["no"]);
    const source_sex = get(parts, ["sexo"]);
    const source_bed = get(parts, ["n.cama"]);
    const source_locker = get(parts, ["n.lk"]);
    const source_check_in_date = get(parts, ["fecha ingreso"]);
    const source_check_in_time = get(parts, ["hora"]);
    const source_check_out_date = get(parts, ["fecha salida"]);
    const source_nights = get(parts, ["noches"]);
    const source_bed_price = get(parts, ["precio h"]);
    const source_bed_amount = get(parts, ["importe h"]);
    const source_locker_price = get(parts, ["precio lk"]);
    const source_locker_days = get(parts, ["dias lk"]);
    const source_locker_amount = get(parts, ["importe lk"]);
    const source_total = get(parts, ["total"]);

    const bed_number = parseNullableInt(source_bed);
    const locker_number = parseNullableInt(source_locker);
    const check_in_date = normalizeDate(source_check_in_date);
    const check_out_date = normalizeDate(source_check_out_date);
    const check_in_time = normalizeTime(source_check_in_time);
    const nights = parseNullableInt(source_nights);
    const bed_price = parseNullableNumber(source_bed_price);
    const locker_price = parseNullableNumber(source_locker_price);
    const locker_days = parseNullableInt(source_locker_days);
    const bed_amount_written = parseNullableNumber(source_bed_amount);
    const locker_amount_written = parseNullableNumber(source_locker_amount);
    const total_written = parseNullableNumber(source_total);

    const bed_amount_calculated = (nights ?? 0) * (bed_price ?? 0);
    const locker_amount_calculated = (locker_days ?? 0) * (locker_price ?? 0);
    const extra_services_total = 0;
    const total_calculated = bed_amount_calculated + locker_amount_calculated + extra_services_total;

    const bed_amount_difference = (bed_amount_written ?? 0) - bed_amount_calculated;
    const locker_amount_difference = (locker_amount_written ?? 0) - locker_amount_calculated;
    const total_difference = (total_written ?? 0) - total_calculated;

    const flags: AnomalyFlag[] = [];
    const unreadable_fields: string[] = [];
    if (!source_name) flags.push("MISSING_REQUIRED_FIELD");
    if (source_bed && bed_number === null) {
      flags.push("UNREADABLE_FIELD");
      unreadable_fields.push("N.Cama");
    }
    if (!source_bed) flags.push("MISSING_BED");
    if (source_check_in_date && !check_in_date) {
      flags.push("UNREADABLE_FIELD");
      unreadable_fields.push("Fecha Ingreso");
    }
    if (source_check_out_date && !check_out_date) {
      flags.push("UNREADABLE_FIELD");
      unreadable_fields.push("Fecha Salida");
    }
    if (check_in_date && check_out_date && check_out_date <= check_in_date) flags.push("INVALID_DATE_RANGE");
    if (source_total === null) flags.push("MISSING_TOTAL");
    if (bed_amount_written !== null && Math.abs(bed_amount_difference) > 0.009) flags.push("BED_AMOUNT_MISMATCH");
    if (locker_amount_written !== null && Math.abs(locker_amount_difference) > 0.009) flags.push("LOCKER_AMOUNT_MISMATCH");
    if (total_written !== null && Math.abs(total_difference) > 0.009) flags.push("TOTAL_MISMATCH");
    if (locker_number !== null && (locker_amount_written === null || locker_amount_written === 0)) {
      flags.push("LOCKER_NUMBER_WITHOUT_CHARGE");
    }
    if (locker_number === null && locker_amount_written !== null && locker_amount_written > 0) {
      flags.push("LOCKER_CHARGE_WITHOUT_LOCKER_NUMBER");
    }
    if ((nights ?? 0) >= 15) flags.push("LONG_STAY_REVIEW");

    if (flags.length > 0 && !flags.includes("NEEDS_MANUAL_REVIEW")) flags.push("NEEDS_MANUAL_REVIEW");

    return {
      source_day,
      source_name,
      source_client_no,
      source_sex,
      source_bed,
      source_locker,
      source_check_in_date,
      source_check_in_time,
      source_check_out_date,
      source_nights,
      source_bed_price,
      source_bed_amount,
      source_locker_price,
      source_locker_days,
      source_locker_amount,
      source_total,
      guest_name: source_name,
      guest_sex: normalizeSex(source_sex),
      bed_number,
      locker_number,
      check_in_date,
      check_in_time,
      check_out_date,
      nights,
      bed_price,
      locker_price,
      locker_days,
      bed_amount_written,
      locker_amount_written,
      total_written,
      bed_amount_calculated,
      locker_amount_calculated,
      extra_services_total,
      total_calculated,
      bed_amount_difference,
      locker_amount_difference,
      total_difference,
      needs_review: flags.length > 0,
      anomaly_flags: [...new Set(flags)],
      unreadable_fields: [...new Set(unreadable_fields)],
    };
  });
}
