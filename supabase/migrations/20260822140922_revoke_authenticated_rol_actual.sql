-- Cierra la última función SECURITY DEFINER marcada por el asesor de seguridad.
-- MedSolution mantiene autenticación local, por lo que esta RPC no es necesaria para el funcionamiento actual.

revoke execute on function public.rol_actual() from public, anon, authenticated;
