-- =============================================================================
-- 002_admin_invites.sql
-- RPCs for platform admin household creation + invite acceptance (soft launch)
-- Run in Supabase SQL Editor after 001_init.sql
-- =============================================================================

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación';
  end if;

  select lower(coalesce(u.email, p.email, ''))
    into v_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_uid;

  if v_email is null or v_email = '' then
    raise exception 'No se pudo resolver el email de la sesión';
  end if;

  select *
    into v_inv
  from public.invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'Invitación no encontrada';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'Esta invitación ya no está pendiente (%)', v_inv.status;
  end if;

  if v_inv.expires_at < now() then
    update public.invitations
      set status = 'expired', updated_at = now()
      where id = v_inv.id;
    raise exception 'La invitación expiró';
  end if;

  if lower(v_inv.email) <> v_email then
    raise exception 'Esta invitación es para %, no para tu cuenta', v_inv.email;
  end if;

  insert into public.household_members (
    household_id, user_id, role, member_key, display_name, status
  )
  values (
    v_inv.household_id,
    v_uid,
    v_inv.role,
    v_inv.member_key,
    v_inv.display_name,
    'active'
  )
  on conflict (household_id, user_id) do update
    set role = excluded.role,
        member_key = excluded.member_key,
        display_name = excluded.display_name,
        status = 'active',
        updated_at = now()
  returning id into v_member_id;

  update public.invitations
    set status = 'accepted',
        accepted_at = now(),
        updated_at = now()
    where id = v_inv.id;

  update public.profiles
    set active_household_id = v_inv.household_id,
        updated_at = now()
    where id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'household_id', v_inv.household_id,
    'member_id', v_member_id
  );
end;
$$;

create or replace function public.create_household_as_admin(
  p_name text,
  p_owner_email text,
  p_owner_display_name text,
  p_owner_member_key text default 'a'
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
    v_slug := v_slug || '-' || substr(encode(gen_random_bytes(3), 'hex'), 1, 6);
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
    status
  )
  values (
    v_household_id,
    lower(trim(p_owner_email)),
    'owner',
    trim(p_owner_member_key),
    trim(p_owner_display_name),
    v_uid,
    'pending'
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
set search_path = public
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

  insert into public.invitations (
    household_id,
    email,
    role,
    member_key,
    display_name,
    invited_by,
    status
  )
  values (
    p_household_id,
    lower(trim(p_email)),
    v_role,
    trim(p_member_key),
    trim(p_display_name),
    v_uid,
    'pending'
  )
  returning token into v_token;

  return jsonb_build_object(
    'ok', true,
    'invite_token', v_token
  );
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.create_household_as_admin(text, text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, text, text, text) to authenticated;

create or replace function public.peek_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select * into v_inv
  from public.invitations
  where token = p_token;

  if not found then
    raise exception 'Invitación no encontrada';
  end if;

  select h.name into v_name
  from public.households h
  where h.id = v_inv.household_id;

  return jsonb_build_object(
    'id', v_inv.id,
    'household_id', v_inv.household_id,
    'household_name', v_name,
    'email', v_inv.email,
    'role', v_inv.role,
    'member_key', v_inv.member_key,
    'display_name', v_inv.display_name,
    'status', v_inv.status,
    'expires_at', v_inv.expires_at,
    'token', v_inv.token
  );
end;
$$;

grant execute on function public.peek_invitation(text) to authenticated;
