// Patients Module - CRUD with LocalStorage

const STORAGE_KEY = 'medsolution.patients';

const patientsState = {
  patients: [],
  editingId: null,
  searchTerm: '',
  registrationDate: '',
};

// ── Auth helper (mirrors auth.js without ES module import) ────────────────────

function getAuthUser() {
  try {
    const raw = sessionStorage.getItem('medsolution.authUser') || localStorage.getItem('medsolution.authUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function authCan(feature) {
  const user = getAuthUser();
  if (!user) return false;
  const permissions = {
    'patients.edit':   ['Administrador', 'Médico'],
    'patients.delete': ['Administrador', 'Médico'],
  };
  return Boolean(permissions[feature]?.includes(user.role));
}

// ── Persistence ──────────────────────────────────────────────────────────────

async function loadPatients() {
  if (window.MedSolutionData?.isConfigured()) {
    patientsState.patients = await window.MedSolutionData.getPatients();
    savePatients();
    return;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    patientsState.patients = stored ? JSON.parse(stored) : getSeedData();
    if (!stored) savePatients();
  } catch {
    patientsState.patients = [];
  }
}

function savePatients() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patientsState.patients));
}

function getSeedData() {
  return [
    {
      id: 1,
      nombre: 'María Fernanda',
      apellido: 'López',
      ci: '12345678',
      fechaNacimiento: '1985-03-22',
      genero: 'Femenino',
      telefono: '0412-5551234',
      email: 'mflopez@email.com',
      direccion: 'Av. Principal, Caracas',
      registrado: '2025-06-17',
    },
    {
      id: 2,
      nombre: 'Carlos Alberto',
      apellido: 'Rojas',
      ci: '87654321',
      fechaNacimiento: '1978-08-10',
      genero: 'Masculino',
      telefono: '0414-5559876',
      email: 'carojas@email.com',
      direccion: 'Calle 5, Valencia',
      registrado: '2025-06-16',
    },
    {
      id: 3,
      nombre: 'Ana Gabriela',
      apellido: 'Méndez',
      ci: '11223344',
      fechaNacimiento: '1993-11-05',
      genero: 'Femenino',
      telefono: '0416-5553344',
      email: 'agmendez@email.com',
      direccion: 'Urb. Los Jardines, Maracay',
      registrado: '2025-06-15',
    },
  ];
}

