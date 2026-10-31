# Respaldo y restauración aislada de MedSolution

## Método preparado

El workflow `.github/workflows/manual-encrypted-backup.yml` solo se ejecuta por `workflow_dispatch` en `main`. La operación predeterminada es `preflight`: autentica contra el Session Pooler, inspecciona permisos de catálogo y ejecuta un `pg_dump --schema-only` dirigido a un archivo temporal que se elimina. No lee filas clínicas ni objetos de Storage. Usa PostgreSQL client 17 desde el runner Linux; no usa Supabase CLI ni necesita Docker para exportar.

La URI debe copiarse completa desde Supabase **Connect → Session pooler**, puerto `5432`, y guardarse como secreto. El workflow valida que el host termine en `.pooler.supabase.com`, el puerto sea `5432`, la base sea `postgres`, el usuario sea `supabase_read_only_user.lirfjvsqpetdfryywefq` y TLS esté habilitado. El hostname no se codifica en el repositorio porque Supabase asigna el host por región e índice. La contraseña se coloca en un `PGPASSFILE` temporal modo `0600`; no se pasa como argumento ni se imprime. Los errores de PostgreSQL se suprimen y el log solo muestra un mensaje genérico.

Una ejecución `backup` vuelve a realizar el mismo preflight antes de exportar. Requiere confirmación manual de cuota/acceso y destino recuperable, además de habilitar la subida del artifact cifrado. El dump PostgreSQL 17 incluye todos los esquemas, datos, funciones, triggers, policies, secuencias, extensiones y ACL de base de datos. `roles.csv` y `role-memberships.csv` guardan metadatos sin hashes de contraseñas. Los bytes de Storage se obtienen por separado mediante la API de Storage, usando la clave pública y las políticas vigentes; no se usa `service_role`.

El paquete se comprime y cifra con `age` antes de subirlo. Se calcula SHA-256 del ciphertext y, dentro del paquete, de cada archivo. El artifact está configurado para vencer en un día. No hay subida automática fuera de la operación manual ni artifact en modo `preflight`.

## Conexión y permisos que requieren verificación

En la inspección de solo lectura del proyecto se observó que `supabase_read_only_user` puede iniciar sesión, tiene `BYPASSRLS`, `pg_read_all_data` y `pg_monitor`, está configurado con `default_transaction_read_only=on`, no es superusuario ni puede crear roles o bases, y no tiene privilegios de escritura en relaciones de `public`, `auth` o `storage`. La conexión por el Session Pooler todavía no se ha probado porque la URI real de **Connect** y su contraseña no están configuradas. El workflow preflight debe verificar la URI real y el acceso a metadatos del esquema antes de permitir exportación.

`pg_monitor` es una membresía de lectura adicional que no se necesita para `pg_dump`; el preflight la rechaza junto con cualquier membresía distinta de `pg_read_all_data`. No se revoca aquí porque sería un cambio de permisos productivo no autorizado. Para que el preflight pase, la persona propietaria deberá gestionar esa corrección mediante el proceso de cambios de Supabase y volver a ejecutar solo `preflight`. La contraseña nunca debe enviarse por chat.

El rol requiere `BYPASSRLS` para que `pg_dump` pueda leer de forma consistente tablas protegidas por RLS; ese atributo solo permite eludir RLS y no concede por sí solo permisos de escritura. La cuenta actualmente tiene una configuración por defecto de solo lectura. La conexión pooler y los permisos se validan en el propio workflow antes de leer registros clínicos.

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

No se ha ejecutado el workflow, no se ha autenticado aún por Session Pooler, no se han exportado filas productivas ni Storage, y no se ha producido artifact ni restauración. El artifact/retención no se ha comprobado; la primera ejecución completa queda condicionada a comprobarlo en GitHub y preparar la descarga externa. Este cambio modifica solamente el workflow, el exportador y esta guía; no modifica Supabase, Vercel ni la autenticación de la aplicación.
