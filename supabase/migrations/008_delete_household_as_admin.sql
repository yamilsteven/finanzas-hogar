-- =============================================================================
-- 008_delete_household_as_admin.sql
-- Platform admin puede borrar un hogar completo (cascade finanzas + miembros)
-- =============================================================================

create or replace function public.delete_household_as_admin(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null or not public.is_platform_admin() then
    raise exception 'Solo platform admin puede borrar hogares';
  end if;

  if p_household_id is null then
    raise exception 'household_id es obligatorio';
  end if;

  select name into v_name
  from public.households
  where id = p_household_id;

  if v_name is null then
    raise exception 'Hogar no encontrado';
  end if;

  -- Quitar hogar activo de perfiles que lo tengan seleccionado
  update public.profiles
    set active_household_id = null,
        updated_at = now()
  where active_household_id = p_household_id;

  -- Cascade borra members, invitations, debts, expenses, etc.
  delete from public.households
  where id = p_household_id;

  return jsonb_build_object(
    'ok', true,
    'household_id', p_household_id,
    'name', v_name
  );
end;
$$;

grant execute on function public.delete_household_as_admin(uuid) to authenticated;
