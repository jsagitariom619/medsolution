-- MedSolution: permitir seguimientos especializados sin crear una atención general.
-- Conserva la clave foránea, la unicidad de las atenciones vinculadas, RLS y Realtime.
begin;

do $$
begin
  if to_regclass('public.evoluciones_historias_especializadas') is null then
    raise exception
      'No existe public.evoluciones_historias_especializadas. Migración cancelada.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'evoluciones_historias_especializadas'
      and column_name = 'atencion_id'
  ) then
    raise exception
      'No existe la columna atencion_id. Migración cancelada.';
  end if;
end
$$;

alter table public.evoluciones_historias_especializadas
  alter column atencion_id drop not null;

comment on column public.evoluciones_historias_especializadas.atencion_id is
  'Atención general relacionada, cuando corresponda. Puede ser NULL para seguimientos creados directamente dentro de una Historia Clínica Especializada.';

commit;
