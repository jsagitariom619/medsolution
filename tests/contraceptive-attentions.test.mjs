import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const base=new URL('../',import.meta.url);
const contraception=await readFile(new URL('assets/js/contraceptives.js',base),'utf8');
const attentions=await readFile(new URL('assets/js/appointments.js',base),'utf8');
const dataClient=await readFile(new URL('assets/js/supabase-client.js',base),'utf8');

const summary=contraception.slice(
  contraception.indexOf('function newerContraceptiveRecord('),
  contraception.indexOf('function contraceptiveService()')
);
const sample=[
  {id:1,patientId:10,patientName:'Paciente A',applicationDate:'2026-11-04',nextApplicationDate:'2027-02-04',contraceptiveControl:true,contraceptiveType:'Trimestral',serviceType:'Anticonceptivos',date:'2026-11-04',time:'12:00',status:'Finalizada'},
  {id:2,patientId:10,patientName:'Paciente A',applicationDate:'2027-02-04',nextApplicationDate:'2027-05-04',contraceptiveControl:true,contraceptiveType:'Trimestral',serviceType:'Anticonceptivos',date:'2027-02-04',time:'12:00',status:'Finalizada'},
  {id:3,patientId:11,patientName:'Paciente B',applicationDate:'2026-11-05',nextApplicationDate:'2026-12-05',contraceptiveControl:true,contraceptiveType:'Mensual',serviceType:'Anticonceptivos',date:'2026-11-05',time:'12:00',status:'Finalizada'},
];
function unique(rows){
  return runInNewContext('const contraceptiveState={records:items};'+summary+'\nactivePatientControls()', {items:rows});
}
test('una fila por paciente; la última y próxima aplicación siguen a la dosis más reciente',()=>{
  const rows=unique(sample);
  assert.equal(rows.length,2);
  const patient=Array.from(rows).find(row=>row.patientId===10);
  assert.equal(patient.applicationDate,'2027-02-04');
  assert.equal(patient.nextApplicationDate,'2027-05-04');
  assert.equal(sample.length,3);
});
test('no fusiona pacientes distintos por coincidencia de nombre',()=>{
  const rows=unique([{id:5,patientId:11,patientName:'Igual',applicationDate:'2026-10-01'},
    {id:6,patientId:12,patientName:'Igual',applicationDate:'2026-11-01'}]);
  assert.equal(rows.length,2);
});
test('Atenciones muestra administraciones reales, pero no futuras dosis de Agenda',()=>{
  const fn=attentions.slice(attentions.indexOf('function visibleConsultations('), attentions.indexOf('function updateAttentionViewContext('));
  const all=[...sample,{id:4,patientId:10,contraceptiveSchedule:true,scheduledOnly:true,date:'2027-05-04'}];
  const result=runInNewContext('const consultState={consultations:rows,todayOnly:false,monthFilters:{service:"",responsible:"",month:"",year:""}};'+
    'const boliviaNowParts=()=>({date:"2027-02-04"});const specializedActivityRows=()=>[];'+fn+'\nvisibleConsultations()',{rows:all});
  assert.deepEqual(Array.from(result.map(row=>row.id)),[2,3,1]);
  assert.ok(attentions.includes('if (c.contraceptiveControl === true)'));
  assert.ok(attentions.includes('Aplicación anticonceptiva'));
  assert.ok(attentions.includes('contraceptives.html?controlId='));
});
test('Atenciones ofrece comprobante del inyectable y conserva la impresión general',()=>{
  assert.match(attentions,/if \(attention\.contraceptiveControl === true\)/);
  assert.match(attentions,/Próxima aplicación:/);
  assert.match(attentions,/Medicamento:/);
  assert.match(attentions,/Responsable:/);
});
test('la carga de Atenciones no omite registros por el límite de 1000 filas',()=>{
  assert.match(dataClient,/const data = await fetchAllPages\(\(\) => connection\.from\('atenciones'\)/);
  assert.match(dataClient,/\.order\('fecha_hora', \{ ascending: false \}\)/);
  assert.match(dataClient,/\.order\('id', \{ ascending: false \}\)/);
});
test('ni el registro ni la historia previa se reescriben al actualizar la ficha visible',()=>{
  assert.match(contraception,/return activePatientControls\(\)/);
  assert.match(contraception,/const patientRecords = contraceptiveState\.records/);
  assert.match(contraception,/const saved = await window\.MedSolutionData\.saveAttention\(record\)/);
  assert.match(contraception,/if \(!previous\) \{/);
});
