import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const dashboard = await readFile(new URL('../assets/js/dashboard.js', import.meta.url),'utf8');
const contraceptives = await readFile(new URL('../assets/js/contraceptives.js', import.meta.url),'utf8');
const helpers = dashboard.slice(dashboard.indexOf('function dashboardContraceptiveReminders('),dashboard.indexOf('\nfunction renderDashboardChart('));
function alerts(data, today='2026-11-05') {
  return runInNewContext(helpers+'\ndashboardContraceptiveReminders(data, today)',{data,today});
}
const base = [
  {id:11,patientId:1,patientName:'Paciente A',applicationDate:'2026-10-08',nextApplicationDate:'2026-11-08',contraceptiveControl:true},
  {id:12,patientId:2,patientName:'Paciente B',applicationDate:'2026-10-06',nextApplicationDate:'2026-11-06',contraceptiveControl:true},
  {id:13,patientId:3,patientName:'Paciente C',applicationDate:'2026-10-05',nextApplicationDate:'2026-11-05',contraceptiveControl:true},
  {id:14,patientId:4,patientName:'Paciente D',applicationDate:'2026-09-04',nextApplicationDate:'2026-10-04',contraceptiveControl:true},
  {id:15,patientId:5,patientName:'Paciente E',applicationDate:'2026-10-09',nextApplicationDate:'2026-11-09',contraceptiveControl:true},
];
test('avisos tres días antes, un día antes, el día indicado y vencidos',()=>{
  const result=alerts(base);
  assert.deepEqual(Array.from(result,item=>item.id),[14,13,12,11]);
  assert.deepEqual(Array.from(result,item=>item.daysUntil),[-32,0,1,3]);
});
test('no notifica aplicaciones futuras con más de tres días de anticipación',()=>{
  assert.ok(!Array.from(alerts(base),a=>a.id).includes(15));
});
test('omite la dosis antigua si existe aplicación nueva del mismo paciente',()=>{
  const later={id:16,patientId:4,patientName:'Paciente D',applicationDate:'2026-11-02',nextApplicationDate:'2026-12-02',contraceptiveControl:true};
  assert.ok(!Array.from(alerts([...base,later]),a=>a.id).includes(14));
});
test('no notifica programaciones auxiliares ni fechas inválidas',()=>{
  const invalid={id:17,patientId:6,applicationDate:'2026-10-01',nextApplicationDate:'2026-13-05',contraceptiveControl:true};
  const schedule={id:18,patientId:7,nextApplicationDate:'2026-11-05',contraceptiveSchedule:true};
  assert.equal(alerts([invalid,schedule]).length,0);
});
test('vínculos a pacientes exactos, no mensajes de salida ni marcación automática',()=>{
  assert.match(dashboard,/contraceptives\.html\?controlId=\$\{encodeURIComponent\(reminder\.id\)\}/);
  assert.match(contraceptives,/data-control-id="\$\{record\.id\}"/);
  assert.match(contraceptives,/function focusNotifiedContraceptive\(/);
  assert.match(dashboard,/document\.addEventListener\('visibilitychange'/);
  assert.ok(dashboard.indexOf('contraceptiveReminders.forEach')<dashboard.indexOf('if(pending.length===1)'));
});