function nextId() {
  const ids = patientsState.patients.map((p) => p.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// ── Render ───────────────────────────────────────────────────────────────────

function getInitials(nombre, apellido) {
  return (((nombre?.[0] || '') + (apellido?.[0] || '')).toUpperCase());
}

function getCurrentDateISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function renderTable() {
  const tbody = document.getElementById('patientsTableBody');
  if (!tbody) return;

  const term = patientsState.searchTerm.toLowerCase();
  const visible = patientsState.patients.filter((p) => {
    if (patientsState.registrationDate && p.registrado !== patientsState.registrationDate) return false;
    if (!term) return true;
    return (
      String(p.nombre || '').toLowerCase().includes(term) ||
      String(p.apellido || '').toLowerCase().includes(term) ||
      String(p.ci || '').toLowerCase().includes(term) ||
      String(p.telefono || '').toLowerCase().includes(term)
    );
  });

  const emptyRow = document.getElementById('patientsEmptyRow');
  if (emptyRow) emptyRow.style.display = visible.length ? 'none' : '';

  // Keep only data rows (not the empty-row template)
  Array.from(tbody.querySelectorAll('tr[data-patient-row]')).forEach((r) => r.remove());

  visible.forEach((p) => {
    const tr = document.createElement('tr');
    tr.dataset.patientRow = p.id;
    tr.innerHTML = `
      <td>
        <div class="patient-cell">
          <span class="patient-photo">${getInitials(p.nombre, p.apellido)}</span>
          <div>
            <strong>${p.nombre} ${p.apellido}</strong>
            <small>CI: ${p.ci || 'Sin CI'}</small>
          </div>
        </div>
      </td>
      <td>${p.genero || '—'}</td>
      <td>${formatDate(p.fechaNacimiento)}</td>
      <td>${p.telefono || '—'}</td>
      <td>${p.email || '—'}</td>
      <td>${formatDate(p.registrado)}</td>
      <td>
        <span class="action-links">
          <button class="btn-action" data-action="view" data-id="${p.id}" title="Ver">👁</button>
          ${authCan('patients.edit') ? `<button class="btn-action" data-action="edit" data-id="${p.id}" title="Editar">✎</button>` : ''}
          <a class="btn-action" href="appointments.html?action=new&patientId=${p.id}" title="Iniciar nueva atención">✚</a>
          ${['Administrador','Médico'].includes(getAuthUser()?.role) ? `<a class="btn-action" href="medical-records.html?patientId=${p.id}" title="Ver historial clínico">▣</a>` : ''}
          ${authCan('patients.delete') ? `<button class="btn-action btn-action--delete" data-action="delete" data-id="${p.id}" title="Eliminar">✕</button>` : ''}
        </span>
      </td>
    `;
    tbody.insertBefore(tr, emptyRow);
  });

  updateCounter(visible.length);
}

function updateCounter(count) {
  const counter = document.getElementById('patientsCount');
  if (counter) counter.textContent = `${count} paciente${count !== 1 ? 's' : ''}`;
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

function openModal(mode, patient = null) {
  const modal = document.getElementById('patientModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('patientForm');
  if (!modal || !form) return;

  form.reset();
  patientsState.editingId = null;
  showPatientStatus();

  if (mode === 'create') {
    title.textContent = 'Nuevo Paciente';
  } else if (mode === 'edit' && patient) {
    title.textContent = 'Editar Paciente';
    patientsState.editingId = patient.id;
    fillForm(form, patient);
  } else if (mode === 'view' && patient) {
    title.textContent = 'Detalle del Paciente';
    fillForm(form, patient);
    setFormReadOnly(form, true);
    modal.dataset.viewMode = 'true';
  }

  if (mode !== 'view') {
    delete modal.dataset.viewMode;
    setFormReadOnly(form, false);
  }

  const saveBtn = document.getElementById('modalSaveBtn');
  if (saveBtn) saveBtn.style.display = mode === 'view' ? 'none' : '';

  modal.classList.add('nursing-modal--active');
}

function closeModal() {
  const modal = document.getElementById('patientModal');
  const form = document.getElementById('patientForm');
  if (modal) modal.classList.remove('nursing-modal--active');
  if (form) { form.reset(); setFormReadOnly(form, false); }
  patientsState.editingId = null;
  showPatientStatus();
}

function fillForm(form, patient) {
  ['nombre', 'apellido', 'ci', 'fechaNacimiento', 'genero', 'telefono', 'email', 'direccion'].forEach((field) => {
    const el = form.elements[field];
    if (el) el.value = patient[field] || '';
  });
}

function setFormReadOnly(form, readOnly) {
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    el.readOnly = readOnly;
    if (el.tagName === 'SELECT') el.disabled = readOnly;
  });
}

// ── CRUD actions ──────────────────────────────────────────────────────────────

async function handleSave(event) {
  event.preventDefault();
  const form = document.getElementById('patientForm');
  const modal = document.getElementById('patientModal');
  if (!form || modal?.dataset.viewMode) return;
  const saveButton = document.getElementById('modalSaveBtn');
  if (saveButton?.disabled) return;

  const data = {
    nombre: form.elements.nombre.value.trim(),
    apellido: form.elements.apellido.value.trim(),
    ci: form.elements.ci.value.trim(),
    fechaNacimiento: form.elements.fechaNacimiento.value,
    genero: form.elements.genero.value,
    telefono: form.elements.telefono.value.trim(),
    email: form.elements.email.value.trim(),
    direccion: form.elements.direccion.value.trim(),
  };

  if (!data.nombre || !data.apellido) {
    showPatientStatus('Nombre y apellido son los únicos campos obligatorios.', 'error');
    return;
  }

  const duplicate = data.ci && patientsState.patients.find((patient) =>
    String(patient.ci || '').trim() === data.ci
    && Number(patient.id) !== Number(patientsState.editingId));
  if (duplicate) {
    alert(`Ya existe el paciente ${duplicate.nombre} ${duplicate.apellido} con esta cédula.`);
    return;
  }

  let saved;
  let editIndex = -1;
  if (patientsState.editingId !== null) {
    editIndex = patientsState.patients.findIndex((p) => p.id === patientsState.editingId);
    if (editIndex > -1) {
      saved = { ...patientsState.patients[editIndex], ...data };
    }
  } else {
    saved = {
      id: nextId(),
      registrado: getCurrentDateISO(),
      ...data,
    };
  }

  if (!saved) return alert('No se encontró el paciente que deseas guardar.');

  const originalText = saveButton?.textContent || 'Guardar';
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = '⏳ Guardando…';
  }
  try {
    const persisted = window.MedSolutionData?.isConfigured()
      ? await window.MedSolutionData.savePatient(saved)
      : saved;
    const normalized = { ...saved, ...persisted };
    if (editIndex >= 0) patientsState.patients[editIndex] = normalized;
    else patientsState.patients.push(normalized);
    savePatients();
    closeModal();
    renderTable();
    showPatientToast('Paciente guardado correctamente.');
  } catch (error) {
    showPatientStatus(`No se pudo guardar el paciente: ${error.message}`, 'error');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  }
}

function showPatientStatus(message = '', type = 'error') {
  const status = document.getElementById('patientFormStatus');
  if (!status) return;
  status.textContent = message;
  status.style.display = message ? '' : 'none';
  status.style.color = type === 'error' ? '#c93047' : 'var(--aqua)';
}

function showPatientToast(message) {
  let toast = document.getElementById('patientToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'patientToast';
    toast.setAttribute('role', 'status');
    Object.assign(toast.style, {
      position: 'fixed', right: '24px', bottom: '24px', zIndex: '3000',
      padding: '14px 18px', borderRadius: '12px', background: '#dff7f1',
      color: '#0f5f55', boxShadow: '0 12px 30px rgba(15,76,92,.2)', fontWeight: '700',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = '';
  clearTimeout(showPatientToast.timeout);
  showPatientToast.timeout = setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

async function handleDelete(id) {
  if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;
  try {
    if (window.MedSolutionData?.isConfigured()) await window.MedSolutionData.deletePatient(id);
    patientsState.patients = patientsState.patients.filter((p) => p.id !== id);
    savePatients();
    renderTable();
    showPatientToast('Paciente eliminado correctamente.');
  } catch (error) {
    alert(`No se pudo eliminar el paciente: ${error.message}`);
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────

async function setupPatientModule() {
  await window.MedSolutionData?.ready;
  try { await loadPatients(); } catch (error) { alert(`No se pudieron cargar los pacientes: ${error.message}`); return; }
  renderTable();

  // New patient button
  document.getElementById('newPatientBtn')?.addEventListener('click', () => openModal('create'));

  // Modal close buttons
  document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);

  // Overlay click
  document.querySelector('#patientModal .nursing-modal__overlay')?.addEventListener('click', closeModal);

  // Form submit
  document.getElementById('patientForm')?.addEventListener('submit', handleSave);

  // Table action buttons (delegated)
  document.getElementById('patientsTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    const patient = patientsState.patients.find((p) => p.id === id);
    if (!patient) return;
    if (btn.dataset.action === 'view') openModal('view', patient);
    else if (btn.dataset.action === 'edit') openModal('edit', patient);
    else if (btn.dataset.action === 'delete') handleDelete(id).catch((error)=>alert(error.message));
  });

  // Search
  document.getElementById('patientSearch')?.addEventListener('input', (e) => {
    patientsState.searchTerm = e.target.value;
    renderTable();
  });
  document.getElementById('patientRegistrationDate')?.addEventListener('change', (e) => {
    patientsState.registrationDate = e.target.value;
    renderTable();
  });
  const params = new URLSearchParams(location.search);
  const initialSearch = params.get('search');
  if (initialSearch) {
    patientsState.searchTerm = initialSearch;
    document.getElementById('patientSearch').value = initialSearch;
    renderTable();
  }
  const patientId = Number(params.get('patientId'));
  const selectedPatient = patientsState.patients.find((patient) => Number(patient.id) === patientId);
  if (selectedPatient) openModal('view', selectedPatient);
  window.MedSolutionData?.subscribePatients(async () => { await loadPatients(); renderTable(); });
}

document.addEventListener('DOMContentLoaded', setupPatientModule);
