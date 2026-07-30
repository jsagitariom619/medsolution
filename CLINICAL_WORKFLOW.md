# Flujo clínico unificado de MedSolution

## Objetivo

Separar la información permanente del paciente de las atenciones sucesivas sin cambiar el diseño general ni eliminar módulos existentes.

## Modelo de datos

### Pacientes

Clave local: `medsolution.patients`

El paciente es la entidad central. Puede ser creado desde Pacientes, el registro rápido de Consulta Médica o Enfermería.

### Historia clínica única

Clave local: `medsolution.medicalRecords`

Existe como máximo un registro por `patientId`. Contiene antecedentes y datos clínicos permanentes:

- Grupo sanguíneo.
- Antecedentes personales, quirúrgicos, familiares y alérgicos.
- Medicamentos habituales.
- Hábitos.
- Antecedentes gineco-obstétricos.
- Inmunizaciones.
- Observaciones generales.
- Metadatos de creación y última edición.

La creación y la edición usan la misma operación de persistencia. Si el paciente ya tiene historia, se actualiza el registro existente; nunca se agrega un segundo registro para el mismo paciente.

### Evoluciones médicas

Clave local: `medsolution.consultations`

Cada consulta nueva crea una evolución independiente con:

- `patientId` y nombre del paciente.
- `evolutionNumber` consecutivo por paciente.
- Fecha, hora, profesional y estado.
- Motivo, enfermedad actual, examen, diagnósticos, tratamiento, órdenes y documentos.

Los antecedentes permanentes ya no se guardan repetidamente en cada consulta. Se cargan desde la historia clínica y se muestran como solo lectura.

### Procedimientos de enfermería

Clave local: `medsolution.nursingRecords`

Cada procedimiento guarda `patientId`, paciente, fecha, responsable y datos específicos del tipo de atención. No requiere que exista historia clínica.

Cuando Enfermería escribe un paciente que aún no existe, se crea un registro básico de paciente sin historia clínica. Posteriormente puede completarse desde Pacientes y crear su historia desde Historias Clínicas.

## Reglas de flujo

1. Enfermería puede registrar un procedimiento con o sin historia clínica.
2. Consulta Médica detecta si existe historia clínica.
3. Si no existe, muestra la acción **Crear historia clínica**.
4. La evolución puede guardarse o finalizarse sin historia clínica si el usuario decide continuar.
5. Cuando falta la historia, Consulta Médica ofrece crearla en una pestaña independiente para no perder la evolución en curso.
6. Una vez creada, la historia solo ofrece la acción **Editar historia clínica**.
7. Cada nueva consulta incrementa el número de evolución del paciente.
8. El paciente de una evolución existente queda bloqueado durante la edición para conservar la vinculación.
9. Historia, evoluciones y procedimientos se agregan en una sola línea cronológica por paciente.
10. La persistencia se accede mediante `clinical-storage.js`, preparado para sustituirse por un adaptador Supabase.

## Compatibilidad

Al cargar los módulos, `clinical-data.js` revisa consultas antiguas. Cuando encuentra antecedentes guardados en la primera consulta de un paciente y todavía no existe historia clínica, crea una historia única con esos datos. La migración es idempotente y no genera duplicados.

## Archivos modificados

- `assets/js/clinical-data.js`
- `assets/js/appointments.js`
- `assets/js/medical-records.js`
- `assets/js/nursing.js`
- `assets/css/consultation.css`
- `assets/css/nursing.css`
- `pages/appointments.html`
- `pages/medical-records.html`
- `pages/nursing.html`
