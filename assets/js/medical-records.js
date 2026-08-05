// MedSolution — Historia clínica única por patientId.
const CONSULT_KEY = 'medsolution.consultations';
const PATIENTS_KEY = 'medsolution.patients';
const RECORDS_KEY = 'medsolution.medicalRecords';

const recordsState = { patients: [], consultations: [], records: [], users: [], selectedPatientId: null, searchTerm: '', doctorFilter: '', dateFilter: '', diagnosisFilter: '', attachmentConsultationId: null, uploading: false };

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
  recordsState.records = window.MedSolutionData?.isConfigured()
    ? await window.MedSolutionData.getMedicalRecords()
    : readArray(RECORDS_KEY);
  recordsState.users = window.MedSolutionData?.getSystemUsers
    ? await window.MedSolutionData.getSystemUsers().catch(() => [])
    : [];
}
function escapeHtml(value) {
  const div = document.createElement('div'); div.textContent = value == null ? '' : String(value); return div.innerHTML;
}
function getInitials(name) { return (name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase(); }
function formatDate(date) { if (!date) return '—'; const [y,m,d] = date.split('-'); return `${d}/${m}/${y}`; }
function formatDateTime(value) { if (!value) return '—'; return new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function consultationsFor(patientId) {
  return recordsState.consultations
    .filter((c) => c.contraceptiveControl !== true && c.contraceptiveSchedule !== true)
    .filter((c) => Number(c.patientId) === Number(patientId))
    .filter((c) => !recordsState.doctorFilter || medicalResponsible(c) === recordsState.doctorFilter)
    .filter((c) => !recordsState.dateFilter || c.date === recordsState.dateFilter)
    .filter((c) => !recordsState.diagnosisFilter || String(c.diagnosis || '').toLowerCase().includes(recordsState.diagnosisFilter.toLowerCase()))
    .sort((a,b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`));
}
function contraceptivesFor(patientId) {
  return recordsState.consultations
    .filter((item) => item.contraceptiveControl === true)
    .filter((item) => Number(item.patientId) === Number(patientId))
    .sort((a, b) => String(b.applicationDate || b.date).localeCompare(String(a.applicationDate || a.date)));
}
function canViewPrices() {
  try {
    const raw = sessionStorage.getItem('medsolution.authUser') || localStorage.getItem('medsolution.authUser');
    return ['Administrador', 'Médico'].includes(JSON.parse(raw || 'null')?.role);
  } catch { return false; }
}
function medicalResponsible(consultation) {
  if (consultation.scheduledProfessional) return consultation.scheduledProfessional;
  const clinicalRoles=['Administrador','Médico'];
  const byRole = clinicalRoles.includes(consultation.registeredByRole)
    ? recordsState.users.find((user) => user.role === consultation.registeredByRole) : null;
  if (byRole) return byRole.name;
  const byName = recordsState.users.find((user) => user.name === consultation.registeredBy && clinicalRoles.includes(user.role));
  return byName?.name || recordsState.users.find((user) => user.role === 'Médico')?.name || 'Médico';
}
function populateDoctorFilter() {
  const select=document.getElementById('recordsDoctorFilter');if(!select)return;const current=select.value;
  const names=[...new Set(recordsState.consultations.filter(item=>item.contraceptiveControl!==true).map(medicalResponsible).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  select.innerHTML='<option value="">Todos los médicos</option>'+names.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  select.value=names.includes(current)?current:'';recordsState.doctorFilter=select.value;
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
  const historyPatientIds=new Set(recordsState.records.map(record=>Number(record.patientId)));
  const hasClinicalFilters=Boolean(recordsState.doctorFilter||recordsState.dateFilter||recordsState.diagnosisFilter);
  const patients = recordsState.patients
    .filter((patient)=>hasClinicalFilters?consultationsFor(patient.id).length>0:(historyPatientIds.has(Number(patient.id))
      || consultationsFor(patient.id).some(item=>item.requiresMedicalConsultation!==false)
      || contraceptivesFor(patient.id).length > 0))
    .filter((p) => !q || `${p.nombre} ${p.apellido} ${p.ci}`.toLowerCase().includes(q));
  if (!patients.length) { list.innerHTML = '<p style="color:var(--gray-500);padding:16px 0">No se encontraron pacientes.</p>'; return; }
  list.innerHTML = patients.map((p) => {
    const name = `${p.nombre} ${p.apellido}`;
    const latest = consultationsFor(p.id)[0];
    return `<button type="button" class="records-patient-item ${recordsState.selectedPatientId === p.id ? 'records-patient-item--active' : ''}" data-patient-id="${p.id}">
      <span class="patient-photo">${getInitials(name)}</span><div style="flex:1;min-width:0;text-align:left">
      <strong style="display:block;font-size:.93rem;color:var(--gray-700)">${escapeHtml(name)}</strong>
      <small style="color:var(--gray-500)">${latest ? `${formatDate(latest.date)} · ${escapeHtml(latest.chiefComplaint||latest.serviceType||'Consulta')} · ${escapeHtml(latest.registeredBy||'Médico')}` : 'Sin consultas'}</small></div><span style="color:var(--aqua);font-weight:800">›</span></button>`;
  }).join('');
}

function attachmentHtml(attachment, consultationId) {
  const image = String(attachment.type || '').startsWith('image/');
  return `<div class="record-attachment" data-attachment-path="${escapeHtml(attachment.path)}">
    ${image ? '<img class="record-attachment__preview" alt="Vista previa" />' : '<span class="record-attachment__preview">📄</span>'}
    <div class="record-attachment__meta"><strong title="${escapeHtml(attachment.name)}">${escapeHtml(attachment.name)}</strong><small>${formatDateTime(attachment.uploadedAt)}</small></div>
    <div class="record-attachment__actions"><a data-attachment-open target="_blank" title="Abrir">Ver</a><a data-attachment-download download="${escapeHtml(attachment.name)}" title="Descargar">↓</a><button type="button" data-delete-attachment="${escapeHtml(attachment.id)}" data-consultation-id="${consultationId}" title="Eliminar">×</button></div>
  </div>`;
}

function entryHtml(c) {
  const attachments = Array.isArray(c.attachments) ? c.attachments : [];
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
      ${field('Enfermedad actual', c.evolution, true)}
      ${field('Antecedentes', c.clinicalAntecedents, true)}
      ${(c.bp || c.hr || c.temp || c.weight || c.height || c.spo2) ? `<div class="record-field record-field--vitals"><span>Signos vitales</span><div class="vitals-chips">
        ${c.bp ? `<span class="vital-chip">PA: ${escapeHtml(c.bp)} mmHg</span>` : ''}${c.hr ? `<span class="vital-chip">FC: ${escapeHtml(c.hr)} lpm</span>` : ''}
        ${c.temp ? `<span class="vital-chip">T°: ${escapeHtml(c.temp)} °C</span>` : ''}${c.weight ? `<span class="vital-chip">Peso: ${escapeHtml(c.weight)} kg</span>` : ''}
        ${c.height ? `<span class="vital-chip">Talla: ${escapeHtml(c.height)} cm</span>` : ''}${c.spo2 ? `<span class="vital-chip">SpO₂: ${escapeHtml(c.spo2)}%</span>` : ''}</div></div>` : ''}
      ${field('Examen físico', c.physicalExam, true)}${field('Diagnóstico', c.diagnosis, true, true)}
      ${field('Tratamiento', c.treatment, true)}${field('Medicamentos', c.medications, true)}${field('Procedimientos', c.procedures, true)}${field('Receta', c.prescription, true)}
      ${field('Indicaciones', c.indications, true)}${field('Próximo control', formatDate(c.nextControl), false)}
      ${field('Observaciones', c.observations, true)}
      ${field('Médico responsable', medicalResponsible(c), true)}
      <section class="record-attachments"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><strong style="color:var(--petroleum)">Archivos Adjuntos (${attachments.length})</strong><button class="btn btn--secondary" style="padding:8px 12px;font-size:.8rem" type="button" data-attach-files="${c.id}">Adjuntar archivos</button></div>
      <div class="record-attachments__list">${attachments.length ? attachments.map((item) => attachmentHtml(item, c.id)).join('') : '<small style="color:var(--gray-500)">Sin archivos adjuntos en esta evolución.</small>'}</div></section>
    </div></div>`;
}
function field(label, value, full = false, highlight = false) {
  if (!value || value === '—') return '';
  return `<div class="record-field ${full ? 'record-field--full' : ''} ${highlight ? 'record-field--highlight' : ''}"><span>${label}</span><p>${escapeHtml(value)}</p></div>`;
}

function contraceptiveEntryHtml(item) {
  const price = canViewPrices()
    ? `<div class="record-field"><span>Precio registrado</span><p>${Number(item.servicePrice || 0).toFixed(2)} Bs</p></div>`
    : '';
  return `<div class="record-entry"><div class="record-entry__header"><span class="record-entry__date">◉ ${formatDate(item.applicationDate || item.date)}</span><strong>${escapeHtml(item.contraceptiveType || 'Anticonceptivo')}</strong></div>
    <div class="record-entry__grid">${field('Responsable', item.procedureResponsible || '—')}${field('Próxima aplicación', formatDate(item.nextApplicationDate), false)}${price}${field('Observaciones', item.contraceptiveObservations || '—', true)}</div></div>`;
}

async function renderPatientRecord(patientId) {
  const panel = document.getElementById('recordsDetailPanel');
  const patient = recordsState.patients.find((p) => Number(p.id) === Number(patientId));
  if (!patient) return;
  await ensureRecord(patient.id);
  const name = `${patient.nombre} ${patient.apellido}`;
  const consultations = consultationsFor(patient.id);
  const contraceptives = contraceptivesFor(patient.id);
  panel.innerHTML = `<div class="record-patient-header"><span class="patient-photo" style="width:52px;height:52px;font-size:1.1rem">${getInitials(name)}</span>
    <div><h2 style="margin:0;color:var(--petroleum-dark)">${escapeHtml(name)}</h2>
    <p style="margin:4px 0 0;color:var(--gray-500);font-size:.88rem">CI: ${escapeHtml(patient.ci)} · ${escapeHtml(patient.genero || '—')} · Nac: ${formatDate(patient.fechaNacimiento)} · Tel: ${escapeHtml(patient.telefono || '—')}</p></div>
    <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn--secondary" type="button" data-edit-patient="${patient.id}">Editar datos</button>
      <button class="btn btn--secondary" type="button" data-view-full-record="${patient.id}">Ver Historia Clínica Completa</button>
      <button class="btn btn--secondary" type="button" data-print-record="${patient.id}">Imprimir historia</button>
      <button class="btn btn--secondary" type="button" data-export-record="${patient.id}">Exportar PDF</button>
      <a class="btn btn--primary" href="appointments.html?action=new&patientId=${patient.id}">+ Nueva atención</a>
    </div></div>
    <div class="record-tabs" role="tablist"><button class="record-tab record-tab--active" type="button" data-record-tab="clinical">Historia clínica (${consultations.length})</button><button class="record-tab" type="button" data-record-tab="contraceptives">Anticonceptivos (${contraceptives.length})</button></div>
    <div class="record-tab-panel record-entries" data-record-panel="clinical"><h3 style="color:var(--petroleum-dark);margin:0;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em">Evolución clínica (${consultations.length})</h3>
    ${consultations.length ? consultations.map(entryHtml).join('') : '<p style="color:var(--gray-500)">Este paciente todavía no tiene consultas médicas registradas.</p>'}</div>
    <div class="record-tab-panel record-entries" data-record-panel="contraceptives" hidden><h3 style="color:var(--petroleum-dark);margin:0;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em">Seguimiento anticonceptivo (${contraceptives.length})</h3>
    ${contraceptives.length ? contraceptives.map(contraceptiveEntryHtml).join('') : '<p style="color:var(--gray-500)">Este paciente todavía no tiene aplicaciones registradas.</p>'}</div>`;
  await hydrateAttachmentUrls(panel);
}

async function hydrateAttachmentUrls(scope) {
  const nodes = [...scope.querySelectorAll('[data-attachment-path]')];
  await Promise.all(nodes.map(async (node) => {
    try {
      const url = await window.MedSolutionData.signedFileUrl(node.dataset.attachmentPath);
      const image = node.querySelector('img'); if (image) image.src = url;
      const open = node.querySelector('[data-attachment-open]'); if (open) open.href = url;
      const download = node.querySelector('[data-attachment-download]'); if (download) download.href = url;
    } catch { node.querySelector('.record-attachment__meta small').textContent = 'Archivo no disponible'; }
  }));
}

async function uploadClinicalFiles(files) {
  if (recordsState.uploading || !recordsState.attachmentConsultationId || !files.length) return;
  const consultation = recordsState.consultations.find((item) => Number(item.id) === Number(recordsState.attachmentConsultationId));
  if (!consultation?.remoteId) throw new Error('Guarda la evolución antes de adjuntar archivos.');
  recordsState.uploading = true;
  const uploaded = [];
  try {
    const attachments = Array.isArray(consultation.attachments) ? [...consultation.attachments] : [];
    for (const file of files) {
      const attachment = await window.MedSolutionData.uploadClinicalAttachment(consultation.remoteId, file);
      uploaded.push(attachment);
      attachments.push(attachment);
    }
    const saved = await window.MedSolutionData.saveAttention({ ...consultation, attachments });
    Object.assign(consultation, saved, { attachments });
    await renderPatientRecord(recordsState.selectedPatientId);
  } catch (error) {
    await Promise.all(uploaded.map((item) => window.MedSolutionData.deleteStoredFile(item.path).catch(() => {})));
    throw error;
  } finally { recordsState.uploading = false; recordsState.attachmentConsultationId = null; }
}

async function deleteClinicalFile(consultationId, attachmentId) {
  const consultation = recordsState.consultations.find((item) => Number(item.id) === Number(consultationId));
  const attachment = consultation?.attachments?.find((item) => String(item.id) === String(attachmentId));
  if (!attachment || !confirm(`¿Eliminar ${attachment.name}?`)) return;
  const attachments = consultation.attachments.filter((item) => String(item.id) !== String(attachmentId));
  const saved = await window.MedSolutionData.saveAttention({ ...consultation, attachments });
  Object.assign(consultation, saved, { attachments });
  await window.MedSolutionData.deleteStoredFile(attachment.path).catch(() => {});
  await renderPatientRecord(recordsState.selectedPatientId);
}

async function selectPatient(id) {
  recordsState.selectedPatientId = Number(id);
  renderPatientList();
  await renderPatientRecord(id);
}
async function editPatient(id) {
  const patient = recordsState.patients.find((p) => Number(p.id) === Number(id));
  if (!patient) return;
  const telefono = prompt('Teléfono del paciente:', patient.telefono || '');
  if (telefono === null) return;
  const direccion = prompt('Dirección del paciente:', patient.direccion || '');
  if (direccion === null) return;
  patient.telefono = telefono.trim(); patient.direccion = direccion.trim();
  if (window.MedSolutionData?.isConfigured()) {
    const persisted = await window.MedSolutionData.savePatient(patient);
    Object.assign(patient, persisted);
  }
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(recordsState.patients));
  await renderPatientRecord(id);
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
    <p><strong>Enfermedad actual:</strong> ${escapeHtml(c.evolution || '—')}<br><strong>Antecedentes:</strong> ${escapeHtml(c.clinicalAntecedents || '—')}<br>
    <strong>Examen físico:</strong> ${escapeHtml(c.physicalExam || '—')}<br><strong>Diagnóstico:</strong> ${escapeHtml(c.diagnosis || '—')}<br>
    <strong>Tratamiento:</strong> ${escapeHtml(c.treatment || '—')}<br><strong>Medicamentos:</strong> ${escapeHtml(c.medications || c.prescription || '—')}<br><strong>Procedimientos:</strong> ${escapeHtml(c.procedures || '—')}<br>
    <strong>Indicaciones:</strong> ${escapeHtml(c.indications || '—')}<br><strong>Observaciones:</strong> ${escapeHtml(c.observations || '—')}<br><strong>Médico responsable:</strong> ${escapeHtml(medicalResponsible(c))}<br><strong>Próximo control:</strong> ${formatDate(c.nextControl)}</p></div>`).join('');
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
  populateDoctorFilter();
  document.getElementById('recordsDetailPanel').innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray-500)">Selecciona un paciente para ver su historia clínica.</div>';
  document.getElementById('recordsSearch')?.addEventListener('input', (e) => { recordsState.searchTerm = e.target.value; renderPatientList(); });
  document.getElementById('recordsDoctorFilter')?.addEventListener('change',(e)=>{recordsState.doctorFilter=e.target.value;renderPatientList();if(recordsState.selectedPatientId)renderPatientRecord(recordsState.selectedPatientId)});
  document.getElementById('recordsDateFilter')?.addEventListener('change',(e)=>{recordsState.dateFilter=e.target.value;renderPatientList();if(recordsState.selectedPatientId)renderPatientRecord(recordsState.selectedPatientId)});
  document.getElementById('recordsDiagnosisFilter')?.addEventListener('input',(e)=>{recordsState.diagnosisFilter=e.target.value;renderPatientList();if(recordsState.selectedPatientId)renderPatientRecord(recordsState.selectedPatientId)});
  document.getElementById('recordsPatientList')?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-patient-id]'); if (button) selectPatient(button.dataset.patientId).catch((error)=>alert(error.message));
  });
  document.getElementById('recordsDetailPanel')?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-record-tab]');
    if (tab) {
      document.querySelectorAll('[data-record-tab]').forEach((item) => item.classList.toggle('record-tab--active', item === tab));
      document.querySelectorAll('[data-record-panel]').forEach((panel) => { panel.hidden = panel.dataset.recordPanel !== tab.dataset.recordTab; });
    }
    const toggle = e.target.closest('[data-toggle-entry]');
    if (toggle) document.querySelector(`.record-entry[data-entry-id="${toggle.dataset.toggleEntry}"]`)?.classList.toggle('record-entry--collapsed');
    const edit = e.target.closest('[data-edit-patient]'); if (edit) editPatient(edit.dataset.editPatient).catch((error)=>alert(error.message));
    const record = e.target.closest('[data-print-record]'); if (record) printRecord(record.dataset.printRecord);
    const exportRecord = e.target.closest('[data-export-record]'); if (exportRecord) printRecord(exportRecord.dataset.exportRecord);
    const prescription = e.target.closest('[data-print-prescription]'); if (prescription) printPrescription(prescription.dataset.printPrescription);
    const full = e.target.closest('[data-view-full-record]');
    if (full) {
      document.querySelector('[data-record-tab="clinical"]')?.click();
      document.querySelectorAll('.record-entry').forEach((entry) => entry.classList.remove('record-entry--collapsed'));
      document.querySelector('[data-record-panel="clinical"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const attach = e.target.closest('[data-attach-files]');
    if (attach) { recordsState.attachmentConsultationId = Number(attach.dataset.attachFiles); document.getElementById('clinicalAttachmentInput')?.click(); }
    const remove = e.target.closest('[data-delete-attachment]');
    if (remove) deleteClinicalFile(remove.dataset.consultationId, remove.dataset.deleteAttachment).catch((error) => alert(error.message));
  });
  document.getElementById('clinicalAttachmentInput')?.addEventListener('change', (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    uploadClinicalFiles(files).catch((error) => alert(`No se pudieron adjuntar los archivos: ${error.message}`));
  });
  const patientId = Number(new URLSearchParams(location.search).get('patientId'));
  if (patientId) selectPatient(patientId);
  window.MedSolutionData?.subscribeAttentions(async () => {
    await loadData();
    populateDoctorFilter();
    if (recordsState.selectedPatientId) await renderPatientRecord(recordsState.selectedPatientId);
    renderPatientList();
  });
  window.MedSolutionData?.subscribePatients(async () => {
    await loadData();
    renderPatientList();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupMedicalRecords, { once: true });
else setupMedicalRecords();
