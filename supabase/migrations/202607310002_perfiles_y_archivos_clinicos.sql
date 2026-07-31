-- MedSolution: perfiles locales configurables y archivos del expediente clínico.
-- No utiliza Supabase Auth; conserva los tres roles existentes.
begin;

create table if not exists public.perfiles_sistema (
  id uuid primary key default gen_random_uuid(),
  rol public.rol_aplicacion not null unique,
  usuario text not null unique check (length(trim(usuario)) > 0),
  password_hash text not null check (length(password_hash) = 8),
  nombre_completo text not null check (length(trim(nombre_completo)) > 0),
  cargo_profesional text not null default '',
  fotografia_path text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

drop trigger if exists actualizar_timestamp on public.perfiles_sistema;
create trigger actualizar_timestamp before update on public.perfiles_sistema
for each row execute function public.actualizar_timestamp();

insert into public.perfiles_sistema (rol, usuario, password_hash, nombre_completo, cargo_profesional, activo)
values
  ('Administrador', 'admin', '7045830c', 'Administrador', 'Administrador del sistema', true),
  ('Médico', 'doctor', 'aff0aba6', 'Médico', 'Médico', true),
  ('Auxiliar', 'auxiliar', '9a4e1ff7', 'Auxiliar', 'Auxiliar', true)
on conflict (rol) do nothing;

alter table public.perfiles_sistema enable row level security;
grant select, insert, update, delete on table public.perfiles_sistema to anon, authenticated;

drop policy if exists medsolution_perfiles_select on public.perfiles_sistema;
drop policy if exists medsolution_perfiles_insert on public.perfiles_sistema;
drop policy if exists medsolution_perfiles_update on public.perfiles_sistema;
drop policy if exists medsolution_perfiles_delete on public.perfiles_sistema;
create policy medsolution_perfiles_select on public.perfiles_sistema for select to anon, authenticated using (true);
create policy medsolution_perfiles_insert on public.perfiles_sistema for insert to anon, authenticated with check (true);
create policy medsolution_perfiles_update on public.perfiles_sistema for update to anon, authenticated using (true) with check (true);
create policy medsolution_perfiles_delete on public.perfiles_sistema for delete to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medsolution-archivos', 'medsolution-archivos', false, 52428800,
  null
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists medsolution_archivos_select on storage.objects;
drop policy if exists medsolution_archivos_insert on storage.objects;
drop policy if exists medsolution_archivos_update on storage.objects;
drop policy if exists medsolution_archivos_delete on storage.objects;
create policy medsolution_archivos_select on storage.objects for select to anon, authenticated using (bucket_id = 'medsolution-archivos');
create policy medsolution_archivos_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'medsolution-archivos');
create policy medsolution_archivos_update on storage.objects for update to anon, authenticated using (bucket_id = 'medsolution-archivos') with check (bucket_id = 'medsolution-archivos');
create policy medsolution_archivos_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'medsolution-archivos');

do $$ begin
  alter publication supabase_realtime add table public.perfiles_sistema;
exception when duplicate_object then null; end $$;

commit;
