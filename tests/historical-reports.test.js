const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const reportHistory = require('../assets/js/report-history.js');

const servicesFromSchemaSeed = new Set([
  'Consulta médica', 'Inyectable', 'Curación', 'Nebulización', 'Sueroterapia',
  'Anticonceptivos', 'Procedimiento estético', 'Podología', 'Otro procedimiento',
]);
const targets = {
  2024: [6800, 7200, 7600, 8100, 6900, 8450, 7800, 10100, 8200, 7500, 11200, 8400],
  2025: [7200, 7650, 8100, 6900, 8400, 7900, 10450, 8300, 7600, 8500, 11500, 8200],
};

function readDataset(year) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, `../assets/data/report-history-${year}.json`), 'utf8'));
}

for (const year of [2024, 2025]) {
  test(`${year} historical report totals are derived from dated movement rows`, () => {
    const dataset = readDataset(year);
    assert.equal(dataset.year, year);
    assert.equal(dataset.source, `historical_${year}_simulated`);
    assert.match(dataset.label, /simulados/i);
    const movements = reportHistory.hydrateDataset(dataset);
    assert.ok(movements.length >= 12 * 40);
    assert.equal(new Set(movements.map((row) => row.id)).size, movements.length);
    assert.equal(new Set(movements.map((row) => row.patientId)).size, new Set(movements.map((row) => row.patientName)).size);
    assert.ok(movements.every((row) => row.id.startsWith(`hist${String(year).slice(-2)}-`)));
    assert.ok(movements.every((row) => String(row.date).startsWith(`${year}-`)));
    assert.ok(movements.every((row) => servicesFromSchemaSeed.has(row.serviceType)));
    assert.ok(movements.every((row) => ['Finalizada', 'Atendida'].includes(row.status)));
    assert.ok(movements.every((row) => {
      const date = new Date(`${row.date}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === row.date;
    }));
    const monthlyTotals = Array.from({ length: 12 }, (_, index) => movements
      .filter((row) => Number(row.date.slice(5, 7)) === index + 1)
      .reduce((sum, row) => sum + Number(row.servicePrice), 0));
    assert.deepEqual(monthlyTotals, targets[year]);
    assert.equal(monthlyTotals.reduce((sum, value) => sum + value, 0), movements.reduce((sum, row) => sum + row.servicePrice, 0));
  });
}

test('source resolution selects one source and never combines historical rows with production rows', () => {
  const production = [{ id: 'real-2026' }];
  const historical = { 2024: [{ id: 'hist24-0001' }], 2025: [{ id: 'hist25-0001' }] };
  assert.strictEqual(reportHistory.sourceForYear('2024', production, historical), historical[2024]);
  assert.strictEqual(reportHistory.sourceForYear('2025', production, historical), historical[2025]);
  assert.strictEqual(reportHistory.sourceForYear('2026', production, historical), production);
  assert.strictEqual(reportHistory.sourceForYear('', production, historical), production);
  assert.equal(reportHistory.isSimulatedYear('2024'), true);
  assert.equal(reportHistory.isSimulatedYear('2025'), true);
  assert.equal(reportHistory.isSimulatedYear('2026'), false);
});

test('historical service names can be aligned only to the runtime catalog without changing amounts', () => {
  const rows = [{ serviceType: 'Old name', servicePrice: 100 }, { serviceType: 'Current service', servicePrice: 200 }];
  const aligned = reportHistory.alignServiceNames(rows, [{ name: 'Current service' }, { name: 'Another current service' }]);
  assert.ok(aligned.every((row) => ['Current service', 'Another current service'].includes(row.serviceType)));
  assert.equal(aligned.reduce((sum, row) => sum + row.servicePrice, 0), 300);
  assert.equal(rows[0].serviceType, 'Old name');
});

test('historical report filters combine patient, service, responsible, status, month, and year', () => {
  const rows = [
    { patientId: 'hist24-p-1', date: '2024-08-05', serviceType: 'Consulta médica', procedureResponsible: 'Dra. Lucía Rojas', status: 'Finalizada' },
    { patientId: 'hist24-p-1', date: '2024-09-02', serviceType: 'Podología', procedureResponsible: 'Dra. Lucía Rojas', status: 'Atendida' },
    { patientId: 'hist24-p-2', date: '2024-08-11', serviceType: 'Consulta médica', procedureResponsible: 'Dr. Carlos Mendoza', status: 'Finalizada' },
    { patientId: 'hist25-p-1', date: '2025-08-11', serviceType: 'Consulta médica', procedureResponsible: 'Dra. Lucía Rojas', status: 'Finalizada' },
  ];
  const filtered = reportHistory.filterRows(rows, {
    patient: 'hist24-p-1', service: 'Consulta médica', responsible: 'Dra. Lucía Rojas',
    status: 'Finalizada', month: '01-09', year: '2024',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].date, '2024-08-05');
});
