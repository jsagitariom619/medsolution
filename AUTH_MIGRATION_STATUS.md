# Estado de migración de autenticación

Producción permanece con autenticación local activa. No se han cerrado políticas `anon` de tablas clínicas ni de Storage.

La migración final queda bloqueada únicamente por la creación de usuarios en Supabase Auth mediante un método soportado. Hasta entonces, cualquier cambio que retire acceso `anon` sería disruptivo y no debe aplicarse.
