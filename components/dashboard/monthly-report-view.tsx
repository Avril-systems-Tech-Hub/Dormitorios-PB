import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { formatMexicoCityDayLabel, formatMexicoCityMonthLabel } from "@/lib/dates";
import type {
  MonthlyReport,
  MonthlyReportDay,
} from "@/lib/monthly-report";
import { cn } from "@/lib/utils";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function money(value: number) {
  return currency.format(value);
}

function DayDetail({ day }: { day: MonthlyReportDay }) {
  return (
    <details className="min-w-[15rem] rounded-lg border border-border-soft bg-surface-soft/40 p-2">
      <summary className="cursor-pointer text-xs font-medium text-brand-primary">
        Ver detalle ({day.payments.length} cobros, {day.expenseDetails.length} egresos)
      </summary>
      <div className="mt-3 grid gap-3 text-xs lg:grid-cols-2">
        <div>
          <p className="font-semibold text-text-main">Cobros</p>
          {day.payments.length ? (
            <ul className="mt-1 space-y-2">
              {day.payments.map((payment) => (
                <li key={payment.id} className="rounded-md bg-white p-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-text-main">{payment.folioCode}</span>
                    <span className="font-semibold text-success">{money(payment.amount)}</span>
                  </div>
                  <p className="text-text-muted">
                    {METHOD_LABELS[payment.method] ?? payment.method}
                    {payment.guestNames.length
                      ? ` · ${payment.guestNames.join(", ")}`
                      : " · Sin huésped asociado"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-text-muted">Sin cobros.</p>
          )}
        </div>
        <div>
          <p className="font-semibold text-text-main">Egresos</p>
          {day.expenseDetails.length ? (
            <ul className="mt-1 space-y-2">
              {day.expenseDetails.map((expense) => (
                <li key={expense.id} className="rounded-md bg-white p-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-text-main">{expense.concept}</span>
                    <span className="font-semibold text-danger">{money(expense.amount)}</span>
                  </div>
                  <p className="text-text-muted">
                    {METHOD_LABELS[expense.method] ?? expense.method}
                    {expense.notes ? ` · ${expense.notes}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-text-muted">Sin egresos.</p>
          )}
        </div>
      </div>
    </details>
  );
}

function Breakdown({
  title,
  values,
  tone,
}: {
  title: string;
  values: Record<string, number>;
  tone: "income" | "expense";
}) {
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <h3 className="text-base font-semibold text-text-main">{title}</h3>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-border-soft">
          {rows.map(([label, value]) => (
            <li key={label} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-text-muted">
                {tone === "income" ? METHOD_LABELS[label] ?? label : label}
              </span>
              <span className={tone === "income" ? "font-semibold text-success" : "font-semibold text-danger"}>
                {money(value)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-text-muted">Sin movimientos.</p>
      )}
    </Card>
  );
}

export function MonthlyReportView({
  report,
  monthOptions,
}: {
  report: MonthlyReport;
  monthOptions: { value: string; label: string }[];
}) {
  const monthLabel = formatMexicoCityMonthLabel(`${report.monthKey}-01`);
  const dailyRows = report.days.map((day) => [
    <span key={`${day.date}-date`} className="capitalize">
      {formatMexicoCityDayLabel(day.date)}
    </span>,
    money(day.income),
    money(day.expenses),
    <span
      key={`${day.date}-net`}
      className={cn("font-semibold", day.net >= 0 ? "text-success" : "text-danger")}
    >
      {money(day.net)}
    </span>,
    day.male,
    day.female,
    day.other,
    <span key={`${day.date}-occupancy`} className="font-semibold text-text-main">
      {day.occupied}
    </span>,
    <DayDetail key={`${day.date}-detail`} day={day} />,
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold capitalize text-text-main">
                Reporte de {monthLabel}
              </h2>
              <Badge variant="success">Mes cerrado</Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Flujo contable y ocupación diaria derivados de los registros operativos.
            </p>
          </div>
          <FinanceMonthSelect
            value={report.monthKey}
            options={monthOptions}
            monthParam="month"
            ariaLabel="Mes del reporte"
            className="w-full rounded-md border border-border-soft bg-white px-3 py-2 text-sm capitalize text-text-main sm:max-w-[14rem]"
          />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="bg-success/5">
          <p className="text-xs text-text-muted">Ingresos</p>
          <p className="mt-1 text-xl font-semibold text-success">{money(report.totals.income)}</p>
        </Card>
        <Card className="bg-danger/5">
          <p className="text-xs text-text-muted">Egresos</p>
          <p className="mt-1 text-xl font-semibold text-danger">{money(report.totals.expenses)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Balance</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold",
              report.totals.net >= 0 ? "text-success" : "text-danger",
            )}
          >
            {money(report.totals.net)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Ocupación promedio</p>
          <p className="mt-1 text-xl font-semibold text-text-main">
            {report.totals.averageOccupancy}
          </p>
          <p className="text-xs text-text-muted">plazas por noche</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Pico de ocupación</p>
          <p className="mt-1 text-xl font-semibold text-text-main">
            {report.totals.peakOccupancy}
          </p>
          <p className="text-xs text-text-muted">
            {report.totals.occupiedBedNights} plazas-noche en el mes
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="text-base font-semibold text-text-main">Detalle diario</h3>
        <p className="mt-0.5 text-sm text-text-muted">
          `Neto` corresponde a ingresos menos egresos; no representa únicamente efectivo.
        </p>
        <div className="mt-3">
          <ResponsiveTable
            headers={[
              "Fecha",
              "Ingresos",
              "Egresos",
              "Neto",
              "H",
              "M",
              "Otro",
              "Ocupación",
              "Detalle",
            ]}
            rows={dailyRows}
            dense
            filterMode="global"
            mobileColumnIndices={[0, 1, 2, 3, 7, 8]}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Ingresos por método" values={report.incomeByMethod} tone="income" />
        <Breakdown title="Egresos por concepto" values={report.expensesByConcept} tone="expense" />
      </div>
    </div>
  );
}
