-- MedSolution conserva su autenticación local original.
-- Supabase se utiliza exclusivamente como almacenamiento compartido.
-- Los roles se aplican en la interfaz y no constituyen seguridad de base de datos.

alter table public.usuarios disable row level security;
alter table public.personal_consultorio disable row level security;
alter table public.servicios disable row level security;
alter table public.pacientes disable row level security;
alter table public.historias_clinicas disable row level security;
alter table public.atenciones disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table
  public.personal_consultorio,
  public.servicios,
  public.pacientes,
  public.historias_clinicas,
  public.atenciones
to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function public.obtener_o_crear_historia(bigint) to anon, authenticated;
