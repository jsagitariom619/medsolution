# Checklist de migración segura

- [ ] Frontend preparado para Supabase Auth con fallback local temporal.
- [ ] Usuarios Auth creados por método soportado.
- [ ] `public.usuarios` vinculado a `auth.users`.
- [ ] Sesión autenticada real confirmada.
- [ ] Roles Administrador/Médico/Auxiliar confirmados.
- [ ] Pacientes: lectura/escritura probada.
- [ ] Atenciones: lectura/escritura probada.
- [ ] Agenda: probada.
- [ ] Historias clínicas: lectura/escritura probada.
- [ ] Historias especializadas: probadas.
- [ ] Anticonceptivos: probado.
- [ ] Servicios y Reportes: probados.
- [ ] Storage: subida/lectura/reemplazo/eliminación probados.
- [ ] RLS `anon` cerrada solo después de las pruebas.
- [ ] Storage `anon` cerrado solo después de las pruebas.
- [ ] Realtime verificado.
- [ ] Rollback documentado y probado.
