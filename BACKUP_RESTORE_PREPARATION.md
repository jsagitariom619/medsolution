# Respaldo y restauración aislada de MedSolution

## Método preparado

El workflow `.github/workflows/manual-encrypted-backup.yml` acepta únicamente `workflow_dispatch` en `main`, ejecuta en un runner Linux temporal, limita permisos del token a lectura, y deja `store_encrypted_artifact=false` de forma predeterminada. Exporta roles, esquema y datos con Supabase CLI fijado a `2.122.0`; requiere herramientas cliente PostgreSQL 17. Exporta de forma separada los bytes de `medsolution-archivos` por la Storage API. El paquete se cifra con `age` antes de ser elegible para artifact y se genera SHA-256 del ciphertext.

El artifact optativo dura un día; GitHub contabiliza el almacenamiento de artifacts por separado de los minutos gratuitos de runners públicos. Dejarlo apagado no almacena nada fuera del runner y hace que el respaldo temporal se descarte al cerrar el job. Activarlo puede consumir la cuota incluida o generar cargos si se excede; el workflow no tiene schedule, push ni pull request triggers, y no hace commits automáticos.

## Secretos que configura el propietario en GitHub

- `MEDSOLUTION_DB_URL_RO`: URI TLS de PostgreSQL con el rol `supabase_read_only_user`; debe apuntar a `db.lirfjvsqpetdfryywefq.supabase.co`, y no debe contener un usuario administrador.
- `MEDSOLUTION_SUPABASE_URL`: URL API del proyecto Supabase.
- `MEDSOLUTION_SUPABASE_PUBLIC_KEY`: publishable/anon key actual para listar/descargar objetos bajo las políticas vigentes. No es una service role key; almacenarla como secret reduce exposición accidental en la ejecución.
- `MEDSOLUTION_BACKUP_AGE_RECIPIENT`: recipient público `age` de una clave cuya privada se conserva fuera de GitHub y fuera del repositorio.

No compartir esos valores por chat. Antes de usar el workflow se deben revisar los permisos de Actions, restringir quién puede ejecutarlo y configurar la clave privada fuera de GitHub. No añadir jamás `service_role`, tokens de administración ni la clave privada age al workflow.

## Integridad y retención

Antes de cifrar, se crea `SHA256SUMS` para todos los archivos de base y Storage. Después se calcula SHA-256 del archivo cifrado. Para recuperar: descargar los dos archivos, verificar el checksum del ciphertext, descifrar con la clave privada guardada externamente, verificar `SHA256SUMS` y restaurar únicamente en una instancia aislada de Supabase local compatible con PostgreSQL 17. El manifiesto de Storage conserva ruta, tamaño, tipo de contenido y fecha, y los objetos quedan bajo `storage/objects/`.

Los artifacts de Actions son transferencia temporal, no conservación segura de largo plazo. Antes de activar `store_encrypted_artifact`, el propietario debe revisar en GitHub **Settings → Billing and licensing → Usage** que exista cuota libre, comprobar que su cuenta puede acceder al artifact y preparar el medio cifrado de destino. Tras la ejecución, se descarga desde **Actions → ejecución del workflow → Artifacts** antes de que venza el plazo de un día. La descarga contiene el `.age` y su `.sha256`; se verifica con `sha256sum -c archivo.age.sha256`, se conserva el ciphertext en un medio institucional cifrado y se comprueba descifrado con la clave privada custodiada fuera de GitHub. No ejecutar una exportación recuperable hasta tener confirmado ese destino y acceso.

Si no se habilita el artifact optativo, la ejecución solo sirve como ensayo de exportación/verificación y el runner descarta sus archivos al finalizar; eso **no constituye un respaldo recuperable**.

## Límites conocidos de restauración

El dump lógico de Supabase no es un snapshot físico ni una copia de secretos de plataforma, claves de cifrado raíz, configuración del proyecto o bytes de Storage. Los objetos de Storage se exportan como archivos por separado. Supabase documenta que las personalizaciones en `auth` y `storage` (por ejemplo, trigger en `auth.users` y policies de `storage.objects`) se exportan/restauran aparte, y que los roles LOGIN requieren establecimiento separado de contraseñas. El proyecto debe restaurarse en un stack local compatible con la misma versión mayor; extensiones o componentes gestionados no reproducibles se reportarán como limitación, sin declarar restauración completa.

## Estado al preparar este cambio

No se ejecutó el workflow, no se exportaron datos productivos, no se recibieron secretos, no se generó artifact ni hubo restauración. El entorno actual no dispone de PostgreSQL CLI/Docker; por tanto la restauración aún no tiene evidencia. Los hallazgos actuales de políticas anónimas y usuarios Auth se documentan en `AUDITORIA_AUTENTICACION_20261031.md`. No se modificó Supabase ni Vercel.
