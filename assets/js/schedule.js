// Schedule Module — Agenda Médica (localStorage)

const SCHEDULE_KEY = 'medsolution.appointments';
const PATIENTS_KEY = 'medsolution.patients';

const scheduleState = {
  appointments: [],
  editingId: null,
  filterDate: '',
  filterStatus: '',
  filterPatient: '',
  filterTiming: '',
  calendarView: 'month',
  calendarDate: new Date(),
  patients: [],
  services: [],
  staff: [],
};

// ── Auth helper ───────────────────────────────────────────────────────────────

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
    'schedule.edit':   ['Administrador', 'Médico', 'Auxiliar'],
    'schedule.delete': ['Administrador', 'Médico'],
  };
  return Boolean(permissions[feature]?.includes(user.role));
}

// ── Persistence ───────────────────────────────────────────────────────────────

function loadAppointments() {
  try {
    const stored = localStorage.getItem(SCHEDULE_KEY);
    scheduleState.appointments = (stored ? JSON.parse(stored) : getScheduleSeed()).map((item) => ({
      ...item,
      status: item.status === 'Pendiente' ? 'Programada' : (item.status || 'Programada'),
      observations: item.observations || item.reason || '',
      serviceId: item.serviceId || scheduleState.services.find((service)=>service.requires_medical_consultation)?.id || '',
      serviceName: item.serviceName || scheduleState.services.find((service)=>service.requires_medical_consultation)?.name || '',
      professional: item.professional || scheduleState.staff.find((person)=>/doctor|médic|medic/i.test(person.position||''))?.name || '',
    }));
    if (!stored) saveAppointments();
  } catch {
    scheduleState.appointments = [];
  }
}

function saveAppointments() {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleState.appointments));
}

function getPatients() {
  return scheduleState.patients;
}

function getScheduleSeed() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { id: 1, patientId: 1, patientName: 'María Fernanda López', date: today, time: '09:00', reason: 'Control general', status: 'Confirmada', createdAt: today },
    { id: 2, patientId: 2, patientName: 'Carlos Alberto Rojas', date: today, time: '10:00', reason: 'Dolor lumbar', status: 'Programada', createdAt: today },
    { id: 3, patientId: 3, patientName: 'Ana Gabriela Méndez', date: today, time: '11:30', reason: 'Control prenatal', status: 'Confirmada', createdAt: today },
  ];
}

