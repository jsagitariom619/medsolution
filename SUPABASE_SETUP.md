# Registro Clínico: Supabase + Vercel

La integración utiliza exclusivamente la **Project URL** y la
**Publishable Key**. No requiere funciones con privilegios ni claves privadas.

## 1. Crear el esquema

Ejecuta la migración:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

También puedes ejecutar, en orden, los archivos de `supabase/migrations/` en el
SQL Editor del proyecto **Registro Clínico**. La migración
`202607310002_perfiles_y_archivos_clinicos.sql` agrega los tres perfiles
configurables y el bucket privado de adjuntos clínicos.

La migración crea `usuarios`, `personal_consultorio`, `servicios`, `pacientes`,
`historias_clinicas` y `atenciones`; activa RLS, índices, relaciones y Realtime.

## 2. Autenticación local

MedSolution no utiliza Supabase Auth. Después de instalar, están disponibles:

```text
admin / admin123
doctor / doctor123
auxiliar / aux123
```

Los tres perfiles conservan credenciales iniciales en `assets/js/auth.js` para
garantizar el primer acceso. Después, Administrador o Médico pueden cambiar
nombre, fotografía, usuario, contraseña, cargo y estado desde Configuración;
los cambios se guardan en `perfiles_sistema`. No se utiliza Supabase Auth.

Después de la migración principal, ejecuta también
`202607300002_local_auth_public_data.sql`. Esta política permite que la
Publishable Key acceda a los datos sin una sesión de Supabase Auth.

## 3. Variables de Vercel

Configura en **Project Settings → Environment Variables**, para Production,
Preview y Development:

```text
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

No uses prefijos `VITE_` ni escribas valores en archivos del navegador.
`/api/config` expone al cliente únicamente estos dos valores públicos.

## 4. Verificación

1. Despliega en Vercel.
2. Inicia sesión con `admin / admin123`.
3. En **Configuración**, confirma el estado “Registro Clínico conectado”.
4. Crea o edita un servicio y comprueba que otro navegador lo reciba en tiempo real.
5. Registra una atención como Auxiliar y acéptala como Médico.
6. Cambia un perfil y adjunta una imagen o PDF a una evolución clínica.

Los roles y permisos se aplican en la interfaz. Al no utilizar Supabase Auth,
la base de datos no puede verificar esos roles; la Publishable Key tiene acceso
a las tablas operativas.
