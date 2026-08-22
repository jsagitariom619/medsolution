# MedSolution — Migración segura de autenticación

Estado: preparación no disruptiva.

## Objetivo
Migrar desde autenticación local a Supabase Auth sin interrumpir el funcionamiento clínico actual y cerrar RLS/Storage solo después de validar sesiones autenticadas reales.

## Orden obligatorio
1. Preparar frontend compatible con Supabase Auth manteniendo fallback local temporal.
2. Crear usuarios Auth equivalentes (Administrador, Médico, Auxiliar) mediante método soportado de Supabase.
3. Vincular cada usuario Auth con `public.usuarios` y su rol.
4. Validar login y acceso por rol.
5. Validar Pacientes, Atenciones, Agenda, Historias, Anticonceptivos, Servicios, Reportes y Storage.
6. Recién después retirar acceso `anon` y endurecer RLS/Storage.
7. Validar regresiones y mantener rollback disponible.

## Regla de seguridad
No cerrar políticas `anon` mientras la aplicación dependa de autenticación local. Hacerlo antes de la migración bloquearía la plataforma.

## Riesgos controlados
- Bloqueo total si se cierra RLS antes de tiempo.
- Pérdida de sesión si se sustituye el login sin fallback.
- Desincronización entre rol de interfaz y rol de base de datos.
- Pérdida de acceso a Storage si las políticas se endurecen antes de emitir JWT autenticado.

## Rollback
Mientras no se cierre `anon`, el login local continúa siendo el mecanismo de respaldo. El cierre final de RLS/Storage debe ejecutarse como migración independiente y reversible.
