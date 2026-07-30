// MedSolution — Historia clínica única por patientId.
const CONSULT_KEY = 'medsolution.consultations';
const PATIENTS_KEY = 'medsolution.patients';
const RECORDS_KEY = 'medsolution.medicalRecords';

const recordsState = { patients: [], consultations: [], records: [], selectedPatientId: null, searchTerm: '' };

function readArray(key) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
async function loadData() {
  recordsState.patients = window.MedSolutionData?.isConfigured()
    ? await window.MedSolutionData.getPatients()
    : readArray(PATIENTS_KEY);
  recordsState.consultations = window.MedSolutionData?.isConfigured()
    ? await window.MedSolutionData.getAttentions()
    : readArray(CONSULT_KEY);
  recordsState.records = readArray(RECORDS_KEY);
}
function escapeHtml(value) {
  const div = document.createElement('div'); div.textContent = value == null ? '' : String(value); return div.innerHTML;
}
function getInitials(name) { return (name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase(); }
function formatDate(date) { if (!date) return '—'; const [y,m,d] = date.split('-'); return `${d}/${m}/${y}`; }
function consultationsFor(patientId) {
  return recordsState.consultations.filter((c) => Number(c.patientId) === Number(patientId))
    .sort((a,b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`));
}
async function ensureRecord(patientId) {
  let record = recordsState.records.find((r) => Number(r.patientId) === Number(patientId));
  if (!record) {
    const ids = recordsState.records.map((r) => Number(r.id)).filter(Number.isFinite);
    record = { id: ids.length ? Math.max(...ids) + 1 : 1, patientId: Number(patientId), createdAt: new Date().toISOString() };
    recordsState.records.push(record);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsState.records));
  }
  if (window.MedSolutionData?.isConfigured()) await window.MedSolutionData.ensureMedicalRecord(patientId);
  return record;
}

function renderPatientList() {
  const list = document.getElementById('recordsPatientList');
  const q = recordsState.searchTerm.toLowerCase();
  const patients = recordsState.patients.filter((p) => !q || `${p.nombre} ${p.apellido} ${p.ci}`.toLowerCase().includes(q));
  if (!patients.length) { list.innerHTML = '<p style="color:var(--gray-500);padding:16px 0">No se encontraron pacientes.</p>'; return; }
  list.innerHTML = patients.map((p) => {
    const name = `${p.nombre} ${p.apellido}`;
    return `<button type="button" class="records-patient-item ${recordsState.selectedPatientId === p.id ? 'records-patient-item--active' : ''}" data-patient-id="${p.id}">
      <span class="patient-photo">${getInitials(name)}</span><div style="flex:1;min-width:0;text-align:left">
      <strong style="display:block;font-size:.93rem;color:var(--gray-700)">${escapeHtml(name)}</strong>
      <small style="color:var(--gray-500)">CI: ${escapeHtml(p.ci)} · ${consultationsFor(p.id).length} consulta(s)</small></div><span style="color:var(--aqua);font-weight:800">›</span></button>`;
  }).join('');
}

function entryHtml(c) {
  return `<div class="record-entry record-entry--collapsed" data-entry-id="${c.id}">
    <div class="record-entry__header"><span class="record-entry__date">📅 ${formatDate(c.date)}${c.time ? ` — ${escapeHtml(c.time)}` : ''}</span>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button type="button" class="record-entry__toggle" data-toggle-entry="${c.id}"><span class="record-entry__toggle-icon"></span> ${escapeHtml((c.chiefComplaint || 'Ver detalle').slice(0,42))}</button>
      <a class="btn btn--secondary" style="padding:8px 12px;font-size:.8rem" href="appointments.html?consultationId=${c.id}">Editar</a>
      ${c.prescription ? `<button class="btn btn--secondary" style="padding:8px 12px;font-size:.8rem" data-print-prescription="${c.id}">Imprimir receta</button>` : ''}
    </div></div>
    <div class="record-entry__grid">
      ${field('Servicio realizado', c.serviceType || 'Servicio anterior', true)}
      ${field('Responsable', c.procedureResponsible, true)}
      ${field('Motivo', c.chiefComplaint, true)}
      ${field('Evolución', c.evolution, true)}
      ${(c.bp || c.hr || c.temp || c.weight || c.height || c.spo2) ? `<div class="record-field record-field--vitals"><span>Signos vitales</span><div class="vitals-chips">
        ${c.bp ? `<span class="vital-chip">PA: ${escapeHtml(c.bp)} mmHg</span>` : ''}${c.hr ? `<span class="vital-chip">FC: ${escapeHtml(c.hr)} lpm</span>` : ''}
        ${c.temp ? `<span class="vital-chip">T°: ${escapeHtml(c.temp)} °C</span>` : ''}${c.weight ? `<span class="vital-chip">Peso: ${escapeHtml(c.weight)} kg</span>` : ''}
        ${c.height ? `<span class="vital-chip">Talla: ${escapeHtml(c.height)} cm</span>` : ''}${c.spo2 ? `<span class="vital-chip">SpO₂: ${escapeHtml(c.spo2)}%</span>` : ''}</div></div>` : ''}
      ${field('Examen físico', c.physicalExam, true)}${field('Diagnóstico', c.diagnosis, true, true)}
      ${field('Tratamiento', c.treatment, true)}${field('Receta', c.prescription, true)}
      ${field('Indicaciones', c.indications, true)}${field('Próximo control', formatDate(c.nextControl), false)}
      ${field('Observaciones', c.observations, true)}
    </div></div>`;
}
function field(label, value, full = false, highlight = false) {
  if (!value || value === '—') return '';
  return `<div class="record-field ${full ? 'record-field--full' : ''} ${highlight ? 'record-field--highlight' : ''}"><span>${label}</span><p>${escapeHtml(value)}</p></div>`;
}

async function renderPatientRecord(patientId) {
  const panel = document.getElementById('recordsDetailPanel');
  const patient = recordsState.patients.find((p) => Number(p.id) === Number(patientId));
  if (!patient) return;
  await ensureRecord(patient.id);
  const name = `${patient.nombre} ${patient.apellido}`;
  const consultations = consultationsFor(patient.id);
  panel.innerHTML = `<div class="record-patient-header"><span class="patient-photo" style="width:52px;height:52px;font-size:1.1rem">${getInitials(name)}</span>
    <div><h2 style="margin:0;color:var(--petroleum-dark)">${escapeHtml(name)}</h2>
    <p style="margin:4px 0 0;color:var(--gray-500);font-size:.88rem">CI: ${escapeHtml(patient.ci)} · ${escapeHtml(patient.genero || '—')} · Nac: ${formatDate(patient.fechaNacimiento)} · Tel: ${escapeHtml(patient.telefono || '—')}</p></div>
    <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn--secondary" type="button" data-edit-patient="${patient.id}">Editar datos</button>
      <button class="btn btn--secondary" type="button" data-print-record="${patient.id}">Imprimir historia</button>
      <a class="btn btn--primary" href="appointments.html?action=new&patientId=${patient.id}">+ Nueva atención</a>
    </div></div>
    <div class="record-entries"><h3 style="color:var(--petroleum-dark);margin:0;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em">Evolución clínica (${consultations.length})</h3>
    ${consultations.length ? consultations.map(entryHtml).join('') : '<p style="color:var(--gray-500)">Este paciente todavía no tiene consultas médicas registradas.</p>'}</div>`;
}

async function selectPatient(id) {
  recordsState.selectedPatientId = Number(id);
  renderPatientList();
  await renderPatientRecord(id);
}
function editPatient(id) {
  const patient = recordsState.patients.find((p) => Number(p.id) === Number(id));
  if (!patient) return;
  const telefono = prompt('Teléfono del paciente:', patient.telefono || '');
  if (telefono === null) return;
  const direccion = prompt('Dirección del paciente:', patient.direccion || '');
  if (direccion === null) return;
  patient.telefono = telefono.trim(); patient.direccion = direccion.trim();
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(recordsState.patients));
  renderPatientRecord(id);
}
function printDocument(title, patient, body) {
  const win = window.open('', '_blank', 'width=850,height=700');
  if (!win) return alert('Permite ventanas emergentes para imprimir.');
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,sans-serif;color:#18343b;padding:36px;line-height:1.5}h1{color:#0f4c5c;border-bottom:2px solid #2fb7a6;padding-bottom:12px}
    h2{font-size:17px;margin-top:24px}.meta{color:#566b73}.block{border-bottom:1px solid #dbe7eb;padding:10px 0}strong{color:#0f4c5c}@media print{button{display:none}}</style></head>
    <body><h1>Med Solution · ${escapeHtml(title)}</h1><p><strong>Paciente:</strong> ${escapeHtml(`${patient.nombre} ${patient.apellido}`)}<br>
    <strong>CI:</strong> ${escapeHtml(patient.ci)} · <strong>Teléfono:</strong> ${escapeHtml(patient.telefono || '—')}</p>${body}<script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}
function printRecord(patientId) {
  const patient = recordsState.patients.find((p) => Number(p.id) === Number(patientId));
  const body = consultationsFor(patientId).map((c) => `<div class="block"><h2>${formatDate(c.date)} · ${escapeHtml(c.chiefComplaint || '')}</h2>
    <p><strong>Evolución:</strong> ${escapeHtml(c.evolution || '—')}<br><strong>Diagnóstico:</strong> ${escapeHtml(c.diagnosis || '—')}<br>
    <strong>Tratamiento:</strong> ${escapeHtml(c.treatment || '—')}<br><strong>Receta:</strong> ${escapeHtml(c.prescription || '—')}<br>
    <strong>Indicaciones:</strong> ${escapeHtml(c.indications || '—')}<br><strong>Próximo control:</strong> ${formatDate(c.nextControl)}</p></div>`).join('');
  printDocument('Historia clínica', patient, body || '<p>Sin consultas registradas.</p>');
}
function printPrescription(consultId) {
  const c = recordsState.consultations.find((item) => Number(item.id) === Number(consultId));
  const patient = recordsState.patients.find((p) => Number(p.id) === Number(c?.patientId));
  if (!c || !patient) return;
  printDocument('Receta médica', patient, `<p class="meta">Fecha: ${formatDate(c.date)}</p><div class="block"><h2>Rp/</h2><p>${escapeHtml(c.prescription || 'Sin receta')}</p></div>
    ${c.indications ? `<div class="block"><strong>Indicaciones:</strong><p>${escapeHtml(c.indications)}</p></div>` : ''}<p style="margin-top:80px;text-align:center">____________________________<br>Firma y sello médico</p>`);
}

async function setupMedicalRecords() {
  await window.MedSolutionData?.ready;
  try { await loadData(); } catch (error) { alert(`No se pudo cargar la información clínica: ${error.message}`); return; }
  renderPatientList();
  document.getElementById('recordsDetailPanel').innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray-500)">Selecciona un paciente para ver su historia clínica.</div>';
  document.getElementById('recordsSearch')?.addEventListener('input', (e) => { recordsState.searchTerm = e.target.value; renderPatientList(); });
  document.getElementById('recordsPatientList')?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-patient-id]'); if (button) selectPatient(button.dataset.patientId).catch((error)=>alert(error.message));
  });
  document.getElementById('recordsDetailPanel')?.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-entry]');
    if (toggle) document.querySelector(`.record-entry[data-entry-id="${toggle.dataset.toggleEntry}"]`)?.classList.toggle('record-entry--collapsed');
    const edit = e.target.closest('[data-edit-patient]'); if (edit) editPatient(edit.dataset.editPatient);
    const record = e.target.closest('[data-print-record]'); if (record) printRecord(record.dataset.printRecord);
    const prescription = e.target.closest('[data-print-prescription]'); if (prescription) printPrescription(prescription.dataset.printPrescription);
  });
  const patientId = Number(new URLSearchParams(location.search).get('patientId'));
  if (patientId) selectPatient(patientId);
  window.MedSolutionData?.subscribeAttentions(async () => {
    await loadData();
    if (recordsState.selectedPatientId) await renderPatientRecord(recordsState.selectedPatientId);
    renderPatientList();
  });
  window.MedSolutionData?.subscribePatients(async () => {
    await loadData();
    renderPatientList();
  });
}
document.addEventListener('DOMContentLoaded', setupMedicalRecords);
