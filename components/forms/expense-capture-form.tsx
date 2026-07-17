"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  EXPENSE_CONCEPTS,
  EXPENSE_CONCEPT_LABELS,
  getExpenseConceptLabel,
} from "@/lib/expense-concepts";
import {
  retryExpenseReceiptAction,
  type CreateExpenseResult,
} from "@/actions/operations";
import {
  deleteExpenseReceiptDraft,
  loadExpenseReceiptDraft,
  pruneExpenseReceiptDrafts,
  saveExpenseReceiptDraft,
} from "@/lib/expense-draft-storage";
import {
  EXPENSE_RECEIPT_ACCEPT,
  MAX_EXPENSE_RECEIPT_BYTES,
  resolveExpenseReceiptMime,
  withResolvedReceiptFile,
} from "@/lib/expense-receipt";
import type { ExpenseConcept } from "@/types/domain";

type ExpenseCaptureFormProps = {
  action: (formData: FormData) => Promise<CreateExpenseResult>;
  returnTo?: string;
  onClose?: () => void;
};

type ExpenseDraft = {
  amount: string;
  concept: ExpenseConcept | "";
  conceptDetail: string;
  method: string;
  notes: string;
  submissionId: string;
  pendingMovementId?: string;
};

function getFormError(amount: string, concept: ExpenseConcept | "", conceptDetail: string) {
  const numericAmount = Number(amount);
  if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return "Captura un monto mayor a cero.";
  }
  if (!concept) return "Selecciona un concepto de gasto.";
  if (concept === "extras" && conceptDetail.trim().length < 3) {
    return "Para extras, describe el gasto (mínimo 3 caracteres).";
  }
  return "";
}

