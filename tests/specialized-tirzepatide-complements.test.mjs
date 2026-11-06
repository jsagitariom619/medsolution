import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/js/specialized-records.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('  const MAX_COMPLEMENTARY_ROWS=10;'),source.indexOf('  function ensureModals()'));
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const {getComplementaryData,complementarySummary,complementaryFieldsMarkup,complementaryRowMarkup}=
  new Function('esc',helpers+'return {getComplementaryData,complementarySummary,complementaryFieldsMarkup,complementaryRowMarkup};')(esc);
const row=fields=>({querySelector:selector=>{const key=selector.match(/data-complement-field="([^"]+)"/)?.[1];return key&&key in fields?{value:fields[key]}:null;}});
const form=(medicines,procedures)=>({querySelectorAll:selector=>selector.includes('"medicine"')?medicines.map(row):selector.includes('"procedure"')?procedures.map(row):[]});

test('sin medicamentos o tratamientos adicionales se guardan listas vacías',()=>{
  assert.deepEqual(getComplementaryData(form([],[])),{medicamentosAdicionales:[],tratamientosAdicionales:[]});
});
test('permite múltiples registros complementarios sin exigir dosis o frecuencia',()=>{
  const data=getComplementaryData(form(
    [{nombre:'Med A',dosisVia:'vía oral',frecuencia:'cada 24 h'},{nombre:'Med B',dosisVia:'',frecuencia:''},{nombre:'',dosisVia:'',frecuencia:''}],
    [{nombre:'Procedimiento',detalles:'Documentación clínica'}]
  ));
  assert.equal(data.medicamentosAdicionales.length,2);
  assert.equal(data.tratamientosAdicionales.length,1);
  assert.equal(data.medicamentosAdicionales[1].dosisVia,'');
});
test('una fila incompleta con detalles sin nombre no se registra',()=>{
  assert.throws(()=>getComplementaryData(form([{nombre:'',dosisVia:'5 mg'}],[])),/nombre/);
  assert.throws(()=>getComplementaryData(form([],[{nombre:'',detalles:'Realizado'}])),/nombre/);
});
test('evoluciones antiguas se presentan sin secciones adicionales',()=>{
  assert.equal(complementarySummary({data:{evolucionClinica:'Seguimiento'}}),'');
});
test('se ven complementos sin permitir HTML inyectado',()=>{
  const html=complementarySummary({data:{
    medicamentosAdicionales:[{nombre:'<img src=x onerror=alert(1)>',dosisVia:'oral'}],
    tratamientosAdicionales:[{nombre:'Otro tratamiento',detalles:'Detalles'}]
  }});
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Otro tratamiento'));
});
test('secciones desplegables, controles para agregar y quitar, solo en tirzepatida',()=>{
  assert.ok(complementaryFieldsMarkup().includes('<details'));
  assert.ok(complementaryRowMarkup('medicine').includes('data-remove-complement'));
  assert.match(source,/state.activeHistory.templateType==='tirzepatida'\?complementaryFieldsMarkup\(\):''/);
  assert.match(source,/Object.assign\(details,additions\)/);
  assert.match(source,/MAX_COMPLEMENTARY_ROWS=10/);
  assert.match(source,/history.templateType==='tirzepatida'\?complementarySummary\(item\):''/);
});
