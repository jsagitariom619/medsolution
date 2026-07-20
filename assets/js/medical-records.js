// Medical Records Module — Historias Clínicas (localStorage)

const CONSULT_KEY = 'medsolution.consultations';
const PATIENTS_KEY = 'medsolution.patients';

const recordsState = {
  patients: [],
  consultations: [],
  selectedPatientId: null,
  searchTerm: '',
};

// ── Persistence ───────────────────────────────────────────────────────────────

function loadData() {
  try {
    const storedPatients = localStorage.getItem(PATIENTS_KEY);
    recordsState.patients = storedPatients ? JSON.parse(storedPatients) : [];
  } catch {
    recordsState.patients = [];
  }
  try {
    const storedConsult = localStorage.getItem(CONSULT_KEY);
    recordsState.consultations = storedConsult ? JSON.parse(storedConsult) : [];
  } catch {
    recordsState.consultations = [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function getConsultationsForPatient(patientId) {
  return recordsState.consultations
    .filter((c) => c.patientId === patientId)
    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
}

// ── Render patient list ───────────────────────────────────────────────────────

function renderPatientList() {
  const list = document.getElementById('recordsPatientList');
  if (!list) return;

  const term = recordsState.searchTerm.toLowerCase();
  const patients = recordsState.patients.filter((p) => {
    if (!term) return true;
    return (
      p.nombre.toLowerCase().includes(term) ||
      p.apellido.toLowerCase().includes(term) ||
      p.ci.includes(term)
    );
  });

  list.innerHTML = '';

  if (!patients.length) {
    list.innerHTML = '<p style="color:var(--gray-500);padding:16px 0;">No se encontraron pacientes.</p>';
    return;
  }

  patients.forEach((p) => {
    const consultCount = getConsultationsForPatient(p.id).length;
    const fullName = `${p.nombre} ${p.apellido}`;
    const li = document.createElement('button');
    li.type = 'button';
    li.className = 'records-patient-item';
    if (recordsState.selectedPatientId === p.id) li.classList.add('records-patient-item--active');
    li.dataset.patientId = p.id;
    li.innerHTML = `
      <span class="patient-photo">${getInitials(fullName)}</span>
      <div style="flex:1;min-width:0;text-align:left">
        <strong style="display:block;font-size:.93rem;color:var(--gray-700)">${fullName}</strong>
        <small style="color:var(--gray-500)">CI: ${p.ci} &middot; ${consultCount} consulta${consultCount !== 1 ? 's' : ''}</small>
      </div>
      <span style="color:var(--aqua);font-weight:800;font-size:.82rem">›</span>
    `;
    li.addEventListener('click', () => selectPatient(p.id));
    list.appendChild(li);
  });
}

// ── Select patient → show record ──────────────────────────────────────────────

function selectPatient(patientId) {
  recordsState.selectedPatientId = patientId;
  renderPatientList(); // re-render to update active state
  renderPatientRecord(patientId);
}

function renderPatientRecord(patientId) {
  const panel = document.getElementById('recordsDetailPanel');
  if (!panel) return;

  const patient = recordsState.patients.find((p) => p.id === patientId);
  if (!patient) {
    panel.innerHTML = '<p style="color:var(--gray-500);padding:20px 0;">Selecciona un paciente para ver su historia clínica.</p>';
    return;
  }

  const consultations = getConsultationsForPatient(patientId);
  const fullName = `${patient.nombre} ${patient.apellido}`;

  const consultsHtml = consultations.length
    ? consultations.map((c) => `
        <div class="record-entry">
          <div class="record-entry__header">
            <span class="record-entry__date">📅 ${formatDisplayDate(c.date)}${c.time ? ' — ' + c.time : ''}</span>
            <a class="btn btn--secondary" style="padding:8px 14px;font-size:.82rem" href="appointments.html">Editar</a>
          </div>
          <div class="record-entry__grid">
            ${c.chiefComplaint ? `<div class="record-field record-field--full"><span>Motivo</span><p>${c.chiefComplaint}</p></div>` : ''}
            ${(c.bp || c.hr || c.temp || c.weight || c.height || c.spo2) ? `
              <div class="record-field record-field--vitals">
                <span>Signos vitales</span>
                <div class="vitals-chips">
                  ${c.bp ? `<span class="vital-chip">PA: ${c.bp} mmHg</span>` : ''}
                  ${c.hr ? `<span class="vital-chip">FC: ${c.hr} lpm</span>` : ''}
                  ${c.temp ? `<span class="vital-chip">T°: ${c.temp}°C</span>` : ''}
                  ${c.weight ? `<span class="vital-chip">Peso: ${c.weight} kg</span>` : ''}
                  ${c.height ? `<span class="vital-chip">Talla: ${c.height} cm</span>` : ''}
                  ${c.spo2 ? `<span class="vital-chip">SpO₂: ${c.spo2}%</span>` : ''}
                </div>
              </div>
            ` : ''}
            ${c.physicalExam ? `<div class="record-field record-field--full"><span>Examen físico</span><p>${c.physicalExam}</p></div>` : ''}
            ${c.diagnosis ? `<div class="record-field record-field--highlight record-field--full"><span>Diagnóstico</span><p>${c.diagnosis}</p></div>` : ''}
            ${c.treatment ? `<div class="record-field record-field--full"><span>Tratamiento</span><p>${c.treatment}</p></div>` : ''}
            ${c.observations ? `<div class="record-field record-field--full"><span>Observaciones</span><p>${c.observations}</p></div>` : ''}
          </div>
        </div>
      `).join('')
    : '<p style="color:var(--gray-500);padding:12px 0;">Este paciente no tiene consultas registradas. <a href="appointments.html" style="color:var(--medical-blue);font-weight:700">Registrar primera atención →</a></p>';

  panel.innerHTML = `
    <div class="record-patient-header">
    <span class="patient-photo" style="width:52px;height:52px;font-size:1.1rem">${getInitials(fullName)}</span>
      <div>
        <h2 style="margin:0;color:var(--petroleum-dark);letter-spacing:-0.03em">${fullName}</h2>
        <p style="margin:4px 0 0;color:var(--gray-500);font-size:.88rem">CI: ${patient.ci} &middot; ${patient.genero || '—'} &middot; Nac: ${formatDisplayDate(patient.fechaNacimiento)} &middot; Tel: ${patient.telefono || '—'}</p>
      </div>
      <a class="btn btn--primary" href="appointments.html?patientId=${patient.id}" style="margin-left:auto;white-space:nowrap">+ Nueva atención</a>
    </div>
    <div class="record-entries">
      <h3 style="color:var(--petroleum-dark);margin:0 0 16px;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em">Evolución clínica (${consultations.length})</h3>
      ${consultsHtml}
    </div>
  `;
}

// ── Render empty state ────────────────────────────────────────────────────────

function renderEmptyState() {
  const panel = document.getElementById('recordsDetailPanel');
  if (panel) {
    panel.innerHTML = `
      <div style="padding:40px 0;text-align:center;color:var(--gray-500)">
        <p style="font-size:2rem;margin:0 0 12px">▣</p>
        <p>Selecciona un paciente de la lista para ver su historia clínica.</p>
      </div>
    `;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function setupMedicalRecords() {
  loadData();
  renderPatientList();
  renderEmptyState();

  document.getElementById('recordsSearch')?.addEventListener('input', (e) => {
    recordsState.searchTerm = e.target.value;
    renderPatientList();
    if (recordsState.selectedPatientId) renderPatientRecord(recordsState.selectedPatientId);
  });

  // Pre-select patient from URL param if provided
  const prePatientIdParam = parseInt(new URLSearchParams(window.location.search).get('patientId'), 10);
  if (!isNaN(prePatientIdParam)) {
    selectPatient(prePatientIdParam);
  }
}

document.addEventListener('DOMContentLoaded', setupMedicalRecords);
