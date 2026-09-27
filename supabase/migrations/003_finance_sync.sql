-- =============================================================================
-- 003_finance_sync.sql
-- Dependientes + beneficiary para sync de finanzas (prod-like)
-- Run in Supabase SQL Editor after 001 + 002
-- =============================================================================

create table if not exists public.dependents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  notes text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dependents_household_idx
  on public.dependents (household_id);

alter table public.expense_templates
  add column if not exists beneficiary_id uuid
    references public.dependents (id) on delete set null;

alter table public.expenses
  add column if not exists beneficiary_id uuid
    references public.dependents (id) on delete set null;

alter table public.dependents enable row level security;

drop policy if exists dependents_select on public.dependents;
create policy dependents_select on public.dependents for select
  using (public.is_household_member(household_id));

drop policy if exists dependents_write on public.dependents;
create policy dependents_write on public.dependents for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

grant select, insert, update, delete on public.dependents to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_updated_at' and tgrelid = 'public.dependents'::regclass
  ) then
    create trigger set_updated_at
      before update on public.dependents
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- Realtime (para que Liz y Yamil vean cambios al instante)
do $$
begin
  begin
    alter publication supabase_realtime add table public.debts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.expenses;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.incomes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.savings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.expense_templates;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.income_templates;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.dependents;
  exception when duplicate_object then null;
  end;
end;
$$;
