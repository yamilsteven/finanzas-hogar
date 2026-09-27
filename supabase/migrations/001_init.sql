-- =============================================================================
-- Finanzas Hogar — schema inicial (soft launch) v2
-- Orden corregido: tablas primero, luego funciones que las referencian.
-- Pegar en: SQL Editor → New query → Run
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tablas (antes que las funciones RLS)
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_color text default '#0F766E',
  primary_currency text not null default 'COP'
    check (primary_currency in ('COP', 'USD')),
  active_household_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'member', 'viewer')),
  member_key text not null,
  display_name text not null,
  status text not null default 'active'
    check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id),
  unique (household_id, member_key)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_active_household_fk'
  ) then
    alter table public.profiles
      add constraint profiles_active_household_fk
      foreign key (active_household_id)
      references public.households (id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null,
  role text not null default 'member'
    check (role in ('owner', 'member', 'viewer')),
  member_key text not null,
  display_name text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users (id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations (lower(email));
create index if not exists invitations_token_idx on public.invitations (token);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  entity text not null default '',
  type text not null
    check (type in ('Tarjeta', 'Libre inversion', 'Hipoteca', 'Vehiculo', 'Otro')),
  balance numeric(18, 2) not null default 0,
  currency text not null check (currency in ('COP', 'USD')),
  annual_rate numeric(10, 4) not null default 0,
  rate_type text not null check (rate_type in ('EA', 'MV')),
  min_payment numeric(18, 2) not null default 0,
  min_payment_mode text not null default 'fixed'
    check (min_payment_mode in ('fixed', 'variable')),
  due_date date,
  owner_scope text not null,
  term_months int,
  notes text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  description text not null,
  category text not null,
  amount numeric(18, 2) not null default 0,
  currency text not null check (currency in ('COP', 'USD')),
  paid_by_member text not null,
  owner_scope text not null,
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  utility_service text check (utility_service in ('agua', 'gas', 'energia')),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source text not null,
  owner_scope text not null,
  currency text not null check (currency in ('COP', 'USD')),
  amount numeric(18, 2) not null default 0,
  type text not null check (type in ('Fijo', 'Variable')),
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  description text not null,
  category text not null,
  amount numeric(18, 2) not null default 0,
  currency text not null check (currency in ('COP', 'USD')),
  paid_by_member text not null,
  owner_scope text not null,
  date date not null,
  status text not null default 'Pendiente'
    check (status in ('Pendiente', 'Pagado')),
  recurring boolean not null default false,
  template_id uuid references public.expense_templates (id) on delete set null,
  period_key text,
  debt_id uuid references public.debts (id) on delete set null,
  utility_service text check (utility_service in ('agua', 'gas', 'energia')),
  consumption numeric(12, 3),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source text not null,
  owner_scope text not null,
  currency text not null check (currency in ('COP', 'USD')),
  amount numeric(18, 2) not null default 0,
  type text not null check (type in ('Fijo', 'Variable')),
  date date not null,
  notes text,
  template_id uuid references public.income_templates (id) on delete set null,
  period_key text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  current_value numeric(18, 2) not null default 0,
  target_value numeric(18, 2) not null default 0,
  monthly_contribution numeric(18, 2) not null default 0,
  currency text not null check (currency in ('COP', 'USD')),
  owner_scope text not null,
  notes text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_household_idx on public.debts (household_id);
create index if not exists expenses_household_period_idx on public.expenses (household_id, period_key);
create index if not exists incomes_household_period_idx on public.incomes (household_id, period_key);
create index if not exists savings_household_idx on public.savings (household_id);
create index if not exists expense_templates_household_idx on public.expense_templates (household_id);
create index if not exists income_templates_household_idx on public.income_templates (household_id);
create index if not exists household_members_user_idx on public.household_members (user_id);

-- -----------------------------------------------------------------------------
-- Funciones RLS (después de las tablas)
-- -----------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = p_household_id
        and hm.user_id = auth.uid()
        and hm.status = 'active'
    );
$$;

create or replace function public.can_write_household(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = p_household_id
        and hm.user_id = auth.uid()
        and hm.status = 'active'
        and hm.role in ('owner', 'member')
    );
$$;

-- -----------------------------------------------------------------------------
-- Trigger perfil al registrarse
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'households', 'household_members', 'invitations',
    'debts', 'expenses', 'incomes', 'savings',
    'expense_templates', 'income_templates'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at
       before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS + policies (idempotente: drop + create)
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.invitations enable row level security;
alter table public.debts enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;
alter table public.savings enable row level security;
alter table public.expense_templates enable row level security;
alter table public.income_templates enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'households', 'household_members', 'platform_admins',
        'invitations', 'debts', 'expenses', 'incomes', 'savings',
        'expense_templates', 'income_templates'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

create policy profiles_select_own
  on public.profiles for select
  using (id = auth.uid() or public.is_platform_admin());

create policy profiles_update_own
  on public.profiles for update
  using (id = auth.uid() or public.is_platform_admin());

create policy households_select_member
  on public.households for select
  using (public.is_household_member(id));

create policy households_insert_admin
  on public.households for insert
  with check (public.is_platform_admin() or auth.uid() is not null);

create policy households_update_admin_or_owner
  on public.households for update
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.household_members hm
      where hm.household_id = id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
        and hm.status = 'active'
    )
  );

create policy members_select
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy members_write
  on public.household_members for all
  using (public.can_write_household(household_id) or public.is_platform_admin())
  with check (public.can_write_household(household_id) or public.is_platform_admin());

create policy platform_admins_select
  on public.platform_admins for select
  using (user_id = auth.uid() or public.is_platform_admin());

create policy invitations_select
  on public.invitations for select
  using (
    public.is_household_member(household_id)
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy invitations_write
  on public.invitations for all
  using (public.can_write_household(household_id) or public.is_platform_admin())
  with check (public.can_write_household(household_id) or public.is_platform_admin());

create policy debts_select on public.debts for select
  using (public.is_household_member(household_id));
create policy debts_write on public.debts for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

create policy expenses_select on public.expenses for select
  using (public.is_household_member(household_id));
create policy expenses_write on public.expenses for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

create policy incomes_select on public.incomes for select
  using (public.is_household_member(household_id));
create policy incomes_write on public.incomes for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

create policy savings_select on public.savings for select
  using (public.is_household_member(household_id));
create policy savings_write on public.savings for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

create policy expense_templates_select on public.expense_templates for select
  using (public.is_household_member(household_id));
create policy expense_templates_write on public.expense_templates for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

create policy income_templates_select on public.income_templates for select
  using (public.is_household_member(household_id));
create policy income_templates_write on public.income_templates for all
  using (public.can_write_household(household_id))
  with check (public.can_write_household(household_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select on public.platform_admins to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;

grant select, insert, update, delete on public.debts to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.incomes to authenticated;
grant select, insert, update, delete on public.savings to authenticated;
grant select, insert, update, delete on public.expense_templates to authenticated;
grant select, insert, update, delete on public.income_templates to authenticated;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_write_household(uuid) to authenticated;
