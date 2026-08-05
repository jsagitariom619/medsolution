// Schedule Module — Agenda Médica (fuente única: public.atenciones)

const PATIENTS_KEY = 'medsolution.patients';

const scheduleState = {
  appointments: [],
  editingId: null,
  filters: { service: '', responsible: '', month: '', year: '' },
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

async function loadAppointments() {
  try {
    const attentions = await window.MedSolutionData.getAttentions();
    scheduleState.appointments = attentions
      .filter((item) => item.contraceptiveControl !== true)
      .map((item) => ({
        ...item,
        serviceName: item.serviceType || 'Sin servicio',
        professional: item.scheduledProfessional || item.procedureResponsible || '',
        observations: item.appointmentObservations || item.observations || '',
        status: item.scheduleStatus || normalizeScheduleStatus(item.status),
        attentionId: item.id,
      }));
  } catch (error) {
    scheduleState.appointments = [];
    throw error;
  }
}

function normalizeScheduleStatus(status) {
  return ({
    'Pendiente de consulta': 'Pendiente',
    'En consulta': 'En Atención',
    Finalizada: 'Atendida',
  })[status] || status || 'Pendiente';
}

function scheduleDateTimeIso(date, time) {
  const value = new Date(`${date}T${String(time || '00:00').slice(0, 5)}:00-04:00`);
  if (Number.isNaN(value.getTime())) throw new Error('La fecha u hora de la cita no es válida.');
  return value.toISOString();
}

function databaseAttentionStatus(status) {
  return ({
    'En Atención': 'En consulta',
    Atendida: 'Finalizada',
    Reprogramada: 'Pendiente',
  })[status] || status || 'Pendiente';
}

function getPatients() {
  return scheduleState.patients;
}

// ── Render ────────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  Pendiente: 'badge--pending',
  'En Atención': 'badge--in-progress',
  Reprogramada: 'badge--rescheduled',
  Atendida: 'badge--attended',
  Cancelada: 'badge--cancelled',
};

