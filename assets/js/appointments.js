// Appointments Module — Nueva Atención / Consulta (localStorage)

const CONSULT_KEY = 'medsolution.consultations';
const PATIENTS_KEY = 'medsolution.patients';
const SCHEDULE_KEY = 'medsolution.appointments';

const consultState = {
  consultations: [],
  editingId: null,
  searchTerm: '',
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

function nextConsultId() {
  const ids = consultState.consultations.map((c) => c.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// ── URL params ────────────────────────────────────────────────────────────────

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Render ────────────────────────────────────────────────────────────────────

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

// ── Patient select ────────────────────────────────────────────────────────────

function populatePatientSelect(selectedId = null) {
  const select = document.getElementById('consultPatientSelect');
  if (!select) return;
  const patients = getPatients();
  select.innerHTML = '<option value="">Seleccionar paciente…</option>';
  patients.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.nombre} ${p.apellido}`;
    if (selectedId && p.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openConsultModal(mode, consult = null) {
  const modal = document.getElementById('consultModal');
  const title = document.getElementById('consultModalTitle');
  const form = document.getElementById('consultForm');
  if (!modal || !form) return;

  form.reset();
  consultState.editingId = null;
  populatePatientSelect(consult?.patientId);
  setConsultFormReadOnly(form, false);

  const saveBtn = document.getElementById('consultSaveBtn');

  if (mode === 'create') {
    title.textContent = 'Nueva Atención';
    if (form.elements.date) form.elements.date.value = new Date().toISOString().slice(0, 10);
    if (form.elements.time) form.elements.time.value = new Date().toTimeString().slice(0, 5);
    if (saveBtn) saveBtn.style.display = '';
  } else if (mode === 'edit' && consult) {
    title.textContent = 'Editar Consulta';
    consultState.editingId = consult.id;
    fillConsultForm(form, consult);
    if (saveBtn) saveBtn.style.display = '';
  } else if (mode === 'view' && consult) {
    title.textContent = 'Detalle de Consulta';
    fillConsultForm(form, consult);
    setConsultFormReadOnly(form, true);
    if (saveBtn) saveBtn.style.display = 'none';
  }

  modal.classList.add('nursing-modal--active');
}

function closeConsultModal() {
  const modal = document.getElementById('consultModal');
  const form = document.getElementById('consultForm');
  if (modal) modal.classList.remove('nursing-modal--active');
  if (form) { form.reset(); setConsultFormReadOnly(form, false); }
  consultState.editingId = null;
}

function fillConsultForm(form, c) {
  if (form.elements.date) form.elements.date.value = c.date || '';
  if (form.elements.time) form.elements.time.value = c.time || '';
  const select = document.getElementById('consultPatientSelect');
  if (select) select.value = c.patientId || '';
  ['bp', 'hr', 'temp', 'weight', 'height', 'spo2', 'chiefComplaint', 'physicalExam', 'diagnosis', 'treatment', 'observations'].forEach((f) => {
    if (form.elements[f]) form.elements[f].value = c[f] || '';
  });
}

function setConsultFormReadOnly(form, readOnly) {
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    el.readOnly = readOnly;
    if (el.tagName === 'SELECT') el.disabled = readOnly;
  });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function handleConsultSave(event) {
  event.preventDefault();
  const form = document.getElementById('consultForm');
  if (!form) return;

  const select = document.getElementById('consultPatientSelect');
  const patientId = parseInt(select?.value, 10);
  const patientName = select?.options[select.selectedIndex]?.text || '';

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

  // Pre-fill patient if redirected from agenda
  const prePatientId = parseInt(getUrlParam('patientId'), 10);
  const hasPrePatient = !isNaN(prePatientId) && prePatientId > 0;

  document.getElementById('newConsultBtn')?.addEventListener('click', () => {
    openConsultModal('create');
    if (hasPrePatient) {
      const select = document.getElementById('consultPatientSelect');
      if (select) select.value = prePatientId;
    }
  });

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

  // Auto-open modal if redirected from agenda with a patient pre-selected
  if (hasPrePatient) {
    openConsultModal('create');
    const select = document.getElementById('consultPatientSelect');
    if (select) select.value = prePatientId;
  }
}

document.addEventListener('DOMContentLoaded', setupAppointmentsModule);
