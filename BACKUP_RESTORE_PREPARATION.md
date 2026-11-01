# Respaldo y restauración aislada de MedSolution

## Método preparado

El workflow `.github/workflows/manual-encrypted-backup.yml` solo se ejecuta por `workflow_dispatch` en `main`. La operación predeterminada es `preflight`: autentica contra el Session Pooler, inspecciona permisos de catálogo y ejecuta un `pg_dump --schema-only` dirigido a un archivo temporal que se elimina. No lee filas clínicas ni objetos de Storage. Usa PostgreSQL client 17 desde el runner Linux; no usa Supabase CLI ni necesita Docker para exportar.

La URI debe copiarse completa desde Supabase **Connect → Session pooler**, puerto `5432`, y guardarse como secreto. El workflow valida que el host termine en `.pooler.supabase.com`, el puerto sea `5432`, la base sea `postgres`, el usuario sea `supabase_read_only_user.lirfjvsqpetdfryywefq` y TLS esté habilitado. El hostname no se codifica en el repositorio porque Supabase asigna el host por región e índice. La contraseña se coloca en un `PGPASSFILE` temporal modo `0600`; no se pasa como argumento ni se imprime. Los errores de PostgreSQL se suprimen y el log solo muestra un mensaje genérico.

## Autenticación temporal JIT para Session Pooler

El exportador admite ambos modos sin cambiar el workflow: una URI sin el parámetro `options` conserva la autenticación PostgreSQL por contraseña; una URI con `options=-c%20jit%3Don` habilita el modo temporal. En este último modo, la contraseña del URI debe ser el token personal de acceso Supabase autorizado para asumir el rol existente `supabase_read_only_user.lirfjvsqpetdfryywefq`. El script convierte el parámetro aprobado en `PGOPTIONS='-c jit=on'`, que libpq transmite como opción de conexión a `psql` y `pg_dump`. La guía de Supabase muestra `jit=true`; PostgreSQL también admite `on` como valor verdadero para booleanos. El token solo se lee desde el secreto `MEDSOLUTION_DB_URL_RO`, se escribe en el `PGPASSFILE` temporal de permisos `0600` y se elimina al finalizar; no se imprime ni se pasa como argumento. El URI se quita del entorno del proceso antes de invocar `psql` o `pg_dump`.

La documentación de Supabase exige Temporary Access habilitado, **Enforce SSL** activo y PostgreSQL `17.6.1.081` o posterior. El proyecto está en `17.6.1.155`; la persona propietaria confirmó que SSL está desactivado y Temporary Access aparece en la vista previa. Una lectura de `pg_stat_activity`/`pg_stat_ssl` detectó una conexión `postgres_exporter` inactiva sin SSL, pero no identifica quién la administra ni si puede configurarse con TLS. Las demás conexiones Supabase observadas usaban SSL. La instantánea no demuestra que no haya actividad clínica. No se habilitó ni modificó ninguna configuración. La activación de SSL reinicia PostgreSQL y puede causar unos minutos de indisponibilidad. Aunque existe autorización para hacerlo en una ventana sin actividad clínica, no debe aplicarse hasta confirmar el destino/configuración del exporter y establecer esa ventana. El conector de Supabase disponible solo ofrece metadatos y consultas de base de datos, no escritura de configuración de proyecto; por eso no se pudo cambiar SSL ni habilitar JIT desde este entorno.

Procedimiento cuando se autorice la configuración:

1. Identificar al propietario y la configuración de TLS de `postgres_exporter`, verificar las demás conexiones PostgreSQL y coordinar una ventana sin actividad clínica. Con la autorización ya concedida, el responsable con permiso Owner/Admin puede activar **Enforce SSL** desde Supabase → Database Settings; esperar a que el proyecto vuelva a healthy y probar monitoreo y aplicación antes de continuar. Supabase documenta que el cambio reinicia la base y puede implicar minutos de indisponibilidad.
2. Con Temporary Access disponible, mapear desde el Dashboard al miembro del equipo que ejecutará el respaldo únicamente al rol existente `supabase_read_only_user`, con vencimiento corto que cubra el preflight y el respaldo. No mapearlo a `postgres` ni a roles administrativos.
3. Crear en el Dashboard un Personal Access Token para ese miembro con vencimiento breve. No compartirlo por chat. Si Supabase permite una restricción de red aplicable al runner, limitarla; los runners hospedados de GitHub no tienen una IP fija exclusiva por ejecución.
4. Copiar el hostname real y los datos de conexión de Supabase → Connect → Session pooler. Configurar el secreto existente `MEDSOLUTION_DB_URL_RO` con el usuario `supabase_read_only_user.lirfjvsqpetdfryywefq`, el token como contraseña, TLS y el parámetro `options=-c%20jit%3Don`. No crear un secreto nuevo ni poner el token en el repositorio.
5. Ejecutar manualmente solo `preflight`. Confirmar que los logs no contienen el token y que la identidad reportada por el control es exactamente el rol de solo lectura. Solo después de revisar el resultado y autorizar el respaldo completo se usaría el mismo secreto para esa ejecución.
6. Al terminar, revocar el token desde la cuenta Supabase, quitar el mapeo JIT y retirar o reemplazar el valor del secreto de GitHub. El vencimiento del token y el de la asignación JIT son controles complementarios; no asumir que uno revoca automáticamente el otro.

