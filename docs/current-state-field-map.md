# Mapeo operativo: captura actual -> sistema digital

## 1) Hoja de operación diaria

Campos capturados hoy:
- `fecha`
- `ingreso`
- `egreso`
- `h`
- `m`
- `encargado`
- `efectivo`
- `notas`

Mapeo propuesto:
- `fecha` -> `cash_movements.movement_date`
- `h` + `m` -> `cash_movements.recorded_at`
- `ingreso` -> `cash_movements.direction = income`
- `egreso` -> `cash_movements.direction = expense`
- `encargado` -> `cash_movements.responsible_profile_id` (FK a `profiles`)
- `efectivo` -> `cash_movements.amount` con `method = cash`
- `notas` -> `cash_movements.notes`

## 2) Tipos de salida de caja

Valores capturados hoy:
- `VENTA`
- `GASTO OPERATIVO`
- `GASTO ADMINISTRATIVO`
- `GASTO CUBRIR DIAS`
- `CONTADORA`

Mapeo propuesto:
- `VENTA` -> `cash_movements.category = sale`
- `GASTO OPERATIVO` -> `cash_movements.category = gasto_operativo`
- `GASTO ADMINISTRATIVO` -> `cash_movements.category = gasto_administrativo`
- `GASTO CUBRIR DIAS` -> `cash_movements.category = gasto_cubrir_dias`
- `CONTADORA` -> `cash_movements.category = contadora`

## 3) Formato manual por huésped

Campos capturados hoy:
- `nombre`
- `client_no_id`
- `sexo`
- `n. de cama`
- `n. de locker`
- `fecha de ingreso`
- `hora`
- `fecha de salida`
- `noches`
- `precio`
- `importe`
- `precio locker`
- `dias locker`
- `importe locker`
- `total`

Mapeo propuesto:
- `nombre` -> `guests.full_name`
- `client_no_id` -> `guests.client_external_id`
- `sexo` -> `guests.sex`
- `n. de cama` -> `reservation_guests.bed_id` (resuelto por `beds.bed_number`)
- `n. de locker` -> `reservation_guests.locker_number`
- `fecha de ingreso` + `hora` -> `reservations.check_in_at`
- `fecha de salida` -> `reservations.check_out_at`
- `noches` -> `reservations.nights`
- `precio` -> `reservation_guests.nightly_rate`
- `importe` -> `folios.total_amount` parcial por cama
- `precio locker` -> `reservation_guests.locker_price`
- `dias locker` -> `reservation_guests.locker_days`
- `importe locker` -> `reservation_guests.locker_amount`
- `total` -> `folios.total_amount`

## Reglas obligatorias MVP

- Una estancia solo se confirma con pago completo (`folios.balance_due = 0`).
- Datos mínimos de huésped: `full_name`, `phone`, `email`, `sex`.
- Debe existir trazabilidad de cobros y cortes en `audit_logs`.
