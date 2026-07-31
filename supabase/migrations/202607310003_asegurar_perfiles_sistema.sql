-- MedSolution: perfiles configurables para la autenticación local.
-- Migración independiente de Storage y Supabase Auth.
-- Es idempotente y puede ejecutarse directamente desde el SQL Editor.
begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.rol_aplicacion as enum ('Administrador', 'Médico', 'Auxiliar');
exception when duplicate_object then null; end $$;

create or replace function public.actualizar_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_en = now();
  return new;
end
$$;

create table if not exists public.perfiles_sistema (
  id uuid primary key default gen_random_uuid(),
  rol public.rol_aplicacion not null,
  usuario text not null check (length(trim(usuario)) > 0),
  password_hash text not null check (length(password_hash) = 8),
  nombre_completo text not null check (length(trim(nombre_completo)) > 0),
  cargo_profesional text not null default '',
  fotografia_path text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint perfiles_sistema_rol_unico unique (rol),
  constraint perfiles_sistema_usuario_unico unique (usuario)
);

create unique index if not exists perfiles_sistema_usuario_normalizado_idx
  on public.perfiles_sistema (lower(trim(usuario)));
create index if not exists perfiles_sistema_activos_idx
  on public.perfiles_sistema (activo, rol);

drop trigger if exists actualizar_timestamp on public.perfiles_sistema;
create trigger actualizar_timestamp
before update on public.perfiles_sistema
for each row execute function public.actualizar_timestamp();

insert into public.perfiles_sistema
  (rol, usuario, password_hash, nombre_completo, cargo_profesional, activo)
values
  ('Administrador', 'admin', '7045830c', 'Administrador', 'Administrador del sistema', true),
  ('Médico', 'doctor', 'aff0aba6', 'Médico', 'Médico', true),
  ('Auxiliar', 'auxiliar', '9a4e1ff7', 'Auxiliar', 'Auxiliar', true)
on conflict (rol) do nothing;

alter table public.perfiles_sistema enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.perfiles_sistema to anon, authenticated;

drop policy if exists medsolution_perfiles_select on public.perfiles_sistema;
drop policy if exists medsolution_perfiles_insert on public.perfiles_sistema;
drop policy if exists medsolution_perfiles_update on public.perfiles_sistema;
drop policy if exists medsolution_perfiles_delete on public.perfiles_sistema;

create policy medsolution_perfiles_select
on public.perfiles_sistema for select to anon, authenticated
using (true);

create policy medsolution_perfiles_insert
on public.perfiles_sistema for insert to anon, authenticated
with check (true);

create policy medsolution_perfiles_update
on public.perfiles_sistema for update to anon, authenticated
using (true) with check (true);

create policy medsolution_perfiles_delete
on public.perfiles_sistema for delete to anon, authenticated
using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'perfiles_sistema'
     ) then
    alter publication supabase_realtime add table public.perfiles_sistema;
  end if;
end
$$;

commit;
