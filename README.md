# Dormitorios Plaza Basílica - ETAPA 1

Webapp operativa (mobile-first) para reservas, huéspedes, folios y caja.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth + Postgres + RLS)
- Deploy listo para Vercel

## Correr local
1. Instala dependencias:
   - `npm install`
2. Configura variables:
   - copia `.env.example` a `.env.local`
   - agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Ejecuta:
   - `npm run dev`
4. Abre `http://localhost:3000`

## Bootstrap de primer acceso (login inmediato)
Si aún no tienes usuarios en Supabase Auth, puedes crearlos en un solo comando:

1. En `.env.local` agrega:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BOOTSTRAP_ADMIN_PASSWORD`
   - `BOOTSTRAP_RECEPTION_PASSWORD`
2. Ejecuta:
   - `npm run bootstrap:staff`
3. Inicia sesión en `/login` con:
   - `admin@dormitorios.local` + contraseña admin
   - `recepcion@dormitorios.local` + contraseña recepción

Notas:
- El script crea (o reutiliza) usuarios en `auth.users`.
- También crea/actualiza `public.profiles` con roles `admin` y `reception`.

## Base de datos
- Migración principal: `supabase/migrations/20260420_init_stage1.sql`
- Seed demo: `supabase/seed/seed_stage1.sql`
- Guía rápida: `docs/stage1.md`
