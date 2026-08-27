"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import {
  getExpenseHistoryAction,
  updateExpenseResultAction,
  type ExpenseHistoryEntry,
} from "@/actions/operations";
import { Button } from "@/components/ui/button";
import {
  EXPENSE_CONCEPTS,
  EXPENSE_CONCEPT_LABELS,
  getExpenseConceptLabel,
} from "@/lib/expense-concepts";
import { formatMexicoCityDateTime } from "@/lib/dates";
import type { ExpenseConcept } from "@/types/domain";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

export type EditableShiftExpense = {
  id: string;
  expenseConcept: ExpenseConcept | string | null;
  conceptDetail: string | null;
  amount: number;
  method: string;
  notes: string | null;
  canEdit: boolean;
};

type ShiftExpenseRowActionsProps = {
  expense: EditableShiftExpense;
};

export function ShiftExpenseRowActions({ expense }: ShiftExpenseRowActionsProps) {
  const [mode, setMode] = useState<"idle" | "edit" | "history">("idle");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {expense.canEdit ? (
          <Button type="button" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setMode("edit")}>
            Editar
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => setMode("history")}>
          Historial
        </Button>
      </div>
      {mode === "edit" ? (
        <ExpenseEditModal expense={expense} onClose={() => setMode("idle")} />
      ) : null}
      {mode === "history" ? (
        <ExpenseHistoryModal
          movementId={expense.id}
          title={getExpenseConceptLabel(expense.expenseConcept)}
          onClose={() => setMode("idle")}
        />
      ) : null}
    </>
  );
}

export type ExpenseEditSavedValues = {
  amount: number;
  expenseConcept: ExpenseConcept;
  conceptDetail: string | null;
  method: string;
  notes: string | null;
};

export function ExpenseEditModal({
  expense,
  onClose,
  onSaved,
}: {
  expense: EditableShiftExpense;
  onClose: () => void;
  onSaved?: (values: ExpenseEditSavedValues) => void;
}) {
  const initialConcept = (EXPENSE_CONCEPTS as readonly string[]).includes(
    String(expense.expenseConcept ?? ""),
  )
    ? (expense.expenseConcept as ExpenseConcept)
    : ("" as ExpenseConcept | "");
  const [concept, setConcept] = useState<ExpenseConcept | "">(initialConcept);
  const [conceptDetail, setConceptDetail] = useState(expense.conceptDetail ?? "");
  const [amount, setAmount] = useState(String(expense.amount));
  const [method, setMethod] = useState(expense.method || "cash");
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const validationError = useMemo(() => {
    const numericAmount = Number(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return "Captura un monto mayor a cero.";
    }
    if (!concept) return "Selecciona un concepto de gasto.";
    if (concept === "extras" && conceptDetail.trim().length < 3) {
      return "Para extras, describe el gasto (mínimo 3 caracteres).";
    }
    return "";
  }, [amount, concept, conceptDetail]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateExpenseResultAction(formData);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      if (concept) {
        onSaved?.({
          amount: Number(amount),
          expenseConcept: concept,
          conceptDetail: concept === "extras" ? conceptDetail.trim() : null,
          method,
          notes: notes.trim() || null,
        });
      }
      window.setTimeout(() => onClose(), 700);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-soft bg-white p-4 shadow-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-edit-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="expense-edit-title" className="text-lg font-semibold text-text-main">
              Editar egreso
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Los cambios quedan registrados en el historial del turno.
            </p>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <input type="hidden" name="movement_id" value={expense.id} />
          {concept ? <input type="hidden" name="expense_concept" value={concept} /> : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text-main">Concepto</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPENSE_CONCEPTS.map((value) => {
                const active = concept === value;
                return (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors ${
                      active
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                        : "border-border-soft text-text-main hover:bg-surface-soft"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={active}
                      onChange={() => setConcept(value)}
                      aria-label={EXPENSE_CONCEPT_LABELS[value]}
                    />
                    {EXPENSE_CONCEPT_LABELS[value]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {concept === "extras" ? (
            <label className="flex flex-col gap-1 text-sm text-text-muted">
              Descripción del extra
              <input
                name="concept_detail"
                value={conceptDetail}
                onChange={(event) => setConceptDetail(event.target.value)}
                className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
                required
              />
            </label>
          ) : (
            <input type="hidden" name="concept_detail" value="" />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-text-muted">
              Monto (MXN)
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-text-muted">
              Método
              <select
                name="method"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-text-muted">
            Notas
            <input
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending || !!validationError}>
              {isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              Cancelar
            </Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
        </form>
      </div>
    </div>
  );
}

function ExpenseHistoryModal({
  movementId,
  title,
  onClose,
}: {
  movementId: string;
  title: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<ExpenseHistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getExpenseHistoryAction(movementId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.status === "error") {
        setError(result.message ?? "No se pudo cargar el historial.");
        return;
      }
      setEntries(result.entries ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [movementId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-soft bg-white p-4 shadow-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-history-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="expense-history-title" className="text-lg font-semibold text-text-main">
              Historial del egreso
            </h2>
            <p className="mt-1 text-sm text-text-muted">{title}</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? <p className="text-sm text-text-muted">Cargando historial…</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && entries.length === 0 ? (
            <p className="text-sm text-text-muted">Aún no hay eventos registrados para este egreso.</p>
          ) : null}
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border-soft bg-surface-soft/50 p-3">
              <p className="text-sm font-medium text-text-main">{entry.summary}</p>
              <p className="mt-1 text-xs text-text-muted">
                {formatMexicoCityDateTime(entry.createdAt)}
                {entry.actorName ? ` · ${entry.actorName}` : ""}
              </p>
              {entry.action === "expense_updated" && entry.before && entry.after ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-muted">
                  <div>
                    <dt className="font-medium text-text-main">Antes</dt>
                    <dd>
                      {getExpenseConceptLabel(String(entry.before.expense_concept ?? ""))} · $
                      {Number(entry.before.amount ?? 0).toFixed(2)} ·{" "}
                      {METHOD_LABELS[String(entry.before.method ?? "")] ?? String(entry.before.method ?? "")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-text-main">Después</dt>
                    <dd>
                      {getExpenseConceptLabel(String(entry.after.expense_concept ?? ""))} · $
                      {Number(entry.after.amount ?? 0).toFixed(2)} ·{" "}
                      {METHOD_LABELS[String(entry.after.method ?? "")] ?? String(entry.after.method ?? "")}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
