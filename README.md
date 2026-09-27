# Finanzas Hogar

App web responsive de gestión financiera del hogar (1 o más personas). Multimoneda COP/USD. Soft launch con Supabase Auth + Postgres.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + Shadcn UI + Lucide
- Zustand (sesión + datos; migración a Supabase en curso)
- Supabase (auth, multi-tenancy por hogares, RLS)
- Recharts

## Arranque

```bash
cd finanzas-hogar
cp env.example .env.local   # URL base + anon key (sin /rest/v1/)
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) → login.

## Hogares

- Un **hogar** puede tener 1 persona (amigo/a que vive solo) o varias.
- Los datos se aíslan por `household_id` (RLS).
- La UI de “vista por miembro” y cierre Shared solo aparece con 2+ miembros.

## Ownership

Cada registro tiene `owner`: nombre del miembro o `Shared`.

## Variables

Ver `env.example`. Nunca uses la `service_role` en el frontend.
