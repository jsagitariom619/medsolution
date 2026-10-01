const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('../assets/js/patient-movements.js');

const movements = global.window.MedSolutionPatientMovements;

test('projects real attention snapshots and excludes schedule placeholders and duplicate ids', () => {
  const rows = movements.buildRows([
    { remoteId: 'a1', patientId: 1, patientName: 'Ana Ruiz', date: '2026-09-01', serviceType: 'Consulta', servicePrice: 100.25, procedureResponsible: 'Dra. A', status: 'Finalizada' },
    { remoteId: 'a1', patientId: 1, patientName: 'Ana Ruiz', date: '2026-09-01', serviceType: 'Consulta', servicePrice: 100.25, procedureResponsible: 'Dra. A', status: 'Finalizada' },
    { remoteId: 'a2', patientId: 2, patientName: 'Eva Sol', date: '2026-09-02', serviceType: 'Anticonceptivos', servicePrice: 200, procedureResponsible: 'Dra. B', status: 'Finalizada', contraceptiveControl: true },
    { remoteId: 'a3', patientId: 1, patientName: 'Ana Ruiz', date: '2026-09-03', serviceType: 'Consulta', servicePrice: 40, procedureResponsible: 'Dra. A', status: 'Pendiente' },
    { remoteId: 'a4', patientId: 3, patientName: 'Luz Paz', date: '2026-09-04', serviceType: 'Consulta', servicePrice: 120, procedureResponsible: 'Dra. A', status: 'Cancelada' },
    { remoteId: 'schedule-1', patientId: 1, scheduledOnly: true, serviceType: 'Próxima aplicación', servicePrice: 0, status: 'Pendiente' },
    { remoteId: 'schedule-2', patientId: 1, contraceptiveSchedule: true, serviceType: 'Próxima aplicación', servicePrice: 0, status: 'Pendiente' },
  ]);

  assert.equal(rows.length, 4);
  assert.equal(rows.some((row) => row.id === 'schedule-1' || row.id === 'schedule-2'), false);
  assert.deepEqual(movements.summarize(rows), {
    movements: 4,
    patients: 2,
    completedServices: 2,
    totalCents: 30025,
  });
  assert.equal(movements.formatMoney(30025), '300,25 Bs');
});

test('applies inclusive dates and combined patient, service, responsible, and status filters', () => {
  const rows = movements.buildRows([
    { id: 1, patientId: 9, date: '2026-09-01', serviceType: 'Consulta', servicePrice: 25, procedureResponsible: 'Dr. Uno', status: 'Finalizada' },
    { id: 2, patientId: 9, date: '2026-09-30', serviceType: 'Consulta', servicePrice: 25, procedureResponsible: 'Dr. Uno', status: 'Finalizada' },
    { id: 3, patientId: 9, date: '2026-10-01', serviceType: 'Consulta', servicePrice: 25, procedureResponsible: 'Dr. Uno', status: 'Finalizada' },
    { id: 4, patientId: 9, date: '2026-09-15', serviceType: 'Curación', servicePrice: 15, procedureResponsible: 'Dra. Dos', status: 'Finalizada' },
  ]);
  const result = movements.filterRows(rows, {
    from: '2026-09-01', to: '2026-09-30', patientId: '9',
    service: 'Consulta', responsible: 'Dr. Uno', status: 'Finalizada',
  });

  assert.deepEqual(result.map((row) => row.id), ['1', '2']);
  assert.equal(movements.summarize(result).totalCents, 5000);
});

test('canceled appointments remain visible but are excluded from economic totals', () => {
  const rows = movements.buildRows([
    { id: 1, patientId: 1, servicePrice: 99.99, status: 'Cancelada' },
    { id: 2, patientId: 2, servicePrice: 15, status: 'En consulta' },
  ]);

  assert.deepEqual(movements.summarize(rows), {
    movements: 2,
    patients: 0,
    completedServices: 0,
    totalCents: 0,
  });
});
