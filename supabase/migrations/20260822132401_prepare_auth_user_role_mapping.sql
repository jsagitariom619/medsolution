-- Mantiene el esquema remoto reproducible con el estado ya aplicado en producción.
-- La migración a Supabase Auth permanece pausada; esta función no se usa mientras no existan usuarios Auth.

create or replace function public.crear_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  requested_role text;
  safe_role public.rol_aplicacion;
begin
  requested_role := coalesce(
    nullif(trim(new.raw_app_meta_data->>'rol'), ''),
    nullif(trim(new.raw_user_meta_data->>'rol'), ''),
    'Auxiliar'
  );

  safe_role := case requested_role
    when 'Administrador' then 'Administrador'::public.rol_aplicacion
    when 'Médico' then 'Médico'::public.rol_aplicacion
    when 'Auxiliar' then 'Auxiliar'::public.rol_aplicacion
    else 'Auxiliar'::public.rol_aplicacion
  end;

  insert into public.usuarios (id, email, nombre_completo, rol, activo)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nombre_completo'), ''),
      nullif(trim(new.raw_app_meta_data->>'nombre_completo'), ''),
      split_part(coalesce(new.email, 'Usuario'), '@', 1)
    ),
    safe_role,
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        nombre_completo = excluded.nombre_completo,
        rol = excluded.rol,
        activo = true,
        actualizado_en = now();

  return new;
end
$function$;

revoke execute on function public.crear_usuario_auth() from public, anon, authenticated;
