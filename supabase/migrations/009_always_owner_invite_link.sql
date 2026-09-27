-- =============================================================================
-- 009_always_owner_invite_link.sql
-- Al crear hogar siempre genera invite_token (aunque el owner ya tenga cuenta)
-- =============================================================================

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
  v_mode text := 'invite_pending';
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
    v_slug := v_slug || '-' || substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 6);
  end if;

  insert into public.households (name, slug, status, created_by)
  values (trim(p_name), v_slug, 'active', v_uid)
  returning id into v_household_id;

  select id
    into v_profile_id
  from public.profiles
  where lower(email) = lower(trim(p_owner_email))
  limit 1;

  -- Si ya tiene cuenta, vincular como owner activo
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
    )
    on conflict (household_id, user_id) do update
      set role = excluded.role,
          member_key = excluded.member_key,
          display_name = excluded.display_name,
          status = 'active',
          updated_at = now();

    update public.profiles
      set active_household_id = v_household_id,
          updated_at = now()
      where id = v_profile_id;

    v_mode := 'member_linked';
  end if;

  -- Siempre generar link de invite para que el admin lo envíe (WhatsApp, etc.)
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

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
    v_token
  );

  return jsonb_build_object(
    'ok', true,
    'household_id', v_household_id,
    'mode', v_mode,
    'owner_user_id', v_profile_id,
    'invite_token', v_token
  );
end;
$$;

grant execute on function public.create_household_as_admin(text, text, text, text) to authenticated;
