import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../pages/medical-records.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../assets/js/medical-records.js', import.meta.url), 'utf8');

test('la historia ofrece archivo y fotografía para cada consulta', () => {
  assert.match(js, /data-attach-files/);
  assert.match(js, /data-take-photo/);
  assert.match(js, /Documentos y estudios/);
  assert.match(html, /id="clinicalAttachmentInput"/);
  assert.match(html, /id="clinicalCameraModal"/);
});
test('la foto usa cámara solo a petición y requiere confirmación', () => {
  assert.match(js, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(html, /id="clinicalCameraCapture"/);
  assert.match(html, /id="clinicalCameraPreview"/);
  assert.match(html, /id="clinicalCameraSave"/);
  assert.match(js, /await uploadClinicalFiles\(\[clinicalCameraState\.file\]\)/);
  assert.match(js, /data-take-photo/);
  assert.match(js, /clinicalCameraState\.stream\?\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
});
test('admite captura nativa como alternativa y mantiene asociación a la consulta', () => {
  assert.match(html, /capture="environment"/);
  assert.match(js, /recordsState\.attachmentConsultationId = Number\(consultationId\)/);
  assert.match(js, /if \(!consultation\?\.remoteId\)/);
  assert.match(js, /uploadClinicalAttachment\(consultation\.remoteId, file\)/);
  assert.match(js, /data-record-tab="clinical"/);
});
test('el formulario sigue aceptando documentos clínicos previamente admitidos', () => {
  for (const type of ['image/*','application/pdf','.dcm','.dicom','.doc','.docx','.xls','.xlsx']) {
    assert.ok(html.includes(type));
  }
  assert.match(js, /await window\.MedSolutionData\.saveAttention\(\{ \.\.\.consultation, attachments \}\)/);
});
