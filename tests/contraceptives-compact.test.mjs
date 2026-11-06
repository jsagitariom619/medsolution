import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const js = await readFile(new URL('../assets/js/contraceptives.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../pages/contraceptives.html', import.meta.url), 'utf8');
const helpers = js.slice(js.indexOf('function newerContraceptiveRecord('),js.indexOf('function contraceptiveService()'));
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

test('solo el control vigente más reciente permite Aplicar el día programado', () => {
  assert.equal(eligible(samples,1),false);
  assert.equal(eligible(samples,2),true);
});
test('Aplicar solo está disponible el día indicado: nunca para vencidas o futuras', () => {
  assert.equal(eligible(samples,2),true);
  assert.equal(eligible(samples,3),false);
  assert.equal(eligible(samples,4),false);
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
  for (const action of ['history','edit','delete','apply','new-after-expiry']) {
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

test('un control vencido ofrece Nueva aplicación, sin habilitar Aplicar',()=>{
  const context={controls:samples,today:'2026-11-05'};
  const evaluate=runInNewContext(`
    const contraceptiveState={records:controls};
    const window={MedSolutionDate:{today:()=>today}};
    ${helpers}
    [canApplyScheduledDose(controls[3]),canStartNewApplicationAfterExpiry(controls[3]),
     canStartNewApplicationAfterExpiry(controls[0]),canStartNewApplicationAfterExpiry(controls[2])]
  `,context);
  assert.deepEqual(Array.from(evaluate),[false,true,false,false]);
  assert.match(js,/data-control-action="new-after-expiry"/);
  assert.match(js,/function openNewApplicationAfterExpiry\(record\)/);
});
test('crear nuevo registro no modifica la aplicación vencida y exige confirmación',()=>{
  assert.match(js,/contraceptiveState\.renewingExpiredId = record\.remoteId \|\| record\.id/);
  assert.match(js,/form\.elements\.applicationDate\.value = window\.MedSolutionDate\.today\(\)/);
  assert.match(js,/form\.elements\.contraceptiveType\.value = ''/);
  assert.match(js,/form\.elements\.medication\.value = ''/);
  assert.match(js,/if \(contraceptiveState\.renewingExpiredId !== null\)/);
  assert.match(js,/canStartNewApplicationAfterExpiry\(source, controls\)/);
  assert.match(js,/Se guardará una nueva aplicación sin modificar la vencida/);
  assert.match(html,/control-new-btn/);
});

test('en tablets, las siete columnas permanecen alineadas como en computadora', () => {
  assert.match(html, /@media \(min-width:620px\) and \(max-width:900px\)/);
  assert.match(html, /\.control-table-wrap \.control-table\{width:100%;min-width:0;table-layout:fixed;font-size:\.69rem\}/);
  assert.match(html, /\.control-table-wrap \.control-table th:nth-child\(7\)\{width:27%\}/);
  assert.match(html, /\.control-table-wrap\{max-height:none;overflow:visible;border:1px solid var\(--gray-200\)/);
  assert.match(html, /@media\(max-width:619px\)\{\s*\.control-toolbar/);
  assert.match(html, /\.control-table-wrap \.control-table tr\{display:grid/);
  assert.match(html, /\.control-table-wrap \.control-table th,\s*\.control-table-wrap \.control-table td\s*\{\s*text-align:center;/);
});

test('registro anterior se muestra Histórico y nunca habilita Nueva aplicación',()=>{
  const context={today:'2026-11-06',controls:[
    {id:20,patientId:3,applicationDate:'2026-09-22',nextApplicationDate:'2026-10-22',contraceptiveType:'Mensual'},
    {id:21,patientId:3,applicationDate:'2026-10-22',nextApplicationDate:'2026-11-22',contraceptiveType:'Mensual'},
    {id:22,patientId:4,applicationDate:'2026-09-30',nextApplicationDate:'2026-10-30',contraceptiveType:'Mensual'}
  ]};
  const actual=runInNewContext(`
    const contraceptiveState={records:controls};
    const window={MedSolutionDate:{today:()=>today}};
    ${helpers}
    [isHistoricalContraceptiveControl(controls[0]),
     canStartNewApplicationAfterExpiry(controls[0]),
     isHistoricalContraceptiveControl(controls[1]),
     canStartNewApplicationAfterExpiry(controls[2])]
  `,context);
  assert.deepEqual(Array.from(actual),[true,false,false,true]);
  assert.match(js,/Histórico:'control-status--historical'/);
  assert.match(html,/\.control-status--historical\{background:#edf1f5;color:#526679\}/);
});
test('última aplicación vencida sin tipo antiguo válido también permite abrir Nueva aplicación',()=>{
  const context={today:'2026-11-06',controls:[{id:32,patientId:5,applicationDate:'2026-09-05',nextApplicationDate:'2026-10-05',contraceptiveType:''}]};
  assert.equal(runInNewContext(`
    const contraceptiveState={records:controls};
    const window={MedSolutionDate:{today:()=>today}};
    ${helpers}
    canStartNewApplicationAfterExpiry(controls[0])
  `,context),true);
  assert.match(js,/form\.elements\.contraceptiveType\.value = ''/);
  assert.match(js,/form\.elements\.medication\.value = ''/);
});
