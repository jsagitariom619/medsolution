# Módulo de Consulta Médica Completa

## Alcance implementado

El módulo se encuentra en `pages/appointments.html` y utiliza `assets/js/appointments.js` y `assets/css/consultation.css`.

Incluye:

- Motivo de consulta y enfermedad actual.
- Evolución clínica vinculada a una historia clínica única por paciente.
- Antecedentes personales, familiares y alérgicos cargados como datos de solo lectura desde la historia clínica.
- Signos vitales y antropometría con cálculo automático de IMC.
- Examen físico por sistemas.
- Diagnósticos múltiples con código CIE-10, condición y prioridad.
- Plan terapéutico, indicaciones, seguimiento y observaciones.
- Medicamentos múltiples con dosis, vía, frecuencia, duración e instrucciones.
- Solicitudes múltiples de laboratorio e imagenología.
- Certificado médico y período de baja o reposo médico.
- Impresión de resumen clínico, receta, órdenes, certificado y baja médica.
- Guardado como borrador o consulta finalizada.
- Integración con historia clínica única y evoluciones cronológicas numeradas.
- Aviso y acceso directo para crear la historia clínica cuando el paciente aún no la tiene.
- Si falta la historia, el sistema ofrece crearla; el profesional también puede continuar y guardar la evolución sin modificar antecedentes.
- Lectura compatible con las consultas básicas creadas en versiones anteriores.

## Flujo de uso

1. Iniciar sesión.
2. Abrir **Consulta médica**.
3. Seleccionar un paciente existente o registrarlo rápidamente.
4. Si el paciente no tiene historia clínica, elegir entre crearla en una pestaña independiente o continuar la evolución.
5. Completar las seis secciones clínicas.
6. Guardar como borrador o finalizar la consulta.
7. Abrir la consulta guardada para imprimir los documentos requeridos.
8. Consultar la evolución en **Historias clínicas**.

## Persistencia

La versión actual es un prototipo frontend y almacena los datos en el navegador:

- `medsolution.patients`
- `medsolution.consultations`
- `medsolution.medicalRecords`

Cada consulta nueva utiliza `recordVersion: 3` y un `evolutionNumber` consecutivo por paciente y conserva:

- Identificador del paciente.
- Fecha, hora, estado y profesional responsable.
- Evolución actual, signos vitales y examen físico.
- Los antecedentes permanentes permanecen en `medsolution.medicalRecords` y no se duplican en cada consulta.
- Arreglos de diagnósticos, medicamentos y órdenes.
- Datos para documentos clínicos.
- Fechas de creación y actualización.

## Compatibilidad con datos anteriores

`normalizeConsultation()` transforma en memoria los registros antiguos:

- `diagnosis` se convierte en una lista de diagnósticos.
- `treatment` pasa a `therapeuticPlan`.
- `physicalExam` pasa a `examGeneral`.
- La ausencia de estado se interpreta como consulta finalizada.

Antes de normalizar las consultas, la capa compartida migra los antecedentes antiguos a `medsolution.medicalRecords`. La operación es idempotente: una segunda carga no crea otra historia para el mismo paciente. Después, las consultas se guardan con numeración de evolución y sin duplicar antecedentes permanentes.

## Permisos

- Administrador y Médico: pueden completar, finalizar, editar, eliminar e imprimir consultas.
- Auxiliar y Enfermería: pueden registrar datos iniciales y guardar borradores; las secciones clínicas de diagnóstico, examen y plan quedan en modo lectura.
- La historia clínica completa está disponible para Administrador y Médico.

## Documentos imprimibles

Los documentos se generan en una ventana independiente y utilizan la función de impresión del navegador. Desde allí pueden:

- Imprimirse físicamente.
- Guardarse como PDF.

La receta requiere al menos un medicamento. Las órdenes requieren solicitudes registradas. La baja médica requiere período o motivo.

## Consideraciones para producción

Esta versión no debe utilizarse todavía como repositorio definitivo de información clínica real. Antes de producción se requiere:

- Backend y base de datos centralizada.
- Autenticación robusta y sesiones seguras.
- Cifrado en tránsito y en reposo.
- Auditoría de accesos y modificaciones.
- Copias de seguridad.
- Control de permisos en servidor.
- Catálogo oficial y actualizado de CIE-10.
- Firma digital y numeración formal de documentos.
- Cumplimiento de la normativa sanitaria y de protección de datos aplicable.

## Pruebas realizadas

- Validación de sintaxis JavaScript.
- Verificación de identificadores HTML y referencias del DOM.
- Detección de identificadores duplicados.
- Prueba de migración de consultas antiguas.
- Prueba de validación de consulta finalizada.
- Prueba de formato CIE-10, presión arterial y fechas de baja médica.