function nextScheduleId() {
  const ids = scheduleState.appointments.map((a) => a.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// ── Render ────────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  Programada: 'badge--programmed',
  Confirmada: 'badge--confirmed',
  Reprogramada: 'badge--rescheduled',
  Atendida: 'badge--attended',
  Cancelada: 'badge--cancelled',
};

function renderSchedule() {
  const tbody = document.getElementById('scheduleTableBody');
  if (!tbody) return;

  const fd = scheduleState.filterDate;
  const fs = scheduleState.filterStatus;
  const fp = scheduleState.filterPatient.toLowerCase();
  const ft = scheduleState.filterTiming;
  const today = new Date().toISOString().slice(0, 10);

  const visible = scheduleState.appointments.filter((a) => {
    if (fd && a.date !== fd) return false;
    if (fs && a.status !== fs) return false;
    if (fp && !a.patientName.toLowerCase().includes(fp)) return false;
    if (ft === 'upcoming' && a.date < today) return false;
    if (ft === 'expired' && (a.date >= today || ['Atendida','Cancelada'].includes(a.status))) return false;
    return true;
  });

  // Sort by date then time
  visible.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

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
      <td><strong>${a.serviceName || a.reason || 'Sin servicio'}</strong><br><small>${a.professional || 'Sin profesional'}</small></td>
      <td><span class="badge ${badgeClass}">${a.status}</span></td>
      <td>
        <span class="action-links">
          ${!['Atendida','Cancelada'].includes(a.status) ? `<button class="btn btn--primary" style="padding:7px 10px;font-size:.75rem" data-action="attend" data-id="${a.id}" title="Iniciar atención">Iniciar atención</button>` : ''}
          ${authCan('schedule.edit') && !['Atendida','Cancelada'].includes(a.status) ? `<button class="btn-action" data-action="edit" data-id="${a.id}" title="Reprogramar">✎</button>` : ''}
          ${authCan('schedule.delete') ? `<button class="btn-action btn-action--delete" data-action="delete" data-id="${a.id}" title="Cancelar">✕</button>` : ''}
        </span>
      </td>
    `;
    tbody.insertBefore(tr, emptyRow);
  });

  updateScheduleCounter(visible.length);
  renderCalendar();
}

function isoLocal(date) { return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function startOfWeek(date) { const value=new Date(date);const offset=(value.getDay()+6)%7;value.setDate(value.getDate()-offset);value.setHours(12,0,0,0);return value; }
function calendarDates() {
  const current=new Date(scheduleState.calendarDate);
  if(scheduleState.calendarView==='day') return [current];
  if(scheduleState.calendarView==='week'){const start=startOfWeek(current);return Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date})}
  const first=new Date(current.getFullYear(),current.getMonth(),1,12);const start=startOfWeek(first);return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date});
}
function renderCalendar() {
  const target=document.getElementById('scheduleCalendar');if(!target)return;
  const dates=calendarDates(),view=scheduleState.calendarView,today=isoLocal(new Date());
  target.className=`calendar-grid calendar-grid--${view}`;target.style.setProperty('--calendar-columns',view==='day'?1:7);
  const headers=view==='day'?['Día']:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  target.innerHTML=headers.map(label=>`<div class="calendar-day-head">${label}</div>`).join('')+dates.map(date=>{const iso=isoLocal(date);const outside=view==='month'&&date.getMonth()!==scheduleState.calendarDate.getMonth();const items=scheduleState.appointments.filter(item=>item.date===iso).sort((a,b)=>String(a.time).localeCompare(String(b.time)));return `<div class="calendar-day ${outside?'calendar-day--outside':''} ${iso===today?'calendar-day--today':''}" data-calendar-date="${iso}"><strong>${date.getDate()}</strong>${items.map(item=>`<span class="calendar-event calendar-event--${item.status}" title="${item.patientName}">${item.time} · ${item.patientName}</span>`).join('')}</div>`}).join('');
  const label=document.getElementById('calendarPeriodLabel');
  label.textContent=view==='day'?scheduleState.calendarDate.toLocaleDateString('es',{dateStyle:'full'}):view==='week'?`Semana del ${formatDisplayDate(isoLocal(dates[0]))}`:scheduleState.calendarDate.toLocaleDateString('es',{month:'long',year:'numeric'});
  document.querySelectorAll('[data-calendar-view]').forEach(button=>button.classList.toggle('active',button.dataset.calendarView===view));
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

function populateScheduleCatalog(appt = null) {
  const service=document.getElementById('scheduleServiceSelect');
  service.innerHTML='<option value="">Seleccionar servicio…</option>'+scheduleState.services.map(item=>`<option value="${item.id}">${item.name}</option>`).join('');
  const professional=document.getElementById('scheduleProfessionalSelect');
  professional.innerHTML='<option value="">Seleccionar profesional…</option>'+scheduleState.staff.map(item=>`<option value="${item.name}">${item.name}</option>`).join('');
  if(appt?.serviceId)service.value=appt.serviceId;if(appt?.professional)professional.value=appt.professional;
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
  populateScheduleCatalog(appt);

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
  if (form.elements.observations) form.elements.observations.value = appt.observations || appt.reason || '';
  if (form.elements.status) form.elements.status.value = appt.status || 'Programada';
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
    serviceId: form.elements.serviceId.value,
    serviceName: scheduleState.services.find((item)=>String(item.id)===String(form.elements.serviceId.value))?.name || '',
    professional: form.elements.professional.value,
    observations: form.elements.observations.value.trim(),
    status: form.elements.status.value,
  };

  if (!data.date || !data.time || !data.serviceId || !data.professional) {
    alert('Completa todos los campos requeridos.');
    return;
  }

  if (scheduleState.editingId !== null) {
    const idx = scheduleState.appointments.findIndex((a) => a.id === scheduleState.editingId);
    if (idx > -1) {
      const previous=scheduleState.appointments[idx];
      if((previous.date!==data.date||previous.time!==data.time)&&!['Cancelada','Atendida'].includes(previous.status))data.status='Reprogramada';
      scheduleState.appointments[idx] = { ...previous, ...data };
    }
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
  window.location.href = `appointments.html?appointmentId=${appt.id}&startScheduled=1`;
}

// ── Events ────────────────────────────────────────────────────────────────────

async function setupScheduleModule() {
  await window.MedSolutionData?.ready;
  try {
    [scheduleState.patients,scheduleState.services,scheduleState.staff]=await Promise.all([window.MedSolutionData.getPatients(),window.MedSolutionData.getServices(false),window.MedSolutionData.getStaff()]);
    localStorage.setItem(PATIENTS_KEY,JSON.stringify(scheduleState.patients));
  } catch(error) { alert(`No se pudo cargar la agenda: ${error.message}`);return; }
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
  document.getElementById('filterTiming')?.addEventListener('change',(e)=>{scheduleState.filterTiming=e.target.value;renderSchedule()});
  document.querySelectorAll('[data-calendar-view]').forEach(button=>button.addEventListener('click',()=>{scheduleState.calendarView=button.dataset.calendarView;renderCalendar()}));
  document.getElementById('todayCalendarBtn')?.addEventListener('click',()=>{scheduleState.calendarDate=new Date();renderCalendar()});
  document.getElementById('previousCalendarBtn')?.addEventListener('click',()=>{const date=scheduleState.calendarDate;if(scheduleState.calendarView==='day')date.setDate(date.getDate()-1);else if(scheduleState.calendarView==='week')date.setDate(date.getDate()-7);else{date.setDate(1);date.setMonth(date.getMonth()-1)}renderCalendar()});
  document.getElementById('nextCalendarBtn')?.addEventListener('click',()=>{const date=scheduleState.calendarDate;if(scheduleState.calendarView==='day')date.setDate(date.getDate()+1);else if(scheduleState.calendarView==='week')date.setDate(date.getDate()+7);else{date.setDate(1);date.setMonth(date.getMonth()+1)}renderCalendar()});
  document.getElementById('scheduleCalendar')?.addEventListener('dblclick',(event)=>{const day=event.target.closest('[data-calendar-date]');if(day){openScheduleModal('create');document.querySelector('#scheduleForm [name="date"]').value=day.dataset.calendarDate}});

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
  if(new URLSearchParams(location.search).get('action')==='new')openScheduleModal('create');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupScheduleModule, { once: true });
else setupScheduleModule();
