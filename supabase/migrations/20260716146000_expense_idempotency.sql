-- Idempotencia del alta de egresos, separada del ledger de pagos.
-- IF NOT EXISTS permite aplicarla donde la columna ya fue creada manualmente.

alter table public.cash_movements
  add column if not exists idempotency_payload_hash text;

comment on column public.cash_movements.idempotency_payload_hash is
  'SHA-256 del payload completo para rechazar reintentos UUID con datos distintos.';
