-- Deudas: pago automático + tracking de interés / auto-pago
-- Seguros / SOAT

alter table public.debts
  add column if not exists auto_pay boolean not null default false;

alter table public.debts
  add column if not exists auto_pay_paid_by text;

alter table public.debts
  add column if not exists last_interest_period text;

alter table public.debts
  add column if not exists last_auto_pay_period text;

create table if not exists public.insurances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  provider text not null default '',
  type text not null
    check (type in ('SOAT', 'Vehiculo', 'Hogar', 'Vida', 'Salud', 'Otro')),
  premium numeric(18, 2) not null default 0,
  currency text not null check (currency in ('COP', 'USD')),
  start_date date,
  end_date date,
  renews_every_months int,
  owner_scope text not null,
  policy_number text,
  notes text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurances_household_idx
  on public.insurances (household_id);

alter table public.insurances enable row level security;

drop policy if exists insurances_select on public.insurances;
create policy insurances_select on public.insurances for select
  using (public.is_household_member(household_id));

drop policy if exists insurances_write on public.insurances;
create policy insurances_write on public.insurances for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

grant select, insert, update, delete on public.insurances to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.insurances;
  exception
    when duplicate_object then null;
  end;
end $$;
