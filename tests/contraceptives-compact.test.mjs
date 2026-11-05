import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const js = await readFile(new URL('../assets/js/contraceptives.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../pages/contraceptives.html', import.meta.url), 'utf8');
const helpers = js.slice(js.indexOf('function latestPatientControl('),js.indexOf('function contraceptiveService()'));
const samples = [
  { id:1, patientId:1, applicationDate:'2026-04-05', nextApplicationDate:'2026-05-05', contraceptiveType:'Mensual' },
  { id:2, patientId:1, applicationDate:'2026-10-05', nextApplicationDate:'2026-11-05', contraceptiveType:'Mensual' },
  { id:3, patientId:2, applicationDate:'2026-10-10', nextApplicationDate:'2026-11-10', contraceptiveType:'Mensual' },
  { id:4, patientId:3, applicationDate:'2026-08-01', nextApplicationDate:'2026-11-01', contraceptiveType:'Trimestral' },
];

function eligible(rows, id, today='2026-11-05') {
  const context = { controls: rows, id, today };
  return runInNewContext(`
    const contraceptiveState = { records: controls };
    const window = { MedSolutionDate: { today: () => today } };
    ${helpers}
    canApplyScheduledDose(controls.find(x=>x.id===id));
  `, context);
}

test('evita aplicar una dosis histórica cuando hay otra más reciente', () => {
  assert.equal(eligible(samples,1),false);
  assert.equal(eligible(samples,2),true);
});
test('habilita dosis para hoy y vencidas; oculta futuras', () => {
  assert.equal(eligible(samples,2),true);
  assert.equal(eligible(samples,3),false);
  assert.equal(eligible(samples,4),true);
});
test('el bloque principal se adapta sin scroll horizontal ni vertical internos', () => {
  assert.match(html,/\.control-table-wrap\{max-height:none;overflow:visible;/);
  assert.match(html,/\.control-table-wrap \.control-table\{width:100%;min-width:0;table-layout:fixed/);
  assert.match(html,/\.control-table-wrap \.control-table tr\{display:grid/);
});
test('precio ya no ocupa una columna principal, pero el historial sigue intacto', () => {
  assert.match(html,/<th>Anticonceptivo<\/th><th>Responsable<\/th><th>Estado<\/th><th>Acciones<\/th>/);
  assert.match(html,/controlHistoryBody|contraceptiveHistoryBody/);
  assert.match(html,/<th>Precio<\/th>/);
});
test('aplicar inicia NUEVO registro y exige confirmación antes de guardarlo', () => {
  assert.match(js,/function openApplyScheduledDose\(record\)/);
  assert.match(js,/const fresh = await window.MedSolutionData.getAttentions\(\)/);
  assert.match(js,/if \(duplicate\) throw new Error/);
  assert.match(js,/if \(!confirm\(/);
  assert.match(js,/pageSize: 6/);
});

test('acciones existentes quedan visibles sin menú de tres puntos', () => {
  for (const action of ['history','edit','delete','apply']) {
    assert.match(js,new RegExp('data-control-action="'+action+'"'));
  }
  assert.doesNotMatch(js,/class="control-actions-menu"/);
  assert.match(js,/class="control-action-icon control-action-icon--danger"/);
  assert.match(js,/aria-label="Eliminar aplicación/);
});
test('estado completo en una sola línea y responsable más discreto', () => {
  assert.match(html,/\.control-status\{[^}]*white-space:nowrap/);
  assert.match(html,/\.control-table-wrap \.control-table td\.control-status-cell\{white-space:nowrap/);
  assert.match(html,/\.control-table-wrap \.control-table td\.control-responsible\{font-size:\.73rem;font-weight:400/);
});
test('acciones reciben más espacio sin agregar columnas ni scroll', () => {
  assert.match(html,/th:nth-child\(4\)\{width:17%\}/);
  assert.match(html,/th:nth-child\(5\)\{width:11%\}/);
  assert.match(html,/th:nth-child\(6\)\{width:11%\}/);
  assert.match(html,/th:nth-child\(7\)\{width:20%\}/);
  assert.match(html,/\.control-row-actions\{[^}]*flex-wrap:nowrap/);
  assert.match(html,/\.control-table-wrap\{max-height:none;overflow:visible;/);
});

test('las siete columnas del listado mantienen encabezados y celdas centrados', () => {
  assert.match(html,/\.control-table-wrap \.control-table th,\s*\.control-table-wrap \.control-table td\s*\{\s*text-align:center;\s*vertical-align:middle;/);
  assert.match(html,/\.control-table-wrap \.control-table td\.control-responsible\s*\{\s*text-align:center;/);
  assert.match(html,/\.control-table-wrap \.control-table td\.control-status-cell \.control-status\s*\{\s*justify-content:center;/);
  assert.match(html,/\.control-table-wrap \.control-table td\.control-actions-cell \.control-row-actions\s*\{\s*justify-content:center;/);
  assert.match(html,/\.control-table-wrap \.control-table td::before\s*\{\s*text-align:center;/);
  assert.match(html,/\.control-table-wrap\{max-height:none;overflow:visible;/);
});