export function ExpenseCaptureForm({
  action,
  returnTo = "/dashboard",
  onClose,
}: ExpenseCaptureFormProps) {
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState<ExpenseConcept | "">("");
  const [conceptDetail, setConceptDetail] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileError, setReceiptFileError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [result, setResult] = useState<CreateExpenseResult | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [pendingMovementId, setPendingMovementId] = useState("");
  const [draftStorageWarning, setDraftStorageWarning] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const draftKey = `expense-capture-draft:v1:${returnTo}`;
  const receiptPreviewUrl = useMemo(
    () => (receiptFile ? URL.createObjectURL(receiptFile) : ""),
    [receiptFile],
  );

  const error = useMemo(() => {
    if (receiptFileError) return receiptFileError;
    if (!submitAttempted) return "";
    return getFormError(amount, concept, conceptDetail);
  }, [amount, concept, conceptDetail, receiptFileError, submitAttempted]);

  useEffect(() => {
    const restoreDraft = window.setTimeout(() => {
      void pruneExpenseReceiptDrafts().catch(() => {});
      try {
        const stored = window.localStorage.getItem(draftKey);
        if (stored) {
          const draft = JSON.parse(stored) as Partial<ExpenseDraft>;
          const restoredSubmissionId = draft.submissionId ?? crypto.randomUUID();
          setAmount(draft.amount ?? "");
          setConcept(
            draft.concept && EXPENSE_CONCEPTS.includes(draft.concept) ? draft.concept : "",
          );
          setConceptDetail(draft.conceptDetail ?? "");
          setMethod(["cash", "transfer", "card"].includes(draft.method ?? "") ? draft.method! : "cash");
          setNotes(draft.notes ?? "");
          setSubmissionId(restoredSubmissionId);
          setPendingMovementId(draft.pendingMovementId ?? "");
          if (draft.pendingMovementId) {
            setResult({
              status: "partial",
              message: "El egreso ya está guardado; falta adjuntar su evidencia.",
              movementId: draft.pendingMovementId,
              evidence: "failed",
            });
          }
          void loadExpenseReceiptDraft(restoredSubmissionId)
            .then((file) => {
              if (file) setReceiptFile(withResolvedReceiptFile(file));
            })
            .catch(() => {
              setDraftStorageWarning("No se pudo restaurar la fotografía guardada en este dispositivo.");
            });
        } else {
          setSubmissionId(crypto.randomUUID());
        }
      } catch {
        setSubmissionId(crypto.randomUUID());
      }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(restoreDraft);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || !submissionId || result?.status === "success") {
      return;
    }
    const draft: ExpenseDraft = {
      amount,
      concept,
      conceptDetail,
      method,
      notes,
      submissionId,
      pendingMovementId: pendingMovementId || undefined,
    };
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [amount, concept, conceptDetail, draftKey, draftReady, method, notes, pendingMovementId, result?.status, submissionId]);

  useEffect(() => {
    if (!receiptPreviewUrl) return;
    return () => URL.revokeObjectURL(receiptPreviewUrl);
  }, [receiptPreviewUrl]);

  function getCurrentFormError() {
    return receiptFileError || getFormError(amount, concept, conceptDetail);
  }

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > MAX_EXPENSE_RECEIPT_BYTES) {
      setReceiptFile(null);
      setReceiptFileError("La imagen es muy pesada (máx. 9 MB). Elige otra.");
      event.target.value = "";
      return;
    }
    if (!resolveExpenseReceiptMime(file.type, file.name)) {
      setReceiptFile(null);
      setReceiptFileError("Usa una imagen JPG, PNG, WebP, HEIC o HEIF.");
      event.target.value = "";
      return;
    }
    const normalized = withResolvedReceiptFile(file);
    setReceiptFile(normalized);
    setReceiptFileError("");
    setDraftStorageWarning("");
    void saveExpenseReceiptDraft(submissionId, normalized).catch(() => {
      setDraftStorageWarning(
        "La foto está lista para enviar, pero el navegador no permitió conservarla tras una recarga.",
      );
    });
  }

  function clearReceipt() {
    const currentSubmissionId = submissionId;
    setReceiptFile(null);
    setReceiptFileError("");
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    void deleteExpenseReceiptDraft(currentSubmissionId).catch(() => {});
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setSubmitAttempted(true);
    if (getCurrentFormError()) return;

    const formData = new FormData(event.currentTarget);
    if (receiptFile) {
      formData.set("receipt_image", withResolvedReceiptFile(receiptFile));
    }
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const nextResult = await action(formData);
        setResult(nextResult);
        setPendingMovementId(nextResult.status === "partial" ? nextResult.movementId ?? "" : "");
        if (nextResult.status === "success") {
          window.localStorage.removeItem(draftKey);
          await deleteExpenseReceiptDraft(submissionId).catch(() => {});
        }
      } catch {
        setResult({ status: "error", message: "No se pudo completar el envío. Intenta nuevamente." });
      } finally {
        submittingRef.current = false;
      }
    });
  }

  function retryEvidence() {
    const movementId = pendingMovementId || result?.movementId;
    if (!movementId || !receiptFile || submittingRef.current) return;
    const formData = new FormData();
    formData.set("movement_id", movementId);
    formData.set("receipt_image", withResolvedReceiptFile(receiptFile));
    submittingRef.current = true;
    startTransition(async () => {
      try {
        const nextResult = await retryExpenseReceiptAction(formData);
        setResult(nextResult);
        if (nextResult.status === "success") {
          setPendingMovementId("");
          window.localStorage.removeItem(draftKey);
          await deleteExpenseReceiptDraft(submissionId).catch(() => {});
        }
      } catch {
        setResult((current) =>
          current
            ? { ...current, status: "partial", message: "El reintento falló. El gasto sigue guardado." }
            : current,
        );
      } finally {
        submittingRef.current = false;
      }
    });
  }

  function startNew() {
    const previousSubmissionId = submissionId;
    setAmount("");
    setConcept("");
    setConceptDetail("");
    setMethod("cash");
    setNotes("");
    clearReceipt();
    setSubmitAttempted(false);
    setResult(null);
    setPendingMovementId("");
    setSubmissionId(crypto.randomUUID());
    window.localStorage.removeItem(draftKey);
    void deleteExpenseReceiptDraft(previousSubmissionId).catch(() => {});
  }

  if (result && result.status !== "error") {
    const evidenceLabel =
      result.evidence === "saved"
        ? "Guardada"
        : result.evidence === "failed"
          ? "No guardada"
          : "No adjuntada";
    return (
      <div className="space-y-4 rounded-xl border border-border-soft bg-white p-4" role="status">
        <div>
          <h3 className="text-base font-semibold text-text-main">
            {result.status === "partial" ? "Gasto guardado; evidencia pendiente" : "Gasto guardado"}
          </h3>
          <p className={`mt-1 text-sm ${result.status === "partial" ? "text-amber-700" : "text-green-700"}`}>
            {result.message}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-surface-soft p-3 text-sm">
          <div>
            <dt className="text-text-muted">Monto</dt>
            <dd className="font-semibold text-text-main">${Number(result.amount ?? amount).toFixed(2)} MXN</dd>
          </div>
          <div>
            <dt className="text-text-muted">Concepto</dt>
            <dd className="font-semibold text-text-main">{getExpenseConceptLabel(result.expenseConcept ?? concept)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-text-muted">Evidencia</dt>
            <dd className="font-semibold text-text-main">{evidenceLabel}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {result.status === "partial" && receiptFile ? (
            <Button type="button" disabled={isPending} onClick={retryEvidence}>
              {isPending ? "Reintentando…" : "Reintentar evidencia"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={isPending} onClick={startNew}>
            Registrar otro
          </Button>
          {onClose ? (
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              Cerrar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="expense_submission_id" value={submissionId} />
      {concept ? <input type="hidden" name="expense_concept" value={concept} /> : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-main">Concepto (un gasto por registro)</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
            onChange={(e) => setConceptDetail(e.target.value)}
            className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
            placeholder="Ej. compra de focos"
            required
          />
        </label>
      ) : (
        <input type="hidden" name="concept_detail" value="" />
      )}

      <AmountMethodFields
        amount={amount}
        method={method}
        onAmountChange={setAmount}
        onMethodChange={setMethod}
      />

      <label className="flex flex-col gap-1 text-sm text-text-muted">
        Notas adicionales (opcional)
        <input
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
          placeholder="Detalle extra si hace falta"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-main">Evidencia (opcional)</legend>
        <input
          ref={cameraInputRef}
          type="file"
          accept={EXPENSE_RECEIPT_ACCEPT}
          capture="environment"
          onChange={handleReceiptChange}
          className="sr-only"
          tabIndex={-1}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={EXPENSE_RECEIPT_ACCEPT}
          onChange={handleReceiptChange}
          className="sr-only"
          tabIndex={-1}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => cameraInputRef.current?.click()}>
            Tomar foto
          </Button>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Elegir archivo
          </Button>
        </div>
        {receiptFile ? (
          <div className="flex items-center gap-3 rounded-lg border border-border-soft p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptPreviewUrl}
              alt="Vista previa de evidencia"
              className="h-14 w-14 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-main">{receiptFile.name}</p>
              <p className="text-xs text-text-muted">Seleccionada, pero aún falta presionar Guardar gasto.</p>
            </div>
            <Button type="button" variant="ghost" onClick={clearReceipt}>
              Quitar
            </Button>
          </div>
        ) : (
          <p className="text-xs text-text-muted">JPG, PNG, WebP, HEIC o HEIF. Máximo 9 MB.</p>
        )}
        {draftStorageWarning ? (
          <p className="text-xs text-amber-700">{draftStorageWarning}</p>
        ) : null}
      </fieldset>

      <Button
        type="submit"
        disabled={isPending || !draftReady || !concept || !!receiptFileError || (!!error && submitAttempted)}
      >
        {isPending ? "Guardando…" : "Guardar gasto"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {result?.status === "error" ? <p className="text-sm text-red-600">{result.message}</p> : null}
    </form>
  );
}

function AmountMethodFields({
  amount,
  method,
  onAmountChange,
  onMethodChange,
}: {
  amount: string;
  method: string;
  onAmountChange: (value: string) => void;
  onMethodChange: (value: string) => void;
}) {
  return (
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
          onChange={(e) => onAmountChange(e.target.value)}
          className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
          placeholder="0.00"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-muted">
        Método de pago
        <select
          name="method"
          value={method}
          onChange={(event) => onMethodChange(event.target.value)}
          className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
        >
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
          <option value="card">Tarjeta</option>
        </select>
      </label>
    </div>
  );
}
