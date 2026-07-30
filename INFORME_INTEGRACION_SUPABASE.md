# Informe técnico — Registro Clínico

## Rama

Todo el trabajo se realizó en `feature/supabase-registro-clinico`. La rama
`main` conserva intacto el ZIP original.

## Arquitectura conservada

MedSolution continúa siendo una aplicación HTML/CSS/JavaScript sin proceso de
compilación. Se conservaron la navegación, estilos, formularios y componentes
de pacientes, atenciones, historias clínicas, servicios, personal, reportes,
agenda y configuración. La integración se concentra en la pasarela
`MedSolutionData`, por lo que los módulos visuales no conocen detalles de SQL.

## Archivos creados

| Archivo | Motivo |
|---|---|
| `.env.example` | Documentar las únicas dos variables públicas requeridas. |
| `.gitignore` | Evitar versionar variables locales y metadatos de Vercel. |
| `api/config.js` | Entregar al navegador URL y Publishable Key desde Vercel sin escribirlas en el código. |
| `vercel.json` | Configurar la función de entorno y desactivar su caché. |
| `supabase/migrations/202607300001_registro_clinico.sql` | Crear el esquema relacional, índices, triggers, RLS, datos iniciales y Realtime. |
| `INFORME_INTEGRACION_SUPABASE.md` | Documentar la entrega y su operación. |

## Archivos modificados

| Archivo | Motivo |
|---|---|
| `assets/js/supabase-client.js` | Adaptar la pasarela a las tablas normalizadas en español, variables Vercel, snapshots, RPC de historia única y Realtime. |
| `assets/js/auth.js` | Usar Supabase Auth y `usuarios`; restaurar sesiones persistidas. |
| `assets/js/main.js` | Esperar la configuración y restauración de Auth antes de proteger rutas. |
| `assets/js/appointments.js` | Esperar Supabase antes de cargar catálogo, cola y pacientes. |
| `assets/js/patients.js` | Esperar Supabase antes de cargar la fuente autoritativa. |
| `assets/js/medical-records.js` | Esperar Supabase y reutilizar la historia clínica única existente. |
| `assets/js/services.js` | Inicializar catálogo y personal después de conectar la pasarela. |
| `assets/js/reports.js` | Inicializar reportes con atenciones remotas y snapshots históricos. |
| `assets/js/settings.js` | Mostrar estado del entorno y administrar perfiles sin Edge Function privilegiada. |
| `pages/dashboard.html` | Cargar el cliente Supabase antes del guard de autenticación. |
| `pages/schedule.html` | Cargar el cliente Supabase antes del guard de autenticación. |
| `pages/settings.html` | Sustituir el formulario de claves en LocalStorage por estado de conexión Vercel. |
| `SUPABASE_SETUP.md` | Documentar migración, bootstrap del administrador, Auth y despliegue Vercel. |

## Archivos retirados

| Archivo | Motivo |
|---|---|
| `pages/nursing.html` | Era una pantalla independiente con datos demo, duplicada por el flujo configurable de Servicios/Atenciones. |
| `assets/js/nursing.js` | Su lógica queda sustituida por atenciones cuyo comportamiento depende del servicio. |
| `assets/css/nursing.css` | Sólo pertenecía a la pantalla independiente retirada; los estilos compartidos permanecen. |
| `supabase/functions/manage-user/index.ts` | Requería una clave privilegiada, expresamente prohibida. |
| `supabase/schema.sql` | Era el esquema anterior, denormalizado y con nombres de tablas incompatibles; se reemplaza por migración versionada. |

La funcionalidad operativa de procedimientos no se elimina: se registra desde
**Nueva Atención**, usa el catálogo dinámico, exige personal autorizado y
finaliza en el panel del Auxiliar cuando no requiere consulta.

## Tablas y relaciones

| Tabla | Relaciones principales |
|---|---|
| `usuarios` | PK/FK `id → auth.users.id`. |
| `personal_consultorio` | Referenciada por `atenciones.responsable_id`. |
| `servicios` | Referenciada por `atenciones.servicio_id`. |
| `pacientes` | Referenciada por historias y atenciones; `legacy_id` conserva compatibilidad de interfaz. |
| `historias_clinicas` | FK única `paciente_id → pacientes.id`, garantizando una historia por paciente. |
| `atenciones` | FK a paciente, servicio, historia, responsable y usuario registrador. |

`atenciones` copia nombre y precio del servicio, responsable y registrador al
momento del alta. Así, cambios futuros de catálogos no alteran contabilidad ni
reportes históricos. La información clínica extensible se conserva en
`datos_clinicos`, mientras evolución, diagnóstico, tratamiento, receta,
indicaciones y próximo control tienen columnas consultables.

## RLS

- `Administrador`: catálogos, personal, usuarios, pacientes, historias y atenciones.
- `Médico`: lectura/edición clínica, creación de historia única y gestión de consultas.
- `Auxiliar`: alta/lectura de pacientes y atenciones operativas; no accede a historias.
- Servicios y personal: lectura autenticada; escritura sólo del Administrador.
- Atenciones médicas: el Auxiliar puede crearlas y ver su estado pendiente, pero no editar su contenido clínico.
- Eliminaciones clínicas: restringidas al Administrador; las cancelaciones usan el estado de atención.

## Variables necesarias

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Se configuran en Vercel. No se necesita ni se admite una clave privada.

## Funcionalidades integradas

- Supabase Auth con tres roles.
- Catálogo y personal dinámicos.
- Pacientes y atenciones relacionales.
- Precio histórico inmutable por atención.
- Cola médica en tiempo real.
- Creación atómica de una única historia clínica por paciente.
- Persistencia de evolución, diagnóstico, tratamiento, receta, indicaciones y control.
- Reportes por fecha, servicio, responsable y registrador.
- Creación/edición/desactivación de usuarios sin función privilegiada.

## Validaciones ejecutadas

- `node --check` en todo `assets/js` y en `api/config.js`.
- `git diff --check`.
- Revisión de scripts Supabase antes de `main.js` en páginas protegidas.
- Búsqueda de referencias a tablas antiguas, Edge Function y claves privilegiadas.
- Confirmación de rama activa.

La validación en vivo de RLS, Auth y Realtime requiere desplegar la migración y
configurar las dos variables en el proyecto real.

## Mejoras futuras

- Añadir pruebas E2E contra un proyecto Supabase de staging.
- Incorporar recuperación de contraseña por correo.
- Crear una importación administrada de datos históricos existentes en
  LocalStorage, si hubiera una instalación productiva previa.
- Persistir Agenda y configuración general sólo si el consultorio decide
  compartirlas entre sedes; actualmente se preserva su funcionamiento existente.
