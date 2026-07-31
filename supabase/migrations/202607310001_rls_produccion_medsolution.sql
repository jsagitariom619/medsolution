-- MedSolution - Políticas RLS consolidadas
-- Modelo actual:
--   * Los tres perfiles de la aplicación se autentican localmente.
--   * El cliente de Supabase opera con la Publishable Key (rol anon).
--   * Supabase Auth no participa en el inicio de sesión.
--
-- Consecuencia:
--   Las tablas operativas requieren permisos para anon. Los permisos por rol
--   (Administrador, Doctor y Auxiliar) continúan aplicándose en la interfaz.
--   La tabla usuarios queda reservada para sesiones authenticated de Supabase
--   y no se expone al rol anon.

begin;

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'usuarios',
    'personal_consultorio',
    'servicios',
    'pacientes',
    'historias_clinicas',
    'atenciones'
  ]
  loop
    if to_regclass(format('public.%I', tabla)) is null then
      raise exception 'No existe la tabla requerida public.%', tabla;
    end if;
  end loop;
end
$$;

alter table public.usuarios enable row level security;
alter table public.personal_consultorio enable row level security;
alter table public.servicios enable row level security;
alter table public.pacientes enable row level security;
alter table public.historias_clinicas enable row level security;
alter table public.atenciones enable row level security;

grant usage on schema public to anon, authenticated;

revoke all on table public.usuarios from anon;
grant select, insert, update, delete on table public.usuarios to authenticated;

grant select, insert, update, delete
  on table public.personal_consultorio,
               public.servicios,
               public.pacientes,
               public.historias_clinicas,
               public.atenciones
  to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function public.obtener_o_crear_historia(bigint) to anon, authenticated;

-- Retira únicamente las políticas anteriores conocidas que quedan sustituidas
-- por este conjunto consolidado. No modifica otras políticas personalizadas.
drop policy if exists "usuarios lectura propia o admin" on public.usuarios;
drop policy if exists "usuarios administra admin" on public.usuarios;
drop policy if exists "servicios lectura autenticada" on public.servicios;
drop policy if exists "servicios administra admin" on public.servicios;
drop policy if exists "personal lectura autenticada" on public.personal_consultorio;
drop policy if exists "personal administra admin" on public.personal_consultorio;
drop policy if exists "pacientes lectura personal" on public.pacientes;
drop policy if exists "pacientes alta personal" on public.pacientes;
drop policy if exists "pacientes edicion clinica" on public.pacientes;
drop policy if exists "pacientes elimina admin" on public.pacientes;
drop policy if exists "historias lectura clinica" on public.historias_clinicas;
drop policy if exists "historias alta clinica" on public.historias_clinicas;
drop policy if exists "historias edicion clinica" on public.historias_clinicas;
drop policy if exists "atenciones lectura por rol" on public.atenciones;
drop policy if exists "atenciones alta personal" on public.atenciones;
drop policy if exists "atenciones edicion por rol" on public.atenciones;
drop policy if exists "atenciones elimina admin" on public.atenciones;

-- Permite ejecutar el archivo más de una vez sin crear duplicados.
drop policy if exists medsolution_usuarios_select on public.usuarios;
drop policy if exists medsolution_usuarios_insert on public.usuarios;
drop policy if exists medsolution_usuarios_update on public.usuarios;
drop policy if exists medsolution_usuarios_delete on public.usuarios;

drop policy if exists medsolution_personal_select on public.personal_consultorio;
drop policy if exists medsolution_personal_insert on public.personal_consultorio;
drop policy if exists medsolution_personal_update on public.personal_consultorio;
drop policy if exists medsolution_personal_delete on public.personal_consultorio;

drop policy if exists medsolution_servicios_select on public.servicios;
drop policy if exists medsolution_servicios_insert on public.servicios;
drop policy if exists medsolution_servicios_update on public.servicios;
drop policy if exists medsolution_servicios_delete on public.servicios;

drop policy if exists medsolution_pacientes_select on public.pacientes;
drop policy if exists medsolution_pacientes_insert on public.pacientes;
drop policy if exists medsolution_pacientes_update on public.pacientes;
drop policy if exists medsolution_pacientes_delete on public.pacientes;

