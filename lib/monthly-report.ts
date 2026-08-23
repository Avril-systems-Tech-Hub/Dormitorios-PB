import type { SupabaseClient } from "@supabase/supabase-js";
import { getFinanceDayOptions, getMexicoCityMonthBoundsFromKey } from "@/lib/dates";
import { getExpenseConceptLabel } from "@/lib/expense-concepts";
import { VISITOR_CONCEPT_LABELS, type VisitorConcept } from "@/lib/visitor-sales";

export type MonthlyReportPaymentDetail = {
  id: string;
  folioCode: string;
  guestNames: string[];
  amount: number;
  method: string;
};

export type MonthlyReportExpenseDetail = {
  id: string;
  concept: string;
  amount: number;
  method: string;
  notes: string | null;
};

export type MonthlyReportDay = {
  date: string;
  income: number;
  expenses: number;
  net: number;
  male: number;
  female: number;
  other: number;
  occupied: number;
  payments: MonthlyReportPaymentDetail[];
  expenseDetails: MonthlyReportExpenseDetail[];
};

export type MonthlyReport = {
  monthKey: string;
  start: string;
  end: string;
  days: MonthlyReportDay[];
  totals: {
    income: number;
    expenses: number;
    net: number;
    occupiedBedNights: number;
    averageOccupancy: number;
    peakOccupancy: number;
  };
  incomeByMethod: Record<string, number>;
  expensesByConcept: Record<string, number>;
};

type PaymentRow = {
  id: string;
  amount: number | string;
  method: string;
  effective_date: string;
  folios?: {
    folio_code?: string;
    reservations?: {
      reservation_guests?: {
        guests?: { full_name?: string } | { full_name?: string }[] | null;
      }[] | null;
    } | {
      reservation_guests?: {
        guests?: { full_name?: string } | { full_name?: string }[] | null;
      }[] | null;
    }[] | null;
  } | {
    folio_code?: string;
    reservations?: {
      reservation_guests?: {
        guests?: { full_name?: string } | { full_name?: string }[] | null;
      }[] | null;
    } | {
      reservation_guests?: {
        guests?: { full_name?: string } | { full_name?: string }[] | null;
      }[] | null;
    }[] | null;
  }[] | null;
};

type ExpenseRow = {
  id: string;
  movement_date: string;
  amount: number | string;
  method: string;
  expense_concept: string | null;
  concept_detail: string | null;
  category: string;
  notes: string | null;
};

