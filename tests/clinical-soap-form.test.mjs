import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const js = await readFile(new URL('../assets/js/appointments.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../pages/appointments.html', import.meta.url), 'utf8');
const helper = js.slice(js.indexOf('function composeSoapSections('), js.indexOf('\nfunction fillConsultForm('));
const converter = js.slice(js.indexOf('function consultationData(form)'), js.indexOf('\nasync function handleConsultSave(', js.indexOf('function consultationData(form)')));

function mapAttention(existing, fields, editing = true) {
  const globals = {
    existing, fields,
    consultState: { editingId: editing ? existing?.id ?? null : null, consultations: existing ? [existing] : [], services: [] },
    selectedPatientId: () => 2,
    selectedPatientName: () => 'Ana Pérez',
    getAuthUser: () => ({name:'Médico de prueba',role:'Médico'}),
  };
  const script = helper + '\n' + converter + '\nconsultationData({elements: Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{value:v}]))})';
  return runInNewContext(script, globals);
}

test('el SOAP presenta los cuatro espacios y conserva signos vitales y datos informativos', () => {
  for (const s of ['S · Motivo de consulta', 'O · Examen físico', 'A · Diagnóstico', 'P · Tratamiento e indicaciones']) {
    assert.ok(html.includes(s), s);
  }
  for (const name of ['bp','hr','temp','weight','height','spo2','clinicalAntecedents','nextControl']) {
    assert.ok(html.includes('name="'+name+'"'), name);
  }
  assert.ok(html.includes('Más datos clínicos (opcionales)'));
});

test('la atención clínica deja de exigir rellenar todos los campos SOAP', () => {
  assert.doesNotMatch(js, /const requiredClinical=/);
  assert.match(js, /if \(!clinical && !data\.procedureResponsible\)/);
  assert.match(js, /medsolution\.consultations/);
});

test('una edición sin cambios no altera los valores históricos separados', () => {
  const old={id:1,patientId:2,serviceId:11,serviceType:'Consulta',chiefComplaint:'Dolor abdominal',evolution:'Dos días',treatment:'Hidratación',indications:'Control'};
  const fields={serviceType:'11',date:'2026-11-02',chiefComplaint:'Dolor abdominal\n\nEnfermedad actual: Dos días',treatment:'Hidratación\n\nIndicaciones: Control'};
  const saved=mapAttention(old,fields);
  assert.equal(saved.chiefComplaint,old.chiefComplaint);
  assert.equal(saved.evolution,old.evolution);
  assert.equal(saved.treatment,old.treatment);
  assert.equal(saved.indications,old.indications);
});

test('una nueva redacción del plan integra indicaciones anteriores sin borrarlas', () => {
  const old={id:1,patientId:2,serviceId:11,serviceType:'Consulta',chiefComplaint:'Motivo',treatment:'Plan anterior',indications:'Vigilar'};
  const fields={serviceType:'11',date:'2026-11-02',chiefComplaint:'Motivo',treatment:'Plan anterior\n\nIndicaciones: Vigilar\n\nNuevo control'};
  const saved=mapAttention(old,fields);
  assert.match(saved.treatment,/Vigilar/);
  assert.match(saved.treatment,/Nuevo control/);
  assert.equal(saved.indications,'');
});

test('una nueva consulta puede guardar apartados SOAP vacíos', () => {
  const fields={serviceType:'11',date:'2026-11-02',chiefComplaint:'',physicalExam:'',diagnosis:'',treatment:''};
  const saved=mapAttention(null,fields,false);
  assert.equal(saved.chiefComplaint,'');
  assert.equal(saved.physicalExam,'');
  assert.equal(saved.diagnosis,'');
  assert.equal(saved.treatment,'');
  assert.equal(saved.indications,'');
  assert.equal(saved.evolution,'');
});
