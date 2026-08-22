-- MedSolution — preflight no disruptivo para migración a Supabase Auth.
-- No cierra acceso anon ni modifica datos clínicos.
-- Solo documenta/verifica precondiciones mediante comentarios en el repositorio.

-- Esta migración se mantiene intencionalmente sin DDL destructivo.
-- El cierre final de RLS/Storage se realizará en una migración posterior
-- únicamente después de validar sesiones autenticadas reales.
