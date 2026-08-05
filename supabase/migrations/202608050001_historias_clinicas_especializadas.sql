-- MedSolution: extensiones escalables para historias clínicas especializadas.
-- Migración exclusivamente aditiva: no altera tablas, políticas ni Realtime existentes.
begin;

create table if not exists public.historias_clinicas_especializadas (
  id uuid primary key default gen_random_uuid(),
  historia_clinica_id uuid not null references public.historias_clinicas(id) on delete cascade,
  tipo_plantilla text not null check (tipo_plantilla ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  nombre_plantilla_snapshot text not null check (length(trim(nombre_plantilla_snapshot)) > 0),
  version_plantilla smallint not null default 1 check (version_plantilla > 0),
  estado text not null default 'Activo' check (estado in ('Activo','Finalizado','Suspendido','Cancelado')),
  fecha_inicio date not null,
  costo_total numeric(12,2) not null default 0 check (costo_total >= 0),
  sesiones_estimadas integer check (sesiones_estimadas is null or sesiones_estimadas > 0),
  datos_iniciales jsonb not null default '{}'::jsonb check (jsonb_typeof(datos_iniciales) = 'object'),
  creado_por_nombre_snapshot text not null default '',
  actualizado_por_nombre_snapshot text not null default '',
  finalizado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check ((estado = 'Finalizado' and finalizado_en is not null) or estado <> 'Finalizado')
);

create table if not exists public.evoluciones_historias_especializadas (
  id uuid primary key default gen_random_uuid(),
  historia_especializada_id uuid not null references public.historias_clinicas_especializadas(id) on delete cascade,
  atencion_id uuid not null unique references public.atenciones(id) on delete cascade,
  metricas jsonb not null default '{}'::jsonb check (jsonb_typeof(metricas) = 'object'),
  datos_evolucion jsonb not null default '{}'::jsonb check (jsonb_typeof(datos_evolucion) = 'object'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.pagos_historias_especializadas (
  id uuid primary key default gen_random_uuid(),
  historia_especializada_id uuid not null references public.historias_clinicas_especializadas(id) on delete restrict,
  atencion_id uuid references public.atenciones(id) on delete set null,
  fecha_pago timestamptz not null default now(),
  monto numeric(12,2) not null check (monto > 0),
  metodo_pago text not null check (length(trim(metodo_pago)) > 0),
  observaciones text not null default '',
  registrado_por_nombre_snapshot text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists historias_especializadas_historia_idx
  on public.historias_clinicas_especializadas (historia_clinica_id, fecha_inicio desc);
create index if not exists historias_especializadas_tipo_estado_idx
  on public.historias_clinicas_especializadas (tipo_plantilla, estado);
create unique index if not exists historias_especializadas_un_activo_idx
  on public.historias_clinicas_especializadas (historia_clinica_id, tipo_plantilla)
  where estado = 'Activo';
create index if not exists evoluciones_especializadas_historia_idx
  on public.evoluciones_historias_especializadas (historia_especializada_id, creado_en desc);
create index if not exists evoluciones_especializadas_metricas_idx
  on public.evoluciones_historias_especializadas using gin (metricas);
create index if not exists pagos_especializados_historia_fecha_idx
  on public.pagos_historias_especializadas (historia_especializada_id, fecha_pago desc);
create index if not exists pagos_especializados_fecha_idx
  on public.pagos_historias_especializadas (fecha_pago desc);
create index if not exists pagos_especializados_atencion_idx
  on public.pagos_historias_especializadas (atencion_id) where atencion_id is not null;

drop trigger if exists actualizar_timestamp on public.historias_clinicas_especializadas;
create trigger actualizar_timestamp before update on public.historias_clinicas_especializadas
for each row execute function public.actualizar_timestamp();
drop trigger if exists actualizar_timestamp on public.evoluciones_historias_especializadas;
create trigger actualizar_timestamp before update on public.evoluciones_historias_especializadas
for each row execute function public.actualizar_timestamp();
drop trigger if exists actualizar_timestamp on public.pagos_historias_especializadas;
create trigger actualizar_timestamp before update on public.pagos_historias_especializadas
for each row execute function public.actualizar_timestamp();

alter table public.historias_clinicas_especializadas enable row level security;
alter table public.evoluciones_historias_especializadas enable row level security;
alter table public.pagos_historias_especializadas enable row level security;
grant select, insert, update, delete on table
  public.historias_clinicas_especializadas,
  public.evoluciones_historias_especializadas,
  public.pagos_historias_especializadas
to anon, authenticated;

drop policy if exists medsolution_historias_especializadas_select on public.historias_clinicas_especializadas;
drop policy if exists medsolution_historias_especializadas_insert on public.historias_clinicas_especializadas;
drop policy if exists medsolution_historias_especializadas_update on public.historias_clinicas_especializadas;
drop policy if exists medsolution_historias_especializadas_delete on public.historias_clinicas_especializadas;
create policy medsolution_historias_especializadas_select on public.historias_clinicas_especializadas for select to anon, authenticated using (true);
create policy medsolution_historias_especializadas_insert on public.historias_clinicas_especializadas for insert to anon, authenticated with check (true);
create policy medsolution_historias_especializadas_update on public.historias_clinicas_especializadas for update to anon, authenticated using (true) with check (true);
create policy medsolution_historias_especializadas_delete on public.historias_clinicas_especializadas for delete to anon, authenticated using (true);

drop policy if exists medsolution_evoluciones_especializadas_select on public.evoluciones_historias_especializadas;
drop policy if exists medsolution_evoluciones_especializadas_insert on public.evoluciones_historias_especializadas;
drop policy if exists medsolution_evoluciones_especializadas_update on public.evoluciones_historias_especializadas;
drop policy if exists medsolution_evoluciones_especializadas_delete on public.evoluciones_historias_especializadas;
create policy medsolution_evoluciones_especializadas_select on public.evoluciones_historias_especializadas for select to anon, authenticated using (true);
create policy medsolution_evoluciones_especializadas_insert on public.evoluciones_historias_especializadas for insert to anon, authenticated with check (true);
create policy medsolution_evoluciones_especializadas_update on public.evoluciones_historias_especializadas for update to anon, authenticated using (true) with check (true);
create policy medsolution_evoluciones_especializadas_delete on public.evoluciones_historias_especializadas for delete to anon, authenticated using (true);

drop policy if exists medsolution_pagos_especializados_select on public.pagos_historias_especializadas;
drop policy if exists medsolution_pagos_especializados_insert on public.pagos_historias_especializadas;
drop policy if exists medsolution_pagos_especializados_update on public.pagos_historias_especializadas;
drop policy if exists medsolution_pagos_especializados_delete on public.pagos_historias_especializadas;
create policy medsolution_pagos_especializados_select on public.pagos_historias_especializadas for select to anon, authenticated using (true);
create policy medsolution_pagos_especializados_insert on public.pagos_historias_especializadas for insert to anon, authenticated with check (true);
create policy medsolution_pagos_especializados_update on public.pagos_historias_especializadas for update to anon, authenticated using (true) with check (true);
create policy medsolution_pagos_especializados_delete on public.pagos_historias_especializadas for delete to anon, authenticated using (true);

do $$ begin
  alter publication supabase_realtime add table public.historias_clinicas_especializadas;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.evoluciones_historias_especializadas;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pagos_historias_especializadas;
exception when duplicate_object then null; end $$;

commit;
