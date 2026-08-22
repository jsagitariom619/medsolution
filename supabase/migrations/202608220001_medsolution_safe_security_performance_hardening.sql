-- MedSolution — endurecimiento seguro sin alterar la autenticación local actual.
-- Aplicado al proyecto Registro clinico el 2026-08-22.

begin;

create index if not exists atenciones_historia_clinica_id_idx
  on public.atenciones (historia_clinica_id);
create index if not exists historias_clinicas_actualizado_por_idx
  on public.historias_clinicas (actualizado_por);
create index if not exists historias_clinicas_creado_por_idx
  on public.historias_clinicas (creado_por);

drop policy if exists "Permitir leer servicios" on public.servicios;
drop policy if exists "Permitir insertar servicios" on public.servicios;
drop policy if exists "Permitir actualizar servicios" on public.servicios;
drop policy if exists "Permitir eliminar servicios" on public.servicios;

revoke execute on function public.crear_usuario_auth() from public, anon, authenticated;
revoke execute on function public.rol_actual() from public, anon;
grant execute on function public.rol_actual() to authenticated;

drop policy if exists medsolution_usuarios_select on public.usuarios;
create policy medsolution_usuarios_select
  on public.usuarios
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.rol_actual()) = 'Administrador'::public.rol_aplicacion
  );

commit;
