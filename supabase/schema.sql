-- MedSolution configurable platform — execute once in Supabase SQL Editor.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('Administrador', 'Médico', 'Auxiliar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.responsible_type as enum ('Doctor', 'Auxiliar', 'Ambos');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.app_role not null default 'Auxiliar',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role public.app_role primary key,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(12,2) not null default 0 check (price >= 0),
  description text not null default '',
  active boolean not null default true,
  requires_medical_consultation boolean not null default false,
  generates_medical_record boolean not null default false,
  allowed_responsible public.responsible_type not null default 'Ambos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migración compatible desde la versión configurable anterior.
alter table public.services drop column if exists category;
alter table public.services drop column if exists duration_minutes;
alter table public.staff_members add column if not exists position text;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff_members' and column_name='staff_type') then
    execute 'update public.staff_members set position = coalesce(position, staff_type::text) where position is null';
  end if;
end $$;
alter table public.staff_members alter column position set not null;
alter table public.staff_members drop column if exists staff_type;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.attentions (
  id uuid primary key default gen_random_uuid(),
  legacy_id bigint not null unique,
  patient_ref text not null,
  patient_name text not null,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  price_snapshot numeric(12,2) not null default 0 check (price_snapshot >= 0),
  responsible_name text,
  registered_by_user uuid references auth.users(id) on delete set null,
  registered_by_name text not null default '',
  status text not null check (status in ('Pendiente','Pendiente de consulta','En consulta','Finalizada','Cancelada')),
  arrival_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.attentions add column if not exists price_snapshot numeric(12,2) not null default 0;
alter table public.attentions add column if not exists responsible_name text;
alter table public.attentions add column if not exists registered_by_user uuid references auth.users(id) on delete set null;
alter table public.attentions add column if not exists registered_by_name text not null default '';

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  legacy_id bigint not null unique,
  full_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_ref text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where user_id = auth.uid() and active = true $$;

alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.services enable row level security;
alter table public.staff_members enable row level security;
alter table public.app_settings enable row level security;
alter table public.attentions enable row level security;
alter table public.patients enable row level security;
alter table public.medical_records enable row level security;

drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read authenticated" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for all to authenticated using (public.current_app_role() = 'Administrador') with check (public.current_app_role() = 'Administrador');

drop policy if exists "catalog read authenticated" on public.services;
create policy "catalog read authenticated" on public.services for select to authenticated using (true);
drop policy if exists "catalog admin write" on public.services;
create policy "catalog admin write" on public.services for all to authenticated using (public.current_app_role() = 'Administrador') with check (public.current_app_role() = 'Administrador');
drop policy if exists "staff read authenticated" on public.staff_members;
create policy "staff read authenticated" on public.staff_members for select to authenticated using (true);
drop policy if exists "staff admin write" on public.staff_members;
create policy "staff admin write" on public.staff_members for all to authenticated using (public.current_app_role() = 'Administrador') with check (public.current_app_role() = 'Administrador');
drop policy if exists "settings admin only" on public.app_settings;
create policy "settings admin only" on public.app_settings for all to authenticated using (public.current_app_role() = 'Administrador') with check (public.current_app_role() = 'Administrador');
drop policy if exists "permissions read authenticated" on public.role_permissions;
create policy "permissions read authenticated" on public.role_permissions for select to authenticated using (true);
drop policy if exists "permissions admin write" on public.role_permissions;
create policy "permissions admin write" on public.role_permissions for all to authenticated using (public.current_app_role() = 'Administrador') with check (public.current_app_role() = 'Administrador');

drop policy if exists "attentions read staff" on public.attentions;
create policy "attentions read staff" on public.attentions for select to authenticated using (
  public.current_app_role() in ('Administrador','Médico')
  or (
    public.current_app_role() = 'Auxiliar'
    and (
      not exists (select 1 from public.services s where s.id = attentions.service_id and s.requires_medical_consultation = true)
      or status in ('Pendiente','Pendiente de consulta')
    )
  )
);
drop policy if exists "attentions create staff" on public.attentions;
create policy "attentions create staff" on public.attentions for insert to authenticated with check (public.current_app_role() is not null);
drop policy if exists "attentions update staff" on public.attentions;
create policy "attentions update staff" on public.attentions for update to authenticated using (
  public.current_app_role() in ('Administrador','Médico')
  or (
    public.current_app_role() = 'Auxiliar'
    and not exists (select 1 from public.services s where s.id = attentions.service_id and s.requires_medical_consultation = true)
  )
) with check (
  public.current_app_role() in ('Administrador','Médico')
  or (
    public.current_app_role() = 'Auxiliar'
    and not exists (select 1 from public.services s where s.id = attentions.service_id and s.requires_medical_consultation = true)
  )
);
drop policy if exists "attentions delete clinical" on public.attentions;
create policy "attentions delete clinical" on public.attentions for delete to authenticated using (public.current_app_role() in ('Administrador','Médico'));

drop policy if exists "records clinical only" on public.medical_records;
create policy "records clinical only" on public.medical_records for all to authenticated using (public.current_app_role() in ('Administrador','Médico')) with check (public.current_app_role() in ('Administrador','Médico'));

drop policy if exists "patients read staff" on public.patients;
create policy "patients read staff" on public.patients for select to authenticated using (public.current_app_role() is not null);
drop policy if exists "patients create staff" on public.patients;
create policy "patients create staff" on public.patients for insert to authenticated with check (public.current_app_role() is not null);
drop policy if exists "patients clinical update" on public.patients;
create policy "patients clinical update" on public.patients for update to authenticated using (public.current_app_role() in ('Administrador','Médico')) with check (public.current_app_role() in ('Administrador','Médico'));
drop policy if exists "patients admin delete" on public.patients;
create policy "patients admin delete" on public.patients for delete to authenticated using (public.current_app_role() = 'Administrador');

insert into public.role_permissions(role, permissions) values
('Administrador','{"system.configure":true,"users.manage":true,"services.manage":true,"clinical.full":true,"reports.all":true}'),
('Médico','{"clinical.full":true,"consultations.accept":true,"documents.print":true}'),
('Auxiliar','{"patients.create":true,"attentions.create":true,"procedures.complete":true}')
on conflict (role) do update set permissions = excluded.permissions;

do $$ begin alter publication supabase_realtime add table public.services; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.staff_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.attentions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.patients; exception when duplicate_object then null; end $$;
