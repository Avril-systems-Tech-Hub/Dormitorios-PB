# ETAPA 1 - Base Operativa

## Arquitectura
- `app/`: rutas App Router, login y dashboard modular.
- `components/`: UI reutilizable (botón, input, badge, card, tabla responsive, modal, estados, toaster).
- `actions/`: server actions (`loginAction`).
- `lib/`: utilidades, navegación, auth guards, clientes Supabase.
- `types/`: tipos de dominio para roles, pagos y camas.
- `supabase/migrations`: esquema SQL + RLS.
- `supabase/seed`: datos demo para operación inicial.

## Supabase
1. Crear proyecto Supabase.
2. Correr `supabase/migrations/20260420_init_stage1.sql`.
3. Crear dos usuarios Auth:
   - `admin@dormitorios.local`
   - `recepcion@dormitorios.local`
4. Correr `supabase/seed/seed_stage1.sql`.

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar valores.