type ReservationRow = {
  check_in_date: string;
  check_out_date: string;
  reservation_guests?: {
    bed_id?: string | null;
    guests?:
      | { full_name?: string; sex?: string }
      | { full_name?: string; sex?: string }[]
      | null;
  }[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function addToRecord(record: Record<string, number>, key: string, amount: number) {
  record[key] = roundMoney((record[key] ?? 0) + amount);
}

function paymentGuestNames(payment: PaymentRow) {
  const folio = unwrap(payment.folios);
  const reservations = folio?.reservations
    ? Array.isArray(folio.reservations)
      ? folio.reservations
      : [folio.reservations]
    : [];
  const names = new Set<string>();

  for (const reservation of reservations) {
    for (const assignment of reservation.reservation_guests ?? []) {
      const name = unwrap(assignment.guests)?.full_name?.trim();
      if (name) names.add(name);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

function expenseConcept(row: ExpenseRow) {
  if (row.expense_concept === "extras" && row.concept_detail?.trim()) {
    return `Extras: ${row.concept_detail.trim()}`;
  }
  if (row.expense_concept) return getExpenseConceptLabel(row.expense_concept);
  return row.category || "Otro";
}

export async function getMonthlyReport(
  supabase: SupabaseClient,
  monthKey: string,
): Promise<MonthlyReport> {
  const { start, end } = getMexicoCityMonthBoundsFromKey(monthKey);
  const dateValues = getFinanceDayOptions(monthKey)
    .map((option) => option.value)
    .reverse();

  const [
    { data: paymentData, error: paymentError },
    { data: expenseData, error: expenseError },
    {
      data: reservationData,
      error: reservationError,
    },
    { data: showerSales },
    { data: lockerSales },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `id,amount,method,effective_date,
        folios(
          folio_code,
          reservations(
            reservation_guests(guests(full_name))
          )
        )`,
      )
      .gte("effective_date", start)
      .lte("effective_date", end),
    supabase
      .from("cash_movements")
      .select(
        "id,movement_date,amount,method,expense_concept,concept_detail,category,notes",
      )
      .eq("direction", "expense")
      .gte("movement_date", start)
      .lte("movement_date", end),
    supabase
      .from("reservations")
      .select(
        `check_in_date,check_out_date,
        reservation_guests(
          bed_id,
          guests(full_name,sex)
        )`,
      )
      .neq("status", "cancelled")
      .lte("check_in_date", end)
      .gt("check_out_date", start),
    supabase
      .from("visitor_shower_sales")
      .select("id, visitor_name, resource_number, amount, method, sold_date")
      .gte("sold_date", start)
      .lte("sold_date", end),
    supabase
      .from("visitor_locker_sales")
      .select("id, visitor_name, resource_number, amount, method, sold_date")
      .gte("sold_date", start)
      .lte("sold_date", end),
  ]);

  if (paymentError) throw new Error(`No se pudieron consultar los ingresos: ${paymentError.message}`);
  if (expenseError) throw new Error(`No se pudieron consultar los egresos: ${expenseError.message}`);
  if (reservationError) {
    throw new Error(`No se pudo consultar la ocupación: ${reservationError.message}`);
  }

  const days = new Map<string, MonthlyReportDay>(
    dateValues.map((date) => [
      date,
      {
        date,
        income: 0,
        expenses: 0,
        net: 0,
        male: 0,
        female: 0,
        other: 0,
        occupied: 0,
        payments: [],
        expenseDetails: [],
      },
    ]),
  );
  const incomeByMethod: Record<string, number> = {};
  const expensesByConcept: Record<string, number> = {};

  for (const payment of (paymentData ?? []) as PaymentRow[]) {
    const day = days.get(payment.effective_date);
    if (!day) continue;
    const amount = Number(payment.amount);
    const folio = unwrap(payment.folios);

    day.income = roundMoney(day.income + amount);
    day.payments.push({
      id: payment.id,
      folioCode: folio?.folio_code ?? "Sin folio",
      guestNames: paymentGuestNames(payment),
      amount,
      method: payment.method,
    });
    addToRecord(incomeByMethod, payment.method, amount);
  }

  type VisitorIncomeRow = {
    id: string;
    visitor_name?: string | null;
    resource_number?: string | null;
    amount: number | string;
    method: string;
    sold_date: string;
  };

  function addVisitorIncome(rows: VisitorIncomeRow[] | null, concept: VisitorConcept) {
    for (const sale of rows ?? []) {
      const day = days.get(sale.sold_date);
      if (!day) continue;
      const amount = Number(sale.amount);
      const label = VISITOR_CONCEPT_LABELS[concept];
      const number = sale.resource_number ? ` ${sale.resource_number}` : "";
      day.income = roundMoney(day.income + amount);
      day.payments.push({
        id: sale.id,
        folioCode: `Invitado · ${label}${number}`,
        guestNames: [sale.visitor_name?.trim() || "Invitado"],
        amount,
        method: sale.method,
      });
      addToRecord(incomeByMethod, sale.method, amount);
    }
  }

  addVisitorIncome((showerSales ?? []) as VisitorIncomeRow[], "shower");
  addVisitorIncome((lockerSales ?? []) as VisitorIncomeRow[], "locker");

  for (const expense of (expenseData ?? []) as ExpenseRow[]) {
    const day = days.get(expense.movement_date);
    if (!day) continue;
    const amount = Number(expense.amount);
    const concept = expenseConcept(expense);

    day.expenses = roundMoney(day.expenses + amount);
    day.expenseDetails.push({
      id: expense.id,
      concept,
      amount,
      method: expense.method,
      notes: expense.notes,
    });
    addToRecord(expensesByConcept, concept, amount);
  }

  for (const reservation of (reservationData ?? []) as ReservationRow[]) {
    for (const date of dateValues) {
      if (date < reservation.check_in_date || date >= reservation.check_out_date) continue;
      const day = days.get(date);
      if (!day) continue;

      for (const assignment of reservation.reservation_guests ?? []) {
        const guest = unwrap(assignment.guests);
        day.occupied += 1;
        if (guest?.sex === "m") day.male += 1;
        else if (guest?.sex === "f") day.female += 1;
        else day.other += 1;
      }
    }
  }

  const dayRows = [...days.values()].map((day) => ({
    ...day,
    net: roundMoney(day.income - day.expenses),
    payments: day.payments.sort((a, b) => b.amount - a.amount),
    expenseDetails: day.expenseDetails.sort((a, b) => b.amount - a.amount),
  }));
  const income = roundMoney(dayRows.reduce((sum, day) => sum + day.income, 0));
  const expenses = roundMoney(dayRows.reduce((sum, day) => sum + day.expenses, 0));
  const occupiedBedNights = dayRows.reduce((sum, day) => sum + day.occupied, 0);
  const peakOccupancy = Math.max(0, ...dayRows.map((day) => day.occupied));

  return {
    monthKey,
    start,
    end,
    days: dayRows,
    totals: {
      income,
      expenses,
      net: roundMoney(income - expenses),
      occupiedBedNights,
      averageOccupancy: dayRows.length
        ? Number((occupiedBedNights / dayRows.length).toFixed(1))
        : 0,
      peakOccupancy,
    },
    incomeByMethod,
    expensesByConcept,
  };
}
