// Appointments Module — Nueva Atención / Consulta (localStorage)
// Persistence isolated in load/save helpers — ready to migrate to Supabase.

const CONSULT_KEY = 'medsolution.consultations';
const PATIENTS_KEY = 'medsolution.patients';

const consultState = {
  consultations: [],
  editingId: null,
  searchTerm: '',
  patientSearchTerm: '',
};

// ── Persistence ───────────────────────────────────────────────────────────────

function loadConsultations() {
  try {
    const stored = localStorage.getItem(CONSULT_KEY);
    consultState.consultations = stored ? JSON.parse(stored) : [];
  } catch {
    consultState.consultations = [];
  }
}

function saveConsultations() {
  localStorage.setItem(CONSULT_KEY, JSON.stringify(consultState.consultations));
}

function getPatients() {
  try {
    const stored = localStorage.getItem(PATIENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePatientsToStorage(patients) {
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
}

function nextConsultId() {
  const ids = consultState.consultations.map((c) => c.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

function nextPatientId(patients) {
  const ids = patients.map((p) => p.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// ── URL params ────────────────────────────────────────────────────────────────

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Render consultations list ─────────────────────────────────────────────────

function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function renderConsultations() {
  const tbody = document.getElementById('consultTableBody');
  if (!tbody) return;

  const term = consultState.searchTerm.toLowerCase();
  const visible = consultState.consultations.filter((c) => {
    if (!term) return true;
    return (
      c.patientName.toLowerCase().includes(term) ||
      (c.diagnosis || '').toLowerCase().includes(term) ||
      (c.chiefComplaint || '').toLowerCase().includes(term)
    );
  });

  visible.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

  const emptyRow = document.getElementById('consultEmptyRow');
  if (emptyRow) emptyRow.style.display = visible.length ? 'none' : '';

  Array.from(tbody.querySelectorAll('tr[data-consult-row]')).forEach((r) => r.remove());

  visible.forEach((c) => {
    const tr = document.createElement('tr');
    tr.dataset.consultRow = c.id;
    tr.innerHTML = `
      <td><strong>${formatDisplayDate(c.date)}</strong><br><small style="color:var(--gray-500)">${c.time || ''}</small></td>
      <td>
        <div class="patient-cell">
          <span class="patient-photo">${getInitials(c.patientName)}</span>
          <span>${c.patientName}</span>
        </div>
      </td>
      <td>${c.chiefComplaint || '—'}</td>
      <td>${c.diagnosis || '—'}</td>
      <td>
        <span class="action-links">
          <button class="btn-action" data-action="view" data-id="${c.id}" title="Ver">👁</button>
          <button class="btn-action" data-action="edit" data-id="${c.id}" title="Editar">✎</button>
          <button class="btn-action btn-action--delete" data-action="delete" data-id="${c.id}" title="Eliminar">✕</button>
        </span>
      </td>
    `;
    tbody.insertBefore(tr, emptyRow);
  });

  updateConsultCounter(visible.length);
}

function updateConsultCounter(count) {
  const el = document.getElementById('consultCount');
  if (el) el.textContent = `${count} consulta${count !== 1 ? 's' : ''}`;
}

// ── Patient picker (replaces select) ─────────────────────────────────────────

function setSelectedPatient(id, name) {
  const idInput = document.getElementById('consultPatientId');
  const nameInput = document.getElementById('consultPatientNameHidden');
  const display = document.getElementById('consultPatientDisplay');
  if (idInput) idInput.value = id;
  if (nameInput) nameInput.value = name;
  if (display) {
    display.innerHTML = `<strong>${name}</strong><small>ID Historia: #${id}</small>`;
  }
}

function clearSelectedPatient() {
  const idInput = document.getElementById('consultPatientId');
  const nameInput = document.getElementById('consultPatientNameHidden');
  const display = document.getElementById('consultPatientDisplay');
  if (idInput) idInput.value = '';
  if (nameInput) nameInput.value = '';
  if (display) display.innerHTML = '<em style="color:var(--gray-500)">Sin paciente seleccionado</em>';
}

function getSelectedPatientId() {
  return parseInt(document.getElementById('consultPatientId')?.value || '', 10) || null;
}

function getSelectedPatientName() {
  return document.getElementById('consultPatientNameHidden')?.value || '';
}

// ── Patient Search Modal ──────────────────────────────────────────────────────

function openPatientSearchModal() {
  const modal = document.getElementById('patientSearchModal');
  const input = document.getElementById('patientSearchInput');
  if (!modal) return;
  // Reset state
  if (input) { input.value = ''; }
  renderPatientSearchResults('');
  hideQuickRegisterForm();
  modal.classList.add('nursing-modal--active');
  setTimeout(() => input?.focus(), 80);
}

function closePatientSearchModal() {
  const modal = document.getElementById('patientSearchModal');
  if (modal) modal.classList.remove('nursing-modal--active');
  hideQuickRegisterForm();
}

function renderPatientSearchResults(term) {
  const container = document.getElementById('patientSearchResults');
  if (!container) return;

  const patients = getPatients();
  const q = term.toLowerCase().trim();

  const matches = q
    ? patients.filter((p) =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
        (p.ci || '').toLowerCase().includes(q) ||
        (p.telefono || '').includes(q) ||
        String(p.id).includes(q)
      )
    : patients;

  if (!matches.length) {
    container.innerHTML = `<p class="patient-result-empty">${q ? 'No se encontraron pacientes. Puedes registrar uno nuevo abajo.' : 'No hay pacientes registrados. Registra el primero abajo.'}</p>`;
    return;
  }

  container.innerHTML = matches.map((p) => {
    const fullName = `${p.nombre} ${p.apellido}`;
    const initials = getInitials(fullName);
    const consultCount = consultState.consultations.filter((c) => c.patientId === p.id).length;
    return `
      <div class="patient-result-item" data-select-patient="${p.id}" data-patient-name="${fullName}">
        <span class="patient-photo">${initials}</span>
        <div class="patient-result-item__info">
          <strong>${fullName}</strong>
          <small>CI: ${p.ci}${p.telefono ? ' · ' + p.telefono : ''} · #${p.id} · ${consultCount} consulta${consultCount !== 1 ? 's' : ''}</small>
        </div>
        <button class="btn btn--primary" type="button" style="padding:7px 14px;font-size:.82rem" data-pick-patient="${p.id}" data-pick-name="${fullName}">Seleccionar</button>
      </div>
    `;
  }).join('');
}

function selectPatientAndContinue(patientId, patientName) {
  closePatientSearchModal();
  setSelectedPatient(patientId, patientName);
  // Show pick button only in create/edit mode (already handled by openConsultModal)
  const pickBtn = document.getElementById('pickPatientBtn');
  if (pickBtn) pickBtn.style.display = '';
  // If consultation modal is not yet open (came from "Nueva Atención" button), open it
  const consultModal = document.getElementById('consultModal');
  if (!consultModal?.classList.contains('nursing-modal--active')) {
    openConsultModal('create');
  }
}

// ── Quick patient registration ────────────────────────────────────────────────

function showQuickRegisterForm() {
  const section = document.getElementById('quickRegisterSection');
  const btn = document.getElementById('showRegisterPatientBtn');
  if (section) section.style.display = '';
  if (btn) btn.style.display = 'none';
  document.getElementById('quickPatientForm')?.reset();
}

function hideQuickRegisterForm() {
  const section = document.getElementById('quickRegisterSection');
  const btn = document.getElementById('showRegisterPatientBtn');
  if (section) section.style.display = 'none';
  if (btn) btn.style.display = '';
}

function handleQuickPatientSave(event) {
  event.preventDefault();
  const form = document.getElementById('quickPatientForm');
  if (!form) return;

  const nombre = form.elements.nombre.value.trim();
  const apellido = form.elements.apellido.value.trim();
  const ci = form.elements.ci.value.trim();

  if (!nombre || !apellido || !ci) {
    alert('Nombre, apellido y cédula son requeridos.');
    return;
  }

  const patients = getPatients();
  const newPatient = {
    id: nextPatientId(patients),
    nombre,
    apellido,
    ci,
    telefono: form.elements.telefono.value.trim(),
    genero: form.elements.genero.value,
    fechaNacimiento: form.elements.fechaNacimiento.value,
    email: '',
    direccion: '',
    registrado: new Date().toISOString().slice(0, 10),
  };

  patients.push(newPatient);
  savePatientsToStorage(patients);

  const fullName = `${newPatient.nombre} ${newPatient.apellido}`;
  selectPatientAndContinue(newPatient.id, fullName);
}

// ── Consultation Modal ────────────────────────────────────────────────────────

function openConsultModal(mode, consult = null) {
  const modal = document.getElementById('consultModal');
  const title = document.getElementById('consultModalTitle');
  const form = document.getElementById('consultForm');
  if (!modal || !form) return;

  form.reset();
  consultState.editingId = null;
  setConsultFormReadOnly(form, false);

  const saveBtn = document.getElementById('consultSaveBtn');
  const pickBtn = document.getElementById('pickPatientBtn');

  if (mode === 'create') {
    title.textContent = 'Nueva Atención';
    if (form.elements.date) form.elements.date.value = new Date().toISOString().slice(0, 10);
    if (form.elements.time) form.elements.time.value = new Date().toTimeString().slice(0, 5);
    if (saveBtn) saveBtn.style.display = '';
    if (pickBtn) pickBtn.style.display = '';
    // Only clear patient if none was pre-selected
    if (!getSelectedPatientId()) clearSelectedPatient();
  } else if (mode === 'edit' && consult) {
    title.textContent = 'Editar Consulta';
    consultState.editingId = consult.id;
    fillConsultForm(form, consult);
    if (saveBtn) saveBtn.style.display = '';
    if (pickBtn) pickBtn.style.display = '';
  } else if (mode === 'view' && consult) {
    title.textContent = 'Detalle de Consulta';
    fillConsultForm(form, consult);
    setConsultFormReadOnly(form, true);
    if (saveBtn) saveBtn.style.display = 'none';
    if (pickBtn) pickBtn.style.display = 'none';
  }

  modal.classList.add('nursing-modal--active');
}

function closeConsultModal() {
  const modal = document.getElementById('consultModal');
  const form = document.getElementById('consultForm');
  if (modal) modal.classList.remove('nursing-modal--active');
  if (form) { form.reset(); setConsultFormReadOnly(form, false); }
  clearSelectedPatient();
  consultState.editingId = null;
}

function fillConsultForm(form, c) {
  setSelectedPatient(c.patientId, c.patientName);
  if (form.elements.date) form.elements.date.value = c.date || '';
  if (form.elements.time) form.elements.time.value = c.time || '';
  ['bp', 'hr', 'temp', 'weight', 'height', 'spo2', 'chiefComplaint', 'physicalExam', 'diagnosis', 'treatment', 'observations'].forEach((f) => {
    if (form.elements[f]) form.elements[f].value = c[f] || '';
  });
}

function setConsultFormReadOnly(form, readOnly) {
  form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((el) => {
    el.readOnly = readOnly;
    if (el.tagName === 'SELECT') el.disabled = readOnly;
  });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function handleConsultSave(event) {
  event.preventDefault();
  const form = document.getElementById('consultForm');
  if (!form) return;

  const patientId = getSelectedPatientId();
  const patientName = getSelectedPatientName();

  if (!patientId) {
    alert('Por favor selecciona un paciente.');
    return;
  }

  const data = {
    patientId,
    patientName,
    date: form.elements.date.value,
    time: form.elements.time.value,
    bp: form.elements.bp.value.trim(),
    hr: form.elements.hr.value.trim(),
    temp: form.elements.temp.value.trim(),
    weight: form.elements.weight.value.trim(),
    height: form.elements.height.value.trim(),
    spo2: form.elements.spo2.value.trim(),
    chiefComplaint: form.elements.chiefComplaint.value.trim(),
    physicalExam: form.elements.physicalExam.value.trim(),
    diagnosis: form.elements.diagnosis.value.trim(),
    treatment: form.elements.treatment.value.trim(),
    observations: form.elements.observations.value.trim(),
  };

  if (!data.date || !data.chiefComplaint) {
    alert('Fecha y motivo de consulta son requeridos.');
    return;
  }

  if (consultState.editingId !== null) {
    const idx = consultState.consultations.findIndex((c) => c.id === consultState.editingId);
    if (idx > -1) consultState.consultations[idx] = { ...consultState.consultations[idx], ...data };
  } else {
    consultState.consultations.push({ id: nextConsultId(), ...data });
  }

  // Consultations are stored with patientId — Historia Clínica reads them directly from here.
  saveConsultations();
  closeConsultModal();
  renderConsultations();
}

function handleConsultDelete(id) {
  if (!confirm('¿Eliminar esta consulta?')) return;
  consultState.consultations = consultState.consultations.filter((c) => c.id !== id);
  saveConsultations();
  renderConsultations();
}

// ── Init ──────────────────────────────────────────────────────────────────────

function setupAppointmentsModule() {
  loadConsultations();
  renderConsultations();

  // ── Patient search modal events ──
  document.getElementById('closePatientSearchModalBtn')?.addEventListener('click', closePatientSearchModal);
  document.querySelector('#patientSearchModal .nursing-modal__overlay')?.addEventListener('click', closePatientSearchModal);

  document.getElementById('patientSearchInput')?.addEventListener('input', (e) => {
    renderPatientSearchResults(e.target.value);
  });

  document.getElementById('patientSearchResults')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-patient]');
    if (!btn) return;
    const id = parseInt(btn.dataset.pickPatient, 10);
    const name = btn.dataset.pickName || '';
    selectPatientAndContinue(id, name);
  });

  document.getElementById('showRegisterPatientBtn')?.addEventListener('click', showQuickRegisterForm);
  document.getElementById('cancelQuickPatientBtn')?.addEventListener('click', hideQuickRegisterForm);
  document.getElementById('quickPatientForm')?.addEventListener('submit', handleQuickPatientSave);

  // ── Consultation modal events ──
  document.getElementById('pickPatientBtn')?.addEventListener('click', openPatientSearchModal);
  document.getElementById('newConsultBtn')?.addEventListener('click', openPatientSearchModal);
  document.getElementById('closeConsultModalBtn')?.addEventListener('click', closeConsultModal);
  document.getElementById('cancelConsultModalBtn')?.addEventListener('click', closeConsultModal);
  document.querySelector('#consultModal .nursing-modal__overlay')?.addEventListener('click', closeConsultModal);
  document.getElementById('consultForm')?.addEventListener('submit', handleConsultSave);

  document.getElementById('consultSearch')?.addEventListener('input', (e) => {
    consultState.searchTerm = e.target.value;
    renderConsultations();
  });

  document.getElementById('consultTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    const consult = consultState.consultations.find((c) => c.id === id);
    if (!consult) return;
    if (btn.dataset.action === 'view') openConsultModal('view', consult);
    else if (btn.dataset.action === 'edit') openConsultModal('edit', consult);
    else if (btn.dataset.action === 'delete') handleConsultDelete(id);
  });

  // ── Auto-open from URL params ──
  const prePatientId = parseInt(getUrlParam('patientId'), 10);
  const action = getUrlParam('action');

  if (!isNaN(prePatientId) && prePatientId > 0) {
    // Redirected from medical-records or agenda with a specific patient
    const patients = getPatients();
    const patient = patients.find((p) => p.id === prePatientId);
    if (patient) {
      setSelectedPatient(patient.id, `${patient.nombre} ${patient.apellido}`);
      openConsultModal('create');
    }
  } else if (action === 'new') {
    // "Nueva Atención" button from Dashboard — open patient search flow
    openPatientSearchModal();
  }
}

document.addEventListener('DOMContentLoaded', setupAppointmentsModule);
