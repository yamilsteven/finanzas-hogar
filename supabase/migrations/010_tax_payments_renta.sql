-- Impuestos anuales y declaración de renta (listado informativo)

create table if not exists public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  paid_date date not null,
  tax_year int not null,
  amount numeric(18, 2),
  currency text check (currency is null or currency in ('COP', 'USD')),
  owner_scope text not null,
  notes text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tax_payments_household_idx
  on public.tax_payments (household_id);

alter table public.tax_payments enable row level security;

drop policy if exists tax_payments_select on public.tax_payments;
create policy tax_payments_select on public.tax_payments for select
  using (public.is_household_member(household_id));

drop policy if exists tax_payments_write on public.tax_payments;
create policy tax_payments_write on public.tax_payments for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

grant select, insert, update, delete on public.tax_payments to authenticated;

create table if not exists public.renta_declarations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  tax_year int not null,
  declared boolean not null default false,
  declared_date date,
  owner_scope text not null,
  notes text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists renta_declarations_household_idx
  on public.renta_declarations (household_id);

alter table public.renta_declarations enable row level security;

drop policy if exists renta_declarations_select on public.renta_declarations;
create policy renta_declarations_select on public.renta_declarations for select
  using (public.is_household_member(household_id));

drop policy if exists renta_declarations_write on public.renta_declarations;
create policy renta_declarations_write on public.renta_declarations for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

grant select, insert, update, delete on public.renta_declarations to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.tax_payments;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.renta_declarations;
  exception
    when duplicate_object then null;
  end;
end $$;
