# Registro Clínico: Supabase + Vercel

La integración utiliza exclusivamente la **Project URL** y la
**Publishable Key**. No requiere funciones con privilegios ni claves privadas.

## 1. Crear el esquema

Ejecuta la migración:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

También puedes copiar `supabase/migrations/202607300001_registro_clinico.sql`
en el SQL Editor del proyecto **Registro Clínico**.

La migración crea `usuarios`, `personal_consultorio`, `servicios`, `pacientes`,
`historias_clinicas` y `atenciones`; activa RLS, índices, relaciones y Realtime.

## 2. Crear el primer administrador

1. Crea el usuario en **Authentication → Users**.
2. El trigger crea automáticamente su fila en `public.usuarios` como Auxiliar.
3. Promuévelo una sola vez desde SQL Editor:

```sql
update public.usuarios
set rol = 'Administrador', nombre_completo = 'Administrador'
where email = 'admin@consultorio.com';
```

Después, el administrador puede crear los demás usuarios desde la interfaz.
Supabase puede requerir confirmación de correo según la configuración de Auth.

## 3. Variables de Vercel

Configura en **Project Settings → Environment Variables**, para Production,
Preview y Development:

```text
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

No uses prefijos `VITE_` ni escribas valores en archivos del navegador.
`/api/config` expone al cliente únicamente estos dos valores públicos.

## 4. Auth y URL

En **Authentication → URL Configuration** registra:

- Site URL: la URL de producción de Vercel.
- Redirect URLs: la URL de producción y los previews que utilices.

## 5. Verificación

1. Despliega en Vercel.
2. Inicia sesión con el administrador.
3. En **Configuración**, confirma el estado “Registro Clínico conectado”.
4. Crea o edita un servicio y comprueba que otro navegador lo reciba en tiempo real.
5. Registra una atención como Auxiliar y acéptala como Médico.

La seguridad efectiva está en las políticas RLS de la migración. La interfaz
oculta acciones por rol, pero nunca sustituye las políticas de base de datos.
