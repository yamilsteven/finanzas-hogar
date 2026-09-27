-- =============================================================================
-- 004_fix_pgcrypto.sql
-- Habilita pgcrypto (gen_random_bytes / gen_random_uuid) y corrige slug de hogares
-- Run in Supabase SQL Editor
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Asegura que search_path de funciones definer encuentre gen_random_*
-- Reemplaza gen_random_bytes por gen_random_uuid (más portable en Supabase)

create or replace function public.create_household_as_admin(
  p_name text,
  p_owner_email text,
  p_owner_display_name text,
  p_owner_member_key text default 'a'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
  v_profile_id uuid;
  v_token text;
  v_slug text;
begin
  if v_uid is null or not public.is_platform_admin() then
    raise exception 'Solo platform admin puede crear hogares';
  end if;

  if trim(p_name) = '' then
    raise exception 'El nombre del hogar es obligatorio';
  end if;

  if trim(p_owner_email) = '' then
    raise exception 'El email del owner es obligatorio';
  end if;

  if trim(p_owner_display_name) = '' then
    raise exception 'El nombre visible del owner es obligatorio';
  end if;

  if trim(p_owner_member_key) = '' then
    raise exception 'member_key es obligatorio';
  end if;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := null;
  else
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.households (name, slug, status, created_by)
  values (trim(p_name), v_slug, 'active', v_uid)
  returning id into v_household_id;

  select id
    into v_profile_id
  from public.profiles
  where lower(email) = lower(trim(p_owner_email))
  limit 1;

  if v_profile_id is not null then
    insert into public.household_members (
      household_id, user_id, role, member_key, display_name, status
    )
    values (
      v_household_id,
      v_profile_id,
      'owner',
      trim(p_owner_member_key),
      trim(p_owner_display_name),
      'active'
    );

    update public.profiles
      set active_household_id = coalesce(active_household_id, v_household_id),
          updated_at = now()
      where id = v_profile_id;

    return jsonb_build_object(
      'ok', true,
      'household_id', v_household_id,
      'mode', 'member_linked',
      'owner_user_id', v_profile_id,
      'invite_token', null
    );
  end if;

  insert into public.invitations (
    household_id,
    email,
    role,
    member_key,
    display_name,
    invited_by,
    status,
    token
  )
  values (
    v_household_id,
    lower(trim(p_owner_email)),
    'owner',
    trim(p_owner_member_key),
    trim(p_owner_display_name),
    v_uid,
    'pending',
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  )
  returning token into v_token;

  return jsonb_build_object(
    'ok', true,
    'household_id', v_household_id,
    'mode', 'invite_pending',
    'owner_user_id', null,
    'invite_token', v_token
  );
end;
$$;

create or replace function public.create_invitation(
  p_household_id uuid,
  p_email text,
  p_display_name text,
  p_member_key text,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_role text := coalesce(nullif(trim(p_role), ''), 'member');
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not (
    public.is_platform_admin()
    or public.can_write_household(p_household_id)
  ) then
    raise exception 'Sin permiso para invitar a este hogar';
  end if;

  if v_role not in ('owner', 'member', 'viewer') then
    raise exception 'Rol inválido';
  end if;

  if trim(p_email) = '' or trim(p_display_name) = '' or trim(p_member_key) = '' then
    raise exception 'email, display_name y member_key son obligatorios';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.invitations (
    household_id,
    email,
    role,
    member_key,
    display_name,
    invited_by,
    status,
    token
  )
  values (
    p_household_id,
    lower(trim(p_email)),
    v_role,
    trim(p_member_key),
    trim(p_display_name),
    v_uid,
    'pending',
    v_token
  );

  return jsonb_build_object(
    'ok', true,
    'invite_token', v_token
  );
end;
$$;

-- Default de token en invitations sin gen_random_bytes
alter table public.invitations
  alter column token set default replace(
    gen_random_uuid()::text || gen_random_uuid()::text,
    '-',
    ''
  );

grant execute on function public.create_household_as_admin(text, text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, text, text, text) to authenticated;