El ajuste local acepta solo el valor exacto `-c jit=on`; rechaza opciones de conexión adicionales no revisadas. El test sintético `bash tests/backup-jit-preflight.test.sh` verifica el encaminamiento de `PGOPTIONS`, el secreto de conexión en el archivo temporal, sus permisos y su eliminación, usando binarios simulados y sin conectarse a Supabase ni leer datos clínicos. El preflight productivo aún no se ha ejecutado con JIT.

Una ejecución `backup` vuelve a realizar el mismo preflight antes de exportar. Requiere confirmación manual de cuota/acceso y destino recuperable, además de habilitar la subida del artifact cifrado. El dump PostgreSQL 17 incluye todos los esquemas, datos, funciones, triggers, policies, secuencias, extensiones y ACL de base de datos. `roles.csv` y `role-memberships.csv` guardan metadatos sin hashes de contraseñas. Los bytes de Storage se obtienen por separado mediante la API de Storage, usando la clave pública y las políticas vigentes; no se usa `service_role`.

El paquete se comprime y cifra con `age` antes de subirlo. Se calcula SHA-256 del ciphertext y, dentro del paquete, de cada archivo. El artifact está configurado para vencer en un día. No hay subida automática fuera de la operación manual ni artifact en modo `preflight`.

## Membresía `pg_monitor` y decisión de seguridad

Supabase registra `supabase_admin` como grantor de la membresía `pg_monitor` de `supabase_read_only_user`; la membresía tiene `admin_option=false`, `inherit_option=true` y `set_option=true`. La documentación oficial confirma que el rol `postgres` del cliente no puede revocar membresías concedidas por `supabase_admin`; no se debe intentar `REVOKE`, recrear el usuario ni modificar sus opciones para sortearlo. No se ejecutaron escrituras en producción. La vía sin cambios productivos es admitir explícitamente esta membresía durante el preflight.

`pg_monitor` no concede `INSERT`, `UPDATE`, `DELETE`, creación de esquemas/bases/roles ni administración de otros roles. Añade lectura de configuración y estadísticas de todas las sesiones, y permite funciones de análisis que pueden tomar bloqueos `ACCESS SHARE`. El acceso a estadísticas puede mostrar actividad y consultas en curso; ese es un acceso adicional que debe quedar documentado como excepción, aunque la cuenta ya necesita leer todo el contenido clínico para generar el dump.

La inspección de solo lectura observó también:

- `BYPASSRLS=true`, necesario para que `pg_dump` incluya todas las filas de tablas protegidas por RLS.
- Membresías heredadas en `pg_read_all_data` y `pg_monitor`; ninguna con `ADMIN OPTION`. Puede hacer `SET ROLE` únicamente a esas funciones de lectura/monitoreo entre las funciones privilegiadas comprobadas; no puede asumir `postgres`, `supabase_admin`, `service_role` ni roles de escritura/operación del servidor.
- Sin atributos `SUPERUSER`, `CREATEDB`, `CREATEROLE` o `REPLICATION`; sin `CREATE` de base/esquema ni DML en las 64 relaciones de aplicación inspeccionadas; sí tiene `SELECT` y `USAGE` en todos sus esquemas de aplicación.
- `default_transaction_read_only=on`; cero objetos grandes y extensión `pg_net` ausente. No se hallaron funciones `SECURITY DEFINER` ejecutables por este rol en esquemas de aplicación.

El preflight deja de rechazar únicamente la presencia de `pg_monitor`. En su lugar comprueba atributos administrativos, `ADMIN OPTION`, capacidad efectiva de asumir roles privilegiados, CREATE/DML, SELECT/USAGE necesarios, objetos grandes, `pg_net` y funciones `SECURITY DEFINER` ejecutables. Solo admite membresías en `pg_read_all_data` y `pg_monitor`; cualquier otra membresía inesperada detiene el flujo. `pg_dump --schema-only` sigue validando el acceso al esquema sin leer filas clínicas.