function renderSchedule() {
  const tbody = document.getElementById('scheduleTableBody');
  if (!tbody) return;

  const visible = filteredAppointments();

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

function filteredAppointments(){
  const filters=scheduleState.filters;
  return scheduleState.appointments.filter(item=>(!filters.service||item.serviceName===filters.service)&&(!filters.responsible||item.professional===filters.responsible)&&(!filters.month||String(item.date||'').slice(5,7)===filters.month)&&(!filters.year||String(item.date||'').slice(0,4)===filters.year));
}
function populateScheduleFilters(){
  const definitions=[['filterService','Todos los servicios',[...new Set(scheduleState.appointments.map(item=>item.serviceName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))],['filterResponsible','Todos los responsables',[...new Set(scheduleState.appointments.map(item=>item.professional).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))],['filterMonth','Todos los meses',[...new Set(scheduleState.appointments.map(item=>String(item.date||'').slice(5,7)).filter(Boolean))].sort()],['filterYear','Todos los años',[...new Set(scheduleState.appointments.map(item=>String(item.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a))]];
  definitions.forEach(([id,label,values])=>{const select=document.getElementById(id);if(!select)return;const current=select.value;select.innerHTML=`<option value="">${label}</option>`+values.map(value=>`<option value="${value}">${id==='filterMonth'?new Intl.DateTimeFormat('es',{month:'long'}).format(new Date(2024,Number(value)-1,1)):value}</option>`).join('');select.value=current});
}

function isoLocal(date) { const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`; }
function startOfWeek(date) { const value=new Date(date);const offset=(value.getDay()+6)%7;value.setDate(value.getDate()-offset);value.setHours(12,0,0,0);return value; }
function calendarDates() {
  const current=new Date(scheduleState.calendarDate);
  if(scheduleState.calendarView==='day') return [current];
  if(scheduleState.calendarView==='week'){const start=startOfWeek(current);return Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date})}
  const first=new Date(current.getFullYear(),current.getMonth(),1,12);const start=startOfWeek(first);return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date});
}
function renderCalendar() {
  const target=document.getElementById('scheduleCalendar');if(!target)return;
  const dates=calendarDates(),view=scheduleState.calendarView,today=isoLocal(new Date()),visible=filteredAppointments();
  target.className=`calendar-grid calendar-grid--${view}`;target.style.setProperty('--calendar-columns',view==='day'?1:7);
  const headers=view==='day'?['Día']:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  target.innerHTML=headers.map(label=>`<div class="calendar-day-head">${label}</div>`).join('')+dates.map(date=>{const iso=isoLocal(date);const outside=view==='month'&&date.getMonth()!==scheduleState.calendarDate.getMonth();const items=visible.filter(item=>item.date===iso).sort((a,b)=>String(a.time).localeCompare(String(b.time)));return `<div class="calendar-day ${outside?'calendar-day--outside':''} ${iso===today?'calendar-day--today':''}" data-calendar-date="${iso}"><strong>${date.getDate()}</strong>${items.map(item=>`<span class="calendar-event calendar-event--${item.status}" title="${item.patientName}">${item.time} · ${item.patientName}</span>`).join('')}</div>`}).join('');
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
    if (dateInput) dateInput.value = isoLocal(new Date());
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
  if (form.elements.status) form.elements.status.value = appt.status || 'Pendiente';
  // Patient select is already populated; set value
  const select = document.getElementById('apptPatientSelect');
  if (select) select.value = appt.patientId;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function handleScheduleSave(event) {
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

  const submitButton=form.querySelector('[type="submit"]');submitButton.disabled=true;submitButton.textContent='Guardando…';
  try {
    if (scheduleState.editingId !== null) {
      const previous=scheduleState.appointments.find((a) => a.id === scheduleState.editingId);
      if (!previous) throw new Error('No se encontró la cita a editar.');
      if((previous.date!==data.date||previous.time!==data.time)&&!['Cancelada','Atendida'].includes(previous.status))data.status='Reprogramada';
      await window.MedSolutionData.saveAttention({
        ...previous,
        ...data,
        serviceType: data.serviceName,
        procedureResponsible: data.professional,
        scheduledProfessional: data.professional,
        appointmentObservations: data.observations,
        scheduleStatus: data.status,
        status: databaseAttentionStatus(data.status),
        createdAt: scheduleDateTimeIso(data.date, data.time),
      });
    } else {
      const service = scheduleState.services.find((item) => String(item.id) === String(data.serviceId));
      await window.MedSolutionData.saveAttention({
        ...data,
        serviceType: data.serviceName,
        servicePrice: Number(service?.price || 0),
        requiresMedicalConsultation: Boolean(service?.requires_medical_consultation),
        generatesMedicalRecord: Boolean(service?.generates_medical_record),
        procedureResponsible: data.professional,
        scheduledProfessional: data.professional,
        appointmentObservations: data.observations,
        scheduleStatus: data.status,
        status: databaseAttentionStatus(data.status),
        chiefComplaint: '',
        createdAt: scheduleDateTimeIso(data.date, data.time),
        registeredBy: getAuthUser()?.name || '',
      });
    }
    await loadAppointments();closeScheduleModal();renderSchedule();
  } catch(error) { alert(`No se pudo guardar la cita: ${error.message}`); }
  finally { submitButton.disabled=false;submitButton.textContent='Guardar Cita'; }
}

async function handleScheduleDelete(id) {
  if (!confirm('¿Cancelar esta cita?')) return;
  try {
    const appointment = scheduleState.appointments.find((item) => Number(item.id) === Number(id));
    if (!appointment) throw new Error('No se encontró la atención programada.');
    await window.MedSolutionData.saveAttention({ ...appointment, status: 'Cancelada', scheduleStatus: 'Cancelada' });
    await loadAppointments();renderSchedule();
  }
  catch(error) { alert(`No se pudo cancelar la cita: ${error.message}`); }
}

async function handleAttend(id) {
  const appt = scheduleState.appointments.find((a) => a.id === id);
  if (!appt) return;
  try {
    if (appt.requiresMedicalConsultation !== false) {
      await window.MedSolutionData.ensureMedicalRecord(appt.patientId);
    }
    await window.MedSolutionData.saveAttention({
      ...appt,
      status: 'En consulta',
      scheduleStatus: 'En Atención',
      acceptedAt: new Date().toISOString(),
    });
  }
  catch(error) { alert(`No se pudo iniciar la atención: ${error.message}`);return; }
  window.location.href = `appointments.html?consultationId=${appt.id}`;
}

// ── Events ────────────────────────────────────────────────────────────────────

async function setupScheduleModule() {
  await window.MedSolutionData?.ready;
  try {
    [scheduleState.patients,scheduleState.services,scheduleState.staff]=await Promise.all([window.MedSolutionData.getPatients(),window.MedSolutionData.getServices(false),window.MedSolutionData.getStaff()]);
    localStorage.setItem(PATIENTS_KEY,JSON.stringify(scheduleState.patients));
    await loadAppointments();
  } catch(error) { alert(`No se pudo cargar la agenda: ${error.message}`);return; }
  populateScheduleFilters();renderSchedule();

  document.getElementById('newApptBtn')?.addEventListener('click', () => openScheduleModal('create'));
  document.getElementById('closeScheduleModalBtn')?.addEventListener('click', closeScheduleModal);
  document.getElementById('cancelScheduleModalBtn')?.addEventListener('click', closeScheduleModal);
  document.querySelector('#scheduleModal .nursing-modal__overlay')?.addEventListener('click', closeScheduleModal);
  document.getElementById('scheduleForm')?.addEventListener('submit', handleScheduleSave);

  // Filters
  [['filterService','service'],['filterResponsible','responsible'],['filterMonth','month'],['filterYear','year']].forEach(([id,key])=>document.getElementById(id)?.addEventListener('change',event=>{scheduleState.filters[key]=event.target.value;renderSchedule()}));
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
  scheduleState.unsubscribeAttentions = window.MedSolutionData.subscribeAttentions(async () => {
    try { await loadAppointments();populateScheduleFilters();renderSchedule(); }
    catch(error) { console.error('[Agenda] No se pudo actualizar:', error); }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupScheduleModule, { once: true });
else setupScheduleModule();