drop policy if exists medsolution_historias_select on public.historias_clinicas;
drop policy if exists medsolution_historias_insert on public.historias_clinicas;
drop policy if exists medsolution_historias_update on public.historias_clinicas;
drop policy if exists medsolution_historias_delete on public.historias_clinicas;

drop policy if exists medsolution_atenciones_select on public.atenciones;
drop policy if exists medsolution_atenciones_insert on public.atenciones;
drop policy if exists medsolution_atenciones_update on public.atenciones;
drop policy if exists medsolution_atenciones_delete on public.atenciones;

-- usuarios: no es consumida por el login local. Se conserva protegida para una
-- eventual sesión authenticated y limitada al propietario o Administrador.
create policy medsolution_usuarios_select
on public.usuarios
for select
to authenticated
using (
  id = auth.uid()
  or public.rol_actual() = 'Administrador'
);

create policy medsolution_usuarios_insert
on public.usuarios
for insert
to authenticated
with check (public.rol_actual() = 'Administrador');

create policy medsolution_usuarios_update
on public.usuarios
for update
to authenticated
using (public.rol_actual() = 'Administrador')
with check (public.rol_actual() = 'Administrador');

create policy medsolution_usuarios_delete
on public.usuarios
for delete
to authenticated
using (public.rol_actual() = 'Administrador');

-- personal_consultorio
create policy medsolution_personal_select
on public.personal_consultorio
for select
to anon, authenticated
using (true);

create policy medsolution_personal_insert
on public.personal_consultorio
for insert
to anon, authenticated
with check (true);

create policy medsolution_personal_update
on public.personal_consultorio
for update
to anon, authenticated
using (true)
with check (true);

create policy medsolution_personal_delete
on public.personal_consultorio
for delete
to anon, authenticated
using (true);

-- servicios
create policy medsolution_servicios_select
on public.servicios
for select
to anon, authenticated
using (true);

create policy medsolution_servicios_insert
on public.servicios
for insert
to anon, authenticated
with check (true);

create policy medsolution_servicios_update
on public.servicios
for update
to anon, authenticated
using (true)
with check (true);

create policy medsolution_servicios_delete
on public.servicios
for delete
to anon, authenticated
using (true);

-- pacientes
create policy medsolution_pacientes_select
on public.pacientes
for select
to anon, authenticated
using (true);

create policy medsolution_pacientes_insert
on public.pacientes
for insert
to anon, authenticated
with check (true);

create policy medsolution_pacientes_update
on public.pacientes
for update
to anon, authenticated
using (true)
with check (true);

create policy medsolution_pacientes_delete
on public.pacientes
for delete
to anon, authenticated
using (true);

-- historias_clinicas
create policy medsolution_historias_select
on public.historias_clinicas
for select
to anon, authenticated
using (true);

create policy medsolution_historias_insert
on public.historias_clinicas
for insert
to anon, authenticated
with check (true);

create policy medsolution_historias_update
on public.historias_clinicas
for update
to anon, authenticated
using (true)
with check (true);

create policy medsolution_historias_delete
on public.historias_clinicas
for delete
to anon, authenticated
using (true);

-- atenciones
create policy medsolution_atenciones_select
on public.atenciones
for select
to anon, authenticated
using (true);

create policy medsolution_atenciones_insert
on public.atenciones
for insert
to anon, authenticated
with check (true);

create policy medsolution_atenciones_update
on public.atenciones
for update
to anon, authenticated
using (true)
with check (true);

create policy medsolution_atenciones_delete
on public.atenciones
for delete
to anon, authenticated
using (true);

commit;

-- Verificación: cada tabla debe mostrar rls_habilitado = true y cuatro
-- políticas medsolution_* (SELECT, INSERT, UPDATE y DELETE).
select
  c.relname as tabla,
  c.relrowsecurity as rls_habilitado,
  count(p.policyname) filter (
    where p.policyname like 'medsolution_%'
  ) as politicas_medsolution
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname in (
    'usuarios',
    'personal_consultorio',
    'servicios',
    'pacientes',
    'historias_clinicas',
    'atenciones'
  )
group by c.relname, c.relrowsecurity
order by c.relname;
