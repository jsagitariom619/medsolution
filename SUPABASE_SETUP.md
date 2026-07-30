# Configuración de Supabase para MedSolution

## 1. Crear la estructura

1. Abre **SQL Editor** en tu proyecto Supabase.
2. Ejecuta el archivo `supabase/schema.sql`.
3. En **Authentication → Users**, crea el primer usuario administrador.
4. Copia su UUID y ejecuta:

```sql
insert into public.profiles (user_id, email, full_name, role)
values ('UUID_DEL_USUARIO', 'correo@consultorio.com', 'Administrador', 'Administrador');
```

## 2. Desplegar la administración segura de usuarios

Desde Supabase CLI, dentro de la carpeta del proyecto:

```bash
supabase functions deploy manage-user
```

La función utiliza automáticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` en el entorno seguro de Supabase. La clave
`service_role` nunca debe colocarse en los archivos del navegador.

## 3. Conectar MedSolution

1. Ingresa con el administrador demo local.
2. Abre **Configuración**.
3. En la sección **Supabase**, registra:
   - URL del proyecto.
   - Clave pública `anon`.
4. Presiona **Guardar y probar conexión**.
5. Cierra sesión e ingresa con el correo y contraseña del administrador creado
   en Supabase.

## 4. Configurar desde la interfaz

- **Servicios** permite crear, editar, desactivar y reactivar servicios.
- En la misma pantalla, **Personal del Consultorio** permite administrar
  responsables sin crearles un usuario.
- **Configuración → Usuarios** administra los perfiles Administrador, Médico y
  Auxiliar.
- El sistema no incluye servicios ni nombres de responsables fijos. Después de
  la primera conexión, crea el catálogo y el personal desde la interfaz.
- Los cambios en servicios, personal y atenciones se propagan mediante
  Supabase Realtime.

## Seguridad

El esquema activa RLS. El Auxiliar no tiene acceso a historias clínicas ni a
configuración; el Médico tiene acceso clínico; el Administrador tiene acceso
total. Mantén habilitadas las políticas incluidas y nunca publiques una clave
`service_role`.
