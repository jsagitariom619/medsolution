-- MedSolution: garantía de sincronización multiusuario para la Agenda.
-- Idempotente: puede ejecutarse aunque 202607310004 ya haya sido aplicada.

begin;

do $$
begin
  if to_regclass('public.citas') is null then
    raise exception 'Falta public.citas. Ejecuta primero 202607310004_unificar_agenda_atenciones.sql';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'atenciones' and column_name = 'cita_id'
  ) then
    raise exception 'Falta public.atenciones.cita_id. Ejecuta primero 202607310004_unificar_agenda_atenciones.sql';
  end if;
end
$$;

alter table public.citas enable row level security;
alter table public.citas replica identity full;

update public.citas
set estado = 'Pendiente'
where estado in ('Programada', 'Confirmada');

alter table public.citas drop constraint if exists citas_estado_check;
alter table public.citas add constraint citas_estado_check
check (estado in ('Pendiente','En Atención','Atendida','Cancelada','Reprogramada'));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.citas to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists medsolution_citas_select on public.citas;
drop policy if exists medsolution_citas_insert on public.citas;
drop policy if exists medsolution_citas_update on public.citas;
drop policy if exists medsolution_citas_delete on public.citas;

create policy medsolution_citas_select on public.citas
for select to anon, authenticated using (true);
create policy medsolution_citas_insert on public.citas
for insert to anon, authenticated with check (true);
create policy medsolution_citas_update on public.citas
for update to anon, authenticated using (true) with check (true);
create policy medsolution_citas_delete on public.citas
for delete to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'citas'
     ) then
    alter publication supabase_realtime add table public.citas;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;

-- Verificación visible en el editor SQL de Supabase.
select
  to_regclass('public.citas') is not null as tabla_citas,
  c.relrowsecurity as rls_habilitado,
  c.relreplident = 'f' as replica_identity_full,
  exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime'
      and p.schemaname = 'public'
      and p.tablename = 'citas'
  ) as realtime_publicado,
  count(pol.policyname) filter (where pol.policyname like 'medsolution_citas_%') as politicas_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies pol on pol.schemaname = n.nspname and pol.tablename = c.relname
where n.nspname = 'public' and c.relname = 'citas'
group by c.relrowsecurity, c.relreplident;
