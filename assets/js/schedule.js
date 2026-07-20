// Schedule Module — Agenda Médica (localStorage)

const SCHEDULE_KEY = 'medsolution.appointments';
const PATIENTS_KEY = 'medsolution.patients';

const scheduleState = {
  appointments: [],
  editingId: null,
  filterDate: '',
  filterStatus: '',
  filterPatient: '',
};

// ── Persistence ───────────────────────────────────────────────────────────────

function loadAppointments() {
  try {
    const stored = localStorage.getItem(SCHEDULE_KEY);
    scheduleState.appointments = stored ? JSON.parse(stored) : getScheduleSeed();
    if (!stored) saveAppointments();
  } catch {
    scheduleState.appointments = [];
  }
}

function saveAppointments() {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleState.appointments));
}

function getPatients() {
  try {
    const stored = localStorage.getItem(PATIENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function getScheduleSeed() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { id: 1, patientId: 1, patientName: 'María Fernanda López', date: today, time: '09:00', reason: 'Control general', status: 'Confirmada', createdAt: today },
    { id: 2, patientId: 2, patientName: 'Carlos Alberto Rojas', date: today, time: '10:00', reason: 'Dolor lumbar', status: 'Pendiente', createdAt: today },
    { id: 3, patientId: 3, patientName: 'Ana Gabriela Méndez', date: today, time: '11:30', reason: 'Control prenatal', status: 'Confirmada', createdAt: today },
  ];
}

function nextScheduleId() {
  const ids = scheduleState.appointments.map((a) => a.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// ── Render ────────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  Confirmada: 'badge--confirmed',
  Pendiente: 'badge--pending',
  Atendida: 'badge--attended',
  Cancelada: 'badge--cancelled',
};

function renderSchedule() {
  const tbody = document.getElementById('scheduleTableBody');
  if (!tbody) return;

  const fd = scheduleState.filterDate;
  const fs = scheduleState.filterStatus;
  const fp = scheduleState.filterPatient.toLowerCase();

  const visible = scheduleState.appointments.filter((a) => {
    if (fd && a.date !== fd) return false;
    if (fs && a.status !== fs) return false;
    if (fp && !a.patientName.toLowerCase().includes(fp)) return false;
    return true;
  });

  // Sort by date then time
  visible.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const emptyRow = document.getElementById('scheduleEmptyRow');
  if (emptyRow) emptyRow.style.display = visible.length ? 'none' : '';

  Array.from(tbody.querySelectorAll('tr[data-appt-row]')).forEach((r) => r.remove());

  visible.forEach((a) => {
    const tr = document.createElement('tr');
    tr.dataset.apptRow = a.id;
    const badgeClass = STATUS_BADGE[a.status] || '';
    tr.innerHTML = `
      <td><strong>${formatDisplayDate(a.date)}</strong></td>
      <td><strong>${a.time}</strong></td>
      <td>
        <div class="patient-cell">
          <span class="patient-photo">${getInitials(a.patientName)}</span>
          <span>${a.patientName}</span>
        </div>
      </td>
      <td>${a.reason}</td>
      <td><span class="badge ${badgeClass}">${a.status}</span></td>
      <td>
        <span class="action-links">
          <button class="btn-action" data-action="attend" data-id="${a.id}" title="Iniciar atención">▶</button>
          <button class="btn-action" data-action="edit" data-id="${a.id}" title="Editar">✎</button>
          <button class="btn-action btn-action--delete" data-action="delete" data-id="${a.id}" title="Cancelar">✕</button>
        </span>
      </td>
    `;
    tbody.insertBefore(tr, emptyRow);
  });

  updateScheduleCounter(visible.length);
}

function updateScheduleCounter(count) {
  const el = document.getElementById('scheduleCount');
  if (el) el.textContent = `${count} cita${count !== 1 ? 's' : ''}`;
}

function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ── Populate patient select ───────────────────────────────────────────────────

function populatePatientSelect(selectedId = null) {
  const select = document.getElementById('apptPatientSelect');
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

function openScheduleModal(mode, appt = null) {
  const modal = document.getElementById('scheduleModal');
  const title = document.getElementById('scheduleModalTitle');
  const form = document.getElementById('scheduleForm');
  if (!modal || !form) return;

  form.reset();
  scheduleState.editingId = null;
  populatePatientSelect(appt?.patientId);

  if (mode === 'create') {
    title.textContent = 'Nueva Cita';
    // Default to today
    const dateInput = form.elements.date;
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  } else if (mode === 'edit' && appt) {
    title.textContent = 'Editar Cita';
    scheduleState.editingId = appt.id;
    fillScheduleForm(form, appt);
  }

  modal.classList.add('nursing-modal--active');
}

function closeScheduleModal() {
  const modal = document.getElementById('scheduleModal');
  const form = document.getElementById('scheduleForm');
  if (modal) modal.classList.remove('nursing-modal--active');
  if (form) form.reset();
  scheduleState.editingId = null;
}

function fillScheduleForm(form, appt) {
  if (form.elements.date) form.elements.date.value = appt.date || '';
  if (form.elements.time) form.elements.time.value = appt.time || '';
  if (form.elements.reason) form.elements.reason.value = appt.reason || '';
  if (form.elements.status) form.elements.status.value = appt.status || 'Pendiente';
  // Patient select is already populated; set value
  const select = document.getElementById('apptPatientSelect');
  if (select) select.value = appt.patientId;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function handleScheduleSave(event) {
  event.preventDefault();
  const form = document.getElementById('scheduleForm');
  if (!form) return;

  const select = document.getElementById('apptPatientSelect');
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
    reason: form.elements.reason.value.trim(),
    status: form.elements.status.value,
  };

  if (!data.date || !data.time || !data.reason) {
    alert('Completa todos los campos requeridos.');
    return;
  }

  if (scheduleState.editingId !== null) {
    const idx = scheduleState.appointments.findIndex((a) => a.id === scheduleState.editingId);
    if (idx > -1) scheduleState.appointments[idx] = { ...scheduleState.appointments[idx], ...data };
  } else {
    scheduleState.appointments.push({
      id: nextScheduleId(),
      createdAt: new Date().toISOString().slice(0, 10),
      ...data,
    });
  }

  saveAppointments();
  closeScheduleModal();
  renderSchedule();
}

function handleScheduleDelete(id) {
  if (!confirm('¿Cancelar esta cita?')) return;
  const idx = scheduleState.appointments.findIndex((a) => a.id === id);
  if (idx > -1) {
    scheduleState.appointments[idx].status = 'Cancelada';
    saveAppointments();
    renderSchedule();
  }
}

function handleAttend(id) {
  // Mark as Atendida and redirect to Nueva Atención with patientId param
  const appt = scheduleState.appointments.find((a) => a.id === id);
  if (!appt) return;
  appt.status = 'Atendida';
  saveAppointments();
  window.location.href = `appointments.html?patientId=${appt.patientId}&appointmentId=${appt.id}`;
}

// ── Events ────────────────────────────────────────────────────────────────────

function setupScheduleModule() {
  loadAppointments();
  renderSchedule();

  document.getElementById('newApptBtn')?.addEventListener('click', () => openScheduleModal('create'));
  document.getElementById('closeScheduleModalBtn')?.addEventListener('click', closeScheduleModal);
  document.getElementById('cancelScheduleModalBtn')?.addEventListener('click', closeScheduleModal);
  document.querySelector('#scheduleModal .nursing-modal__overlay')?.addEventListener('click', closeScheduleModal);
  document.getElementById('scheduleForm')?.addEventListener('submit', handleScheduleSave);

  // Filters
  document.getElementById('filterDate')?.addEventListener('input', (e) => {
    scheduleState.filterDate = e.target.value;
    renderSchedule();
  });
  document.getElementById('filterStatus')?.addEventListener('change', (e) => {
    scheduleState.filterStatus = e.target.value;
    renderSchedule();
  });
  document.getElementById('filterPatient')?.addEventListener('input', (e) => {
    scheduleState.filterPatient = e.target.value;
    renderSchedule();
  });

  // Table delegation
  document.getElementById('scheduleTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    const appt = scheduleState.appointments.find((a) => a.id === id);
    if (!appt) return;
    if (btn.dataset.action === 'edit') openScheduleModal('edit', appt);
    else if (btn.dataset.action === 'delete') handleScheduleDelete(id);
    else if (btn.dataset.action === 'attend') handleAttend(id);
  });
}

document.addEventListener('DOMContentLoaded', setupScheduleModule);