**Límite de solo lectura:** `default_transaction_read_only=on` es un valor predeterminado, no una barrera inmutable. El rol puede cambiarlo en su sesión, y PostgreSQL concede a `PUBLIC` ejecución de funciones como `lo_create`/`lo_put`; la inspección encontró esas funciones ejecutables, aunque hoy no hay objetos grandes. El preflight bloquea si ya existen objetos grandes o si se instala `pg_net`/se vuelve ejecutable una función `SECURITY DEFINER` de aplicación. No demuestra que un proceso comprometido no pueda usar otros efectos laterales de funciones. La excepción se justifica solo para el workflow manual, con secretos en pasos acotados, runner efímero, sin `set -x`, errores SQL suprimidos, y código bajo el control del propietario. El workflow no consulta estadísticas ni ejecuta funciones de monitoreo. Si ese riesgo residual no es aceptable, no ejecutar el preflight ni respaldar con este rol; retirar la membresía requiere una intervención soportada por Supabase, no un `REVOKE` desde `postgres`.

El rol requiere `BYPASSRLS` para la integridad de un dump completo; por sí solo no otorga escritura. La conexión por Session Pooler aún no se probó: no se han configurado los secretos y no se ejecutará el workflow hasta que el propietario lo autorice.

## Secretos de GitHub

El propietario configura estos secretos en **Settings → Secrets and variables → Actions → New repository secret**:

| Nombre | Valor esperado |
| --- | --- |
| `MEDSOLUTION_DB_URL_RO` | URI completa de Session Pooler (5432) copiada desde Supabase Connect, con rol `supabase_read_only_user` y TLS. No incluirla en el repositorio. |
| `MEDSOLUTION_SUPABASE_URL` | URL API del proyecto Supabase. |
| `MEDSOLUTION_SUPABASE_PUBLIC_KEY` | Publishable/anon key habilitada para listar y descargar objetos según las policies actuales; nunca `service_role`. |
| `MEDSOLUTION_BACKUP_AGE_RECIPIENT` | Recipient público `age`; la clave privada correspondiente se conserva fuera de GitHub. |

Los secretos aparecen solamente en los pasos que los necesitan: DB URL en preflight, URL/clave pública durante exportación, y recipient age durante cifrado. No compartir valores por chat.

## Cuota, descarga y conservación recuperable

Antes de seleccionar `backup`, el propietario debe revisar **GitHub → Settings → Billing and licensing → Usage** y confirmar que el artifact cabe en la cuota existente, confirmar acceso a Actions artifacts y preparar un destino cifrado institucional con espacio suficiente. El workflow no puede leer el saldo de cuota del propietario; por eso requiere que esa confirmación se haga manualmente. No activa gastos ni retención recurrente. La confirmación no sustituye la verificación real de cuota.

El backup exige subir el archivo cifrado como artifact de un día. Después del job, descargar desde **Actions → ejecución → Artifacts** el `.age` y su `.sha256` antes del vencimiento; copiar el ciphertext a la custodia externa cifrada preparada. Verificarlo con `sha256sum -c archivo.age.sha256`. Descifrar solo en un entorno aislado con la clave privada fuera de GitHub, verificar `SHA256SUMS` y conservar el ciphertext recuperable. Si no hay cuota o destino seguro, no seleccionar `backup`. El preflight no genera artifact ni exportación clínica.

## Restauración y límites

La exportación es un dump lógico completo de PostgreSQL y una descarga independiente de bytes de Storage, no un snapshot físico del proveedor. El volcado de base incluye `auth` y `storage`; restaurarlos en un stack Supabase ya inicializado puede colisionar con esquemas administrados. La guía de restauración debe ensayar el dump en PostgreSQL 17 aislado y después definir una restauración compatible de los componentes administrados, sin probar sobre producción. No se debe declarar recuperación completa hasta verificar ambas etapas y los objetos de Storage.

Los metadatos de roles no incluyen credenciales ni hashes; restablecer contraseñas de roles de login es un paso de recuperación separado. Tampoco se exportan secretos de plataforma, claves de firma de Auth, claves de cifrado de Storage, configuraciones de proyecto ni datos de facturación. Las extensiones administradas y capacidades del proveedor que no existan localmente deben registrarse como limitaciones.

## Estado

No se ha ejecutado el workflow, no se ha autenticado aún por Session Pooler, no se han exportado filas productivas ni Storage, y no se ha producido artifact ni restauración. El artifact/retención no se ha comprobado; la primera ejecución completa queda condicionada a comprobarlo en GitHub y preparar la descarga externa. La membresía `pg_monitor` permanece intacta. Este cambio local modifica solamente el exportador y esta guía; no modifica Supabase, el workflow publicado, Vercel ni la autenticación de la aplicación.
