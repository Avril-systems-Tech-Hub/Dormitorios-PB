import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { createClient } from "@/lib/supabase/server";
import {
  addImportedRecordExtraServiceAction,
  commitImportedBatchAction,
  previewImportedRecordsAction,
  recalculateImportedRecordAction,
  updateImportedRecordAction,
} from "@/actions/operations";
import { parsePagination, getRange } from "@/lib/pagination";

export default async function ImportedRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const selectedBatchId = String(params.batch_id ?? "");
  const filterNeedsReview = String(params.needs_review ?? "");
  const filterBed = String(params.bed ?? "");
  const filterName = String(params.guest_name ?? "");
  const filterFlag = String(params.flag ?? "");
  const filterDate = String(params.date ?? "");

  const { page, pageSize } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  // Construir query principal con todos los filtros aplicados a nivel DB
  type ImportedRecord = {
    id: string;
    batch_id: string;
    guest_name: string | null;
    bed_number: number | null;
    check_in_date: string | null;
    nights: number | null;
    total_written: number | null;
    total_calculated: number | null;
    total_difference: number | null;
    needs_review: boolean;
  };

  const selectCols = filterFlag
    ? "id,batch_id,guest_name,bed_number,check_in_date,nights,total_written,total_calculated,total_difference,needs_review,imported_record_anomalies!inner(flag)"
    : "id,batch_id,guest_name,bed_number,check_in_date,nights,total_written,total_calculated,total_difference,needs_review";

  let query = supabase
    .from("imported_records")
    .select(selectCols, { count: "exact" });

  if (selectedBatchId) query = query.eq("batch_id", selectedBatchId);
  if (filterNeedsReview === "true") query = query.eq("needs_review", true);
  if (filterBed) query = query.eq("bed_number", Number(filterBed));
  if (filterName) query = query.ilike("guest_name", `%${filterName}%`);
  if (filterDate) query = query.eq("check_in_date", filterDate);
  if (filterFlag) query = query.eq("imported_record_anomalies.flag", filterFlag);

  const { data: baseRecords, count } = await query
    .order("check_in_date", { ascending: false })
    .range(from, to);
  const records = (baseRecords ?? []) as unknown as ImportedRecord[];
  const recordIds = records.map((r) => r.id);

  // Anomalías para la página actual (para mostrar los flags por registro)
  const { data: anomalies } = recordIds.length
    ? await supabase
        .from("imported_record_anomalies")
        .select("id, imported_record_id, flag")
        .in("imported_record_id", recordIds)
    : { data: [] as { id: string; imported_record_id: string; flag: string }[] };

  const byRecordFlags = new Map<string, string[]>();
  for (const row of anomalies ?? []) {
    const current = byRecordFlags.get(row.imported_record_id) ?? [];
    current.push(row.flag);
    byRecordFlags.set(row.imported_record_id, current);
  }

  // Resumen sobre la página actual
  const summary = records.reduce(
    (acc, row) => {
      acc.written += Number(row.total_written ?? 0);
      acc.calculated += Number(row.total_calculated ?? 0);
      acc.diff += Number(row.total_difference ?? 0);
      if (row.needs_review) acc.reviewCount += 1;
      return acc;
    },
    { written: 0, calculated: 0, diff: 0, reviewCount: 0 },
  );

  const { data: batches } = await supabase
    .from("import_batches")
    .select("id, source_name, status, preview_count, imported_count, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = records.map((record) => {
    const flags = byRecordFlags.get(record.id) ?? [];
    return [
      record.guest_name ?? "Sin nombre",
      record.bed_number ? `Cama ${record.bed_number}` : "-",
      record.check_in_date ?? "-",
      `${record.nights ?? 0}`,
      `$${Number(record.total_written ?? 0).toFixed(2)}`,
      `$${Number(record.total_calculated ?? 0).toFixed(2)}`,
      `$${Number(record.total_difference ?? 0).toFixed(2)}`,
      record.needs_review ? <Badge key={`${record.id}-review`} variant="warning">Revisar</Badge> : <Badge key={`${record.id}-ok`} variant="success">OK</Badge>,
      flags.length ? flags.join(", ") : "-",
      <div key={`${record.id}-actions`} className="flex flex-col gap-2">
        <form action={recalculateImportedRecordAction} className="flex gap-2">
          <input type="hidden" name="record_id" value={record.id} />
          <input type="hidden" name="return_to" value={`/dashboard/imported-records${selectedBatchId ? `?batch_id=${selectedBatchId}` : ""}`} />
          <Button type="submit" variant="outline" className="h-8 px-2 text-xs">Recalcular</Button>
        </form>
        <form action={updateImportedRecordAction} className="grid gap-1">
          <input type="hidden" name="record_id" value={record.id} />
          <input type="hidden" name="return_to" value={`/dashboard/imported-records${selectedBatchId ? `?batch_id=${selectedBatchId}` : ""}`} />
          <input name="guest_name" defaultValue={record.guest_name ?? ""} placeholder="Nombre" className="h-8 rounded border border-border-soft px-2 text-xs" />
          <div className="grid grid-cols-2 gap-1">
            <input name="bed_number" defaultValue={record.bed_number ?? ""} placeholder="Cama" className="h-8 rounded border border-border-soft px-2 text-xs" />
            <input name="nights" defaultValue={record.nights ?? ""} placeholder="Noches" className="h-8 rounded border border-border-soft px-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <input name="bed_price" placeholder="Precio H" className="h-8 rounded border border-border-soft px-2 text-xs" />
            <input name="total_written" defaultValue={record.total_written ?? ""} placeholder="Total escrito" className="h-8 rounded border border-border-soft px-2 text-xs" />
          </div>
          <Button type="submit" variant="outline" className="h-8 px-2 text-xs">Guardar</Button>
        </form>
        <form action={addImportedRecordExtraServiceAction} className="grid gap-1">
          <input type="hidden" name="imported_record_id" value={record.id} />
          <input type="hidden" name="return_to" value={`/dashboard/imported-records${selectedBatchId ? `?batch_id=${selectedBatchId}` : ""}`} />
          <div className="grid grid-cols-2 gap-1">
            <input name="service_name" placeholder="Servicio" className="h-8 rounded border border-border-soft px-2 text-xs" />
            <input name="amount" type="number" step="0.01" placeholder="Monto" className="h-8 rounded border border-border-soft px-2 text-xs" />
          </div>
          <Button type="submit" variant="outline" className="h-8 px-2 text-xs">+ Extra</Button>
        </form>
      </div>,
    ];
  });

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Imported Records / Archive</h2>
        <p className="mt-1 text-sm text-text-muted">
          Captura histórica de papel con diferencia entre montos escritos y calculados, más banderas de anomalía.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold text-text-main">1) Previsualizar TSV</h3>
          <form action={previewImportedRecordsAction} className="mt-3 space-y-2">
            <input name="source_name" placeholder="Nombre del lote (ej. Abril semana 1)" className="h-10 w-full rounded border border-border-soft px-3 text-sm" />
            <textarea name="raw_tsv" placeholder="Pega aquí el TSV con encabezados Dia, Nombre, No, Sexo..." className="min-h-40 w-full rounded border border-border-soft px-3 py-2 text-sm" />
            <input type="hidden" name="return_to" value="/dashboard/imported-records" />
            <Button type="submit">Crear previsualización</Button>
          </form>
        </Card>
        <Card>
          <h3 className="text-base font-semibold text-text-main">2) Confirmar lote</h3>
          <form action={commitImportedBatchAction} className="mt-3 space-y-2">
            <select name="batch_id" defaultValue={selectedBatchId || ""} className="h-10 w-full rounded border border-border-soft px-3 text-sm">
              <option value="">Selecciona lote previsualizado</option>
              {(batches ?? []).map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.source_name ?? "Sin nombre"} | {batch.status} | prev {batch.preview_count} | imp {batch.imported_count}
                </option>
              ))}
            </select>
            <input type="hidden" name="return_to" value="/dashboard/imported-records" />
            <Button type="submit" variant="outline">Marcar como importado</Button>
          </form>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card><p className="text-xs text-text-muted">Ingresos escritos (página)</p><p className="text-lg font-semibold">${summary.written.toFixed(2)}</p></Card>
        <Card><p className="text-xs text-text-muted">Ingresos calculados (página)</p><p className="text-lg font-semibold">${summary.calculated.toFixed(2)}</p></Card>
        <Card><p className="text-xs text-text-muted">Diferencia (página)</p><p className="text-lg font-semibold">${summary.diff.toFixed(2)}</p></Card>
        <Card><p className="text-xs text-text-muted">Bed income</p><p className="text-lg font-semibold">Incluido</p></Card>
        <Card><p className="text-xs text-text-muted">Locker income</p><p className="text-lg font-semibold">Incluido</p></Card>
        <Card><p className="text-xs text-text-muted">Needs review (página)</p><p className="text-lg font-semibold">{summary.reviewCount}</p></Card>
      </div>

      <Card>
        <h3 className="text-base font-semibold text-text-main">Filtros</h3>
        <form method="get" className="mt-3 grid gap-2 md:grid-cols-6">
          <select name="batch_id" defaultValue={selectedBatchId} className="h-10 rounded border border-border-soft px-2 text-sm">
            <option value="">Todos los lotes</option>
            {(batches ?? []).map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.source_name ?? "Sin nombre"}</option>
            ))}
          </select>
          <input name="date" type="date" defaultValue={filterDate} className="h-10 rounded border border-border-soft px-2 text-sm" />
          <select name="needs_review" defaultValue={filterNeedsReview} className="h-10 rounded border border-border-soft px-2 text-sm">
            <option value="">Todos</option>
            <option value="true">Solo needs_review</option>
          </select>
          <input name="flag" placeholder="Flag (ej. TOTAL_MISMATCH)" defaultValue={filterFlag} className="h-10 rounded border border-border-soft px-2 text-sm" />
          <input name="bed" placeholder="Cama" defaultValue={filterBed} className="h-10 rounded border border-border-soft px-2 text-sm" />
          <input name="guest_name" placeholder="Huésped" defaultValue={filterName} className="h-10 rounded border border-border-soft px-2 text-sm" />
          <Button type="submit" className="md:col-span-6">Aplicar filtros</Button>
        </form>
      </Card>

      <ResponsiveTable
        headers={["Huésped", "Cama", "Ingreso", "Noches", "Escrito", "Calculado", "Diferencia", "Estado", "Flags", "Editar"]}
        rows={rows}
        serverPagination={{
          page,
          pageSize,
          totalCount: count ?? 0,
        }}
      />
    </div>
  );
}
