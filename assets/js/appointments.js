// MedSolution — Flujo único de atención (Recepción → Médico → Historia clínica)
// Mantiene las claves existentes para conservar todos los datos ya registrados.

const CONSULT_KEY = 'medsolution.consultations';
const PATIENTS_KEY = 'medsolution.patients';
const RECORDS_KEY = 'medsolution.medicalRecords';
const consultState = {
  consultations: [],
  services: [],
  staff: [],
  patients: [],
  editingId: null,
  mode: 'create',
  unsubscribeAttentions: null,
  unsubscribeServices: null,
  unsubscribePatients: null,
  selectedServiceId: null,
  pendingPatient: null,
  saving: false,
  monthView: false,
  monthFilters: { service: '', responsible: '', month: '', year: '' },
};

function getAuthUser() {
  try {
    const raw = sessionStorage.getItem('medsolution.authUser') || localStorage.getItem('medsolution.authUser');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function isDoctor() {
  return ['Administrador', 'Médico'].includes(getAuthUser()?.role);
}

function authCan(feature) {
  const role = getAuthUser()?.role;
  const permissions = {
    'appointments.create': ['Administrador', 'Médico', 'Auxiliar'],
    'appointments.edit': ['Administrador', 'Médico', 'Auxiliar'],
    'appointments.delete': ['Administrador', 'Médico'],
  };
  return Boolean(permissions[feature]?.includes(role));
}

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

async function loadConsultations() {
  const remote = window.MedSolutionData?.isConfigured()
    ? await window.MedSolutionData.getAttentions()
    : readArray(CONSULT_KEY);
  consultState.consultations = remote.map((item) => ({
    serviceType: item.serviceType || 'Servicio anterior',
    status: item.status || (item.diagnosis || item.treatment ? 'Finalizada' : 'Pendiente'),
    ...item,
  }));
  localStorage.setItem(CONSULT_KEY, JSON.stringify(consultState.consultations));
}

async function saveConsultations(changed = null) {
  if (changed) await window.MedSolutionData.saveAttention(changed);
  localStorage.setItem(CONSULT_KEY, JSON.stringify(consultState.consultations));
  window.dispatchEvent(new CustomEvent('medsolution:consultations-updated'));
}

function getPatients() { return consultState.patients.length ? consultState.patients : readArray(PATIENTS_KEY); }
function savePatientsToStorage(items) { localStorage.setItem(PATIENTS_KEY, JSON.stringify(items)); }
function nextId(items) {
  const numeric = items.map((item) => Number(item.id)).filter(Number.isFinite);
  return numeric.length ? Math.max(...numeric) + 1 : 1;
}
function getUrlParam(name) { return new URLSearchParams(window.location.search).get(name); }
function boliviaNowParts() {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
  return { date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}` };
}
function getInitials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();
}
function formatDisplayDate(date) {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}
function canViewPrices() { return getAuthUser()?.role !== 'Auxiliar'; }
function showFlowMessage(message, type = 'success') {
  let toast = document.getElementById('attentionFlowToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'attentionFlowToast';
    toast.setAttribute('role', 'status');
    Object.assign(toast.style, {
      position: 'fixed', right: '24px', bottom: '24px', zIndex: '3000',
      maxWidth: '420px', padding: '14px 18px', borderRadius: '12px',
      boxShadow: '0 12px 30px rgba(15,76,92,.2)', fontWeight: '700',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#fde2e2' : '#dff7f1';
  toast.style.color = type === 'error' ? '#9b2c2c' : '#0f5f55';
  toast.style.display = '';
  clearTimeout(showFlowMessage.timeout);
  showFlowMessage.timeout = setTimeout(() => { toast.style.display = 'none'; }, 5000);
}
function setFormStatus(id, message = '', type = 'error') {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.style.color = type === 'error' ? '#c93047' : 'var(--aqua)';
  element.style.display = message ? '' : 'none';
}
function setButtonLoading(button, loading, loadingText = 'Guardando…') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = `⏳ ${loadingText}`;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

function statusClass(status) {
  return {
    Pendiente: 'status-pending',
    'Pendiente de consulta': 'status-pending',
    'En Atención': 'status-progress',
    'En consulta': 'status-progress',
    Atendida: 'status-finished',
    Finalizada: 'status-finished',
    Cancelada: 'status-cancelled',
  }[status] || 'status-pending';
}

function serviceForAttention(attention) {
  return consultState.services.find((service) =>
    String(service.id) === String(attention.serviceId) || service.name === attention.serviceType);
}

function requiresMedical(attention) {
  const service = serviceForAttention(attention);
  return service ? Boolean(service.requires_medical_consultation) :
    attention.requiresMedicalConsultation ?? Boolean(attention.diagnosis || attention.treatment || attention.evolution);
}

function visibleConsultations() {
  return consultState.consultations
    .filter((c) => c.contraceptiveControl !== true && c.contraceptiveSchedule !== true)
    .filter((c) => consultState.monthView || !isDoctor() || requiresMedical(c))
    .filter((c) => consultState.monthView || !isDoctor() || ['Pendiente', 'Pendiente de consulta', 'En Atención', 'En consulta'].includes(c.status))
    .filter((c) => !consultState.monthFilters.service || c.serviceType === consultState.monthFilters.service)
    .filter((c) => !consultState.monthFilters.responsible || (c.procedureResponsible || c.scheduledProfessional || c.registeredBy) === consultState.monthFilters.responsible)
    .filter((c) => !consultState.monthFilters.month || String(c.date||'').slice(5,7) === consultState.monthFilters.month)
    .filter((c) => !consultState.monthFilters.year || String(c.date||'').slice(0,4) === consultState.monthFilters.year)
    .sort((a, b) => {
      if (isDoctor()) return (`${a.date} ${a.time || ''}`).localeCompare(`${b.date} ${b.time || ''}`);
      return (`${b.date} ${b.time || ''}`).localeCompare(`${a.date} ${a.time || ''}`);
    });
}

function rowActions(c) {
  if (!isDoctor() && requiresMedical(c)) {
    return '<small style="color:var(--gray-500);font-weight:700">Enviado al doctor</small>';
  }
  if (isDoctor() && requiresMedical(c)) {
    if (['Pendiente', 'Pendiente de consulta'].includes(c.status)) {
      return `<button class="btn btn--primary" style="padding:8px 12px;font-size:.8rem" data-action="accept" data-id="${c.id}">Aceptar consulta</button>
        <button class="btn-action btn-action--delete" data-action="cancel" data-id="${c.id}" title="Cancelar">✕</button>`;
    }
    if (['En Atención', 'En consulta'].includes(c.status)) {
      return `<button class="btn btn--primary" style="padding:8px 12px;font-size:.8rem" data-action="continue" data-id="${c.id}">Continuar</button>`;
    }
    if (['Atendida', 'Finalizada'].includes(c.status)) {
      return `<button class="btn-action" data-action="view" data-id="${c.id}" title="Ver">👁</button>
        <button class="btn-action" data-action="edit" data-id="${c.id}" title="Corregir">✎</button>
        <a class="btn-action" href="medical-records.html?patientId=${c.patientId}" title="Historia clínica">▣</a>`;
    }
    return `<button class="btn-action" data-action="view" data-id="${c.id}" title="Ver">👁</button>`;
  }
  return `<button class="btn-action" data-action="view" data-id="${c.id}" title="Ver">👁</button>
    ${authCan('appointments.edit') && c.status !== 'Cancelada' ? `<button class="btn-action" data-action="edit" data-id="${c.id}" title="Editar">✎</button>` : ''}
    ${authCan('appointments.delete') ? `<button class="btn-action btn-action--delete" data-action="delete" data-id="${c.id}" title="Eliminar">✕</button>` : ''}`;
}

async function loadCatalog() {
  const [services, staff, patients] = await Promise.all([
    window.MedSolutionData.getServices(false),
    window.MedSolutionData.getStaff(),
    window.MedSolutionData.getPatients(),
  ]);
  consultState.services = services;
  consultState.staff = staff;
  consultState.patients = patients;
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
  renderServiceOptions();
}

function renderServiceOptions(selectedId = '') {
  const select = document.getElementById('serviceType');
  if (!select) return;
  const current = selectedId || select.value;
  const showPrices = canViewPrices();
  select.innerHTML = '<option value="">Seleccionar…</option>' + consultState.services
    .map((service) => `<option value="${escapeHtml(service.id || service.name)}">${escapeHtml(service.name)}${showPrices ? ` · ${Number(service.price || 0).toFixed(2)} Bs` : ''}</option>`).join('');
  if (current) {
    const service = consultState.services.find((item) => String(item.id) === String(current) || item.name === current);
    if (service) select.value = service.id || service.name;
  }
}

function openServicePicker() {
  const grid = document.getElementById('servicePickerGrid');
  if (!consultState.services.length) {
    grid.innerHTML = '<p class="patient-result-empty">No hay servicios activos. Solicita al administrador que configure el Catálogo de Servicios.</p>';
  } else {
    const showPrices = canViewPrices();
    grid.innerHTML = consultState.services.map((service) => `<button class="service-choice" type="button" data-choose-service="${escapeHtml(service.id || service.name)}">
      <strong>${escapeHtml(service.name)}</strong>${showPrices ? `<em>${Number(service.price || 0).toFixed(2)} Bs</em>` : ''}</button>`).join('');
  }
  document.getElementById('servicePickerModal').classList.add('nursing-modal--active');
}
function closeServicePicker() { document.getElementById('servicePickerModal')?.classList.remove('nursing-modal--active'); }
function chooseService(serviceId) {
  consultState.selectedServiceId = serviceId;
  closeServicePicker();
  const patient = consultState.pendingPatient;
  if (!patient) return openPatientSearchModal();
  openConsultModal('create');
  setSelectedPatient(patient.id, `${patient.nombre} ${patient.apellido}`);
  document.getElementById('serviceType').value = serviceId;
  toggleServiceFields();
}

function renderConsultations() {
  const tbody = document.getElementById('consultTableBody');
  if (!tbody) return;
  const items = visibleConsultations();
  const empty = document.getElementById('consultEmptyRow');
  tbody.querySelectorAll('tr[data-consult-row]').forEach((row) => row.remove());
  if (empty) empty.style.display = items.length ? 'none' : '';

  items.forEach((c) => {
    const tr = document.createElement('tr');
    tr.dataset.consultRow = c.id;
    tr.innerHTML = `
      <td><strong>${escapeHtml(c.time || '—')}</strong><br><small style="color:var(--gray-500)">${formatDisplayDate(c.date)}</small></td>
      <td><div class="patient-cell"><span class="patient-photo">${getInitials(c.patientName)}</span><span>${escapeHtml(c.patientName)}</span></div></td>
      <td><strong>${escapeHtml(c.serviceType)}</strong><br><small style="color:var(--gray-500)">${escapeHtml(c.chiefComplaint || '')}</small></td>
      <td><span class="status-badge ${statusClass(c.status)}">${escapeHtml(consultState.monthView ? (['Atendida', 'Finalizada'].includes(c.status) ? 'Atendida' : 'Pendiente') : c.status)}</span></td>
      <td><span class="action-links">${rowActions(c)}<button class="btn-action" data-action="print" data-id="${c.id}" title="Imprimir atención">🖨</button></span></td>`;
    tbody.insertBefore(tr, empty);
  });
  const count = document.getElementById('consultCount');
  if (count) count.textContent = `${items.length} atención${items.length !== 1 ? 'es' : ''}`;
}

function printAttention(attention) {
  const popup=window.open('','_blank','width=850,height=700');
  if(!popup)return alert('Permite ventanas emergentes para imprimir.');
  popup.document.write(`<!doctype html><html><head><title>Atención médica</title><style>body{font-family:Arial;padding:36px;color:#18343b}h1{color:#0f4c5c;border-bottom:2px solid #2fb7a6;padding-bottom:12px}.field{padding:9px 0;border-bottom:1px solid #ddd}strong{color:#0f4c5c}</style></head><body><h1>Med Solution · Atención</h1><p><strong>Paciente:</strong> ${escapeHtml(attention.patientName)}<br><strong>Fecha:</strong> ${formatDisplayDate(attention.date)} ${escapeHtml(attention.time||'')}</p><div class="field"><strong>Servicio:</strong> ${escapeHtml(attention.serviceType)}</div><div class="field"><strong>Motivo:</strong> ${escapeHtml(attention.chiefComplaint||'—')}</div><div class="field"><strong>Diagnóstico:</strong> ${escapeHtml(attention.diagnosis||'—')}</div><div class="field"><strong>Tratamiento:</strong> ${escapeHtml(attention.treatment||'—')}</div><div class="field"><strong>Indicaciones:</strong> ${escapeHtml(attention.indications||'—')}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}

function configureMonthlyAttentionView() {
  consultState.monthView=getUrlParam('view')==='month';
  if(consultState.monthView){document.getElementById('roleContextTitle').textContent='Atenciones del mes';document.getElementById('roleContextText').textContent='Consulta, filtra, imprime y abre la historia clínica de las atenciones registradas.'}
  const services=[...new Set(consultState.consultations.filter(item=>!item.contraceptiveControl&&!item.contraceptiveSchedule).map(item=>item.serviceType).filter(Boolean))].sort();
  const relevant=consultState.consultations.filter(item=>!item.contraceptiveControl&&!item.contraceptiveSchedule);const responsible=[...new Set(relevant.map(item=>item.procedureResponsible||item.scheduledProfessional||item.registeredBy).filter(Boolean))].sort();const months=[...new Set(relevant.map(item=>String(item.date||'').slice(5,7)).filter(Boolean))].sort();const years=[...new Set(relevant.map(item=>String(item.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  document.getElementById('monthlyAttentionService').innerHTML='<option value="">Todos los servicios</option>'+services.map(value=>`<option>${escapeHtml(value)}</option>`).join('');
  document.getElementById('monthlyAttentionResponsible').innerHTML='<option value="">Todos los responsables</option>'+responsible.map(value=>`<option>${escapeHtml(value)}</option>`).join('');
  document.getElementById('monthlyAttentionMonth').innerHTML='<option value="">Todos los meses</option>'+months.map(value=>`<option value="${value}">${new Intl.DateTimeFormat('es',{month:'long'}).format(new Date(2024,Number(value)-1,1))}</option>`).join('');
  document.getElementById('monthlyAttentionYear').innerHTML='<option value="">Todos los años</option>'+years.map(value=>`<option>${value}</option>`).join('');
  [['monthlyAttentionService','service'],['monthlyAttentionResponsible','responsible'],['monthlyAttentionMonth','month'],['monthlyAttentionYear','year']].forEach(([id,key])=>{const control=document.getElementById(id);control.value=consultState.monthFilters[key];if(!control.dataset.filterBound){control.dataset.filterBound='true';control.addEventListener('change',event=>{consultState.monthFilters[key]=event.target.value;renderConsultations()})}});
}

function configureRoleView() {
  const doctor = isDoctor();
  const title = document.getElementById('roleContextTitle');
  const text = document.getElementById('roleContextText');
  const subtitle = document.getElementById('appointmentsSubtitle');
  const newButton = document.getElementById('newConsultBtn');
  if (doctor) {
    if (title) title.textContent = 'Panel del doctor';
    if (text) text.textContent = 'Pacientes médicos pendientes ordenados por hora de llegada. Acepta una consulta para abrir su historia clínica.';
    if (subtitle) subtitle.textContent = 'Gestiona la cola médica, la consulta activa y el historial clínico del paciente.';
    if (newButton) newButton.style.display = '';
  } else {
    if (title) title.textContent = 'Panel de auxiliar · Recepción';
    if (text) text.textContent = 'Toda atención comienza aquí. Las consultas médicas pasan automáticamente al panel del doctor.';
  }
}

function setSelectedPatient(id, name) {
  document.getElementById('consultPatientId').value = id;
  document.getElementById('consultPatientNameHidden').value = name;
  document.getElementById('consultPatientDisplay').innerHTML =
    `<strong>${escapeHtml(name)}</strong><small>ID Historia: #${escapeHtml(id)}</small>`;
}
function clearSelectedPatient() {
  document.getElementById('consultPatientId').value = '';
  document.getElementById('consultPatientNameHidden').value = '';
  document.getElementById('consultPatientDisplay').innerHTML = '<em style="color:var(--gray-500)">Sin paciente seleccionado</em>';
}
function selectedPatientId() { return Number(document.getElementById('consultPatientId')?.value) || null; }
function selectedPatientName() { return document.getElementById('consultPatientNameHidden')?.value || ''; }

function openPatientSearchModal() {
  const modal = document.getElementById('patientSearchModal');
  document.getElementById('patientSearchInput').value = '';
  renderPatientSearchResults('');
  hideQuickRegisterForm();
  modal.classList.add('nursing-modal--active');
  setTimeout(() => document.getElementById('patientSearchInput')?.focus(), 60);
}
function closePatientSearchModal() {
  document.getElementById('patientSearchModal')?.classList.remove('nursing-modal--active');
  hideQuickRegisterForm();
}
function renderPatientSearchResults(term) {
  const container = document.getElementById('patientSearchResults');
  const q = term.toLowerCase().trim();
  const matches = getPatients().filter((p) => !q ||
    `${p.nombre} ${p.apellido} ${p.ci || ''} ${p.telefono || ''} ${p.id}`.toLowerCase().includes(q));
  if (!matches.length) {
    container.innerHTML = `<p class="patient-result-empty">${q ? 'No se encontraron pacientes. Puedes registrar uno nuevo.' : 'No hay pacientes registrados.'}</p>`;
    return;
  }
  container.innerHTML = matches.map((p) => {
    const name = `${p.nombre} ${p.apellido}`;
    return `<div class="patient-result-item"><span class="patient-photo">${getInitials(name)}</span>
      <div class="patient-result-item__info"><strong>${escapeHtml(name)}</strong><small>CI: ${escapeHtml(p.ci || 'Sin CI')} · Tel: ${escapeHtml(p.telefono || 'Sin teléfono')} · #${p.id}</small></div>
      <button class="btn btn--primary" type="button" style="padding:7px 14px;font-size:.82rem" data-pick-patient="${p.id}" data-pick-name="${escapeHtml(name)}">Seleccionar</button></div>`;
  }).join('');
}
function selectPatientAndContinue(id, name) {
  const patient = getPatients().find((item) => Number(item.id) === Number(id));
  if (!patient) return;
  consultState.pendingPatient = patient;
  closePatientSearchModal();
  if (document.getElementById('consultModal').classList.contains('nursing-modal--active')) {
    setSelectedPatient(id, name);
    return;
  }
  openServicePicker();
}
function showQuickRegisterForm() {
  document.getElementById('quickRegisterSection').style.display = '';
  document.getElementById('showRegisterPatientBtn').style.display = 'none';
  document.getElementById('quickPatientForm').reset();
}
function hideQuickRegisterForm() {
  document.getElementById('quickRegisterSection').style.display = 'none';
  document.getElementById('showRegisterPatientBtn').style.display = '';
}
async function handleQuickPatientSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById('quickPatientSaveBtn');
  if (button?.disabled) return;
  setFormStatus('quickPatientStatus');
  const nombre = form.elements.nombre.value.trim();
  const apellido = form.elements.apellido.value.trim();
  const ci = form.elements.ci.value.trim();
  if (!nombre || !apellido) {
    setFormStatus('quickPatientStatus', 'Nombre y apellido son requeridos.');
    return;
  }
  const patients = getPatients();
  const existing = ci
    ? patients.find((p) => String(p.ci || '').trim() === ci)
    : null;
  if (existing) {
    consultState.pendingPatient = existing;
    closePatientSearchModal();
    showFlowMessage('El paciente ya existía y fue seleccionado automáticamente.');
    openServicePicker();
    return;
  }
  const patient = {
    id: nextId(patients), nombre, apellido, ci,
    telefono: form.elements.telefono.value.trim(), genero: form.elements.genero.value,
    fechaNacimiento: form.elements.fechaNacimiento.value, email: '', direccion: '',
    registrado: new Date().toISOString().slice(0, 10), isNew: true,
  };
  setButtonLoading(button, true, 'Preparando…');
  consultState.pendingPatient = patient;
  closePatientSearchModal();
  setButtonLoading(button, false);
  openServicePicker();
}

function toggleServiceFields() {
  const serviceId = document.getElementById('serviceType')?.value;
  const service = consultState.services.find((item) => String(item.id || item.name) === String(serviceId));
  const field = document.getElementById('procedureResponsibleField');
  const select = document.getElementById('procedureResponsible');
  field.classList.toggle('hidden-section', !service);
  select.required = Boolean(service);
  if (!service) {
    select.innerHTML = '<option value="">Primero selecciona un servicio…</option>';
    select.value = '';
    return;
  }
  const allowed = service.allowed_responsible || 'Ambos';
  const current = select.value;
  const staff = consultState.staff.filter((person) =>
    allowed === 'Ambos' || staffRole(person.position) === allowed);
  select.innerHTML = `<option value="">${staff.length ? 'Seleccionar…' : 'No hay responsables activos autorizados'}</option>` + staff
    .map((person) => `<option value="${escapeHtml(person.name)}">${escapeHtml(person.name)}</option>`).join('');
  if (staff.some((person) => person.name === current)) select.value = current;
}
function staffRole(position) {
  const normalized = String(position || '').toLowerCase();
  return normalized.includes('doctor') || normalized.includes('médic') || normalized.includes('medic') ? 'Doctor' : 'Auxiliar';
}

function configureFormMode(mode) {
  const clinical = document.getElementById('clinicalFields');
  const clinicalMode = ['clinical', 'edit-clinical', 'view-clinical'].includes(mode);
  clinical.classList.toggle('hidden-section', !clinicalMode);
  document.getElementById('serviceType').disabled = clinicalMode || mode === 'create';
  document.getElementById('pickPatientBtn').style.display = clinicalMode ? 'none' : '';
  document.getElementById('consultSaveBtn').textContent = clinicalMode ? 'Finalizar consulta' : 'Guardar Atención';
  const step = document.getElementById('consultStepLabel');
  if (step) step.style.display = mode === 'create' ? '' : 'none';
}

function openConsultModal(mode, consult = null) {
  const form = document.getElementById('consultForm');
  form.reset();
  clearSelectedPatient();
  consultState.editingId = consult?.id ?? null;
  consultState.mode = mode;
  setConsultFormReadOnly(form, false);
  configureFormMode(mode);
  document.getElementById('consultSaveBtn').style.display = mode.startsWith('view') ? 'none' : '';
  setFormStatus('consultFormStatus');

  if (consult) {
    fillConsultForm(form, consult);
  } else {
    const now=boliviaNowParts();form.elements.date.value=now.date;form.elements.time.value=now.time;
  }

  const titles = {
    create: 'Nueva Atención', edit: 'Editar Atención', view: 'Detalle de Atención',
    clinical: 'Consulta clínica', 'edit-clinical': 'Corregir consulta clínica', 'view-clinical': 'Detalle de Consulta',
  };
  document.getElementById('consultModalTitle').textContent = titles[mode] || 'Atención';
  if (mode.startsWith('view')) setConsultFormReadOnly(form, true);
  toggleServiceFields();
  document.getElementById('consultModal').classList.add('nursing-modal--active');
}
function closeConsultModal() {
  document.getElementById('consultModal')?.classList.remove('nursing-modal--active');
  document.getElementById('consultForm')?.reset();
  clearSelectedPatient();
  consultState.editingId = null;
  consultState.selectedServiceId = null;
  consultState.pendingPatient = null;
}
function fillConsultForm(form, c) {
  setSelectedPatient(c.patientId, c.patientName);
  const fields = ['date','time','procedureResponsible','bp','hr','temp','weight','height','spo2',
    'chiefComplaint','evolution','clinicalAntecedents','physicalExam','diagnosis','treatment','medications','procedures','prescription','indications','nextControl','observations'];
  fields.forEach((name) => { if (form.elements[name]) form.elements[name].value = c[name] || ''; });
  renderServiceOptions(c.serviceId || c.serviceType);
  if (!form.elements.serviceType.value && c.serviceType) {
    const option = document.createElement('option');
    option.value = c.serviceId || c.serviceType; option.textContent = c.serviceType;
    form.elements.serviceType.appendChild(option); form.elements.serviceType.value = option.value;
  }
}
function setConsultFormReadOnly(form, readOnly) {
  form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((el) => {
    el.readOnly = readOnly;
    if (el.tagName === 'SELECT') el.disabled = readOnly;
  });
}

async function ensureMedicalRecord(patientId) {
  const records = readArray(RECORDS_KEY);
  let record = records.find((item) => Number(item.patientId) === Number(patientId));
  if (!record) {
    record = {
      id: nextId(records), patientId: Number(patientId),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    records.push(record);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }
  if (window.MedSolutionData?.isConfigured()) await window.MedSolutionData.ensureMedicalRecord(patientId);
  return record;
}

async function acceptConsultation(consult) {
  await ensureMedicalRecord(consult.patientId);
  consult.status = 'En consulta';
  consult.scheduleStatus = 'En Atención';
  consult.acceptedAt = new Date().toISOString();
  await saveConsultations(consult);
  renderConsultations();
  openConsultModal('clinical', consult);
}

function consultationData(form) {
  const value = (name) => form.elements[name]?.value?.trim?.() || form.elements[name]?.value || '';
  const serviceId = value('serviceType');
  const service = consultState.services.find((item) => String(item.id || item.name) === String(serviceId));
  return {
    patientId: selectedPatientId(), patientName: selectedPatientName(),
    date: value('date'), time: value('time'), serviceId: service?.id || null,
    serviceType: service?.name || '', servicePrice: Number(service?.price || 0),
    requiresMedicalConsultation: Boolean(service?.requires_medical_consultation),
    generatesMedicalRecord: Boolean(service?.generates_medical_record),
    procedureResponsible: value('procedureResponsible'), chiefComplaint: value('chiefComplaint'),
    clinicalAntecedents: value('clinicalAntecedents'),
    bp: value('bp'), hr: value('hr'), temp: value('temp'), weight: value('weight'),
    height: value('height'), spo2: value('spo2'), evolution: value('evolution'),
    physicalExam: value('physicalExam'), diagnosis: value('diagnosis'), treatment: value('treatment'),
    medications: value('medications'), procedures: value('procedures'),
    prescription: value('prescription'), indications: value('indications'),
    nextControl: value('nextControl'), observations: value('observations'),
    registeredBy: consultState.editingId !== null
      ? consultState.consultations.find((item) => Number(item.id) === Number(consultState.editingId))?.registeredBy
      : (getAuthUser()?.name || getAuthUser()?.username || 'Usuario'),
    registeredByRole: consultState.editingId !== null
      ? consultState.consultations.find((item) => Number(item.id) === Number(consultState.editingId))?.registeredByRole
      : (getAuthUser()?.role || ''),
    registeredByUserId: consultState.editingId !== null
      ? consultState.consultations.find((item) => Number(item.id) === Number(consultState.editingId))?.registeredByUserId
      : (getAuthUser()?.id || null),
  };
}

async function handleConsultSave(event) {
  event.preventDefault();
  if (consultState.saving) return;
  const form = event.currentTarget;
  const saveButton = document.getElementById('consultSaveBtn');
  setFormStatus('consultFormStatus');
  const data = consultationData(form);
  if (consultState.editingId === null) {
    const now=boliviaNowParts();data.date=now.date;data.time=now.time;
  }
  if (!data.patientId) return setFormStatus('consultFormStatus', 'Selecciona un paciente.');
  if (!data.date || !data.serviceType) {
    return setFormStatus('consultFormStatus', 'Fecha y servicio son requeridos.');
  }
  if (!data.procedureResponsible) {
    return setFormStatus('consultFormStatus', 'Selecciona al responsable del servicio.');
  }

  const clinical = ['clinical', 'edit-clinical'].includes(consultState.mode);
  if (clinical && [
    data.chiefComplaint,
    data.evolution,
    data.clinicalAntecedents,
    data.physicalExam,
    data.diagnosis,
    data.treatment,
    data.indications,
  ].some((value) => !String(value || '').trim())) {
    return setFormStatus(
      'consultFormStatus',
      'Completa motivo, enfermedad actual, antecedentes, examen físico, diagnóstico, tratamiento e indicaciones.',
    );
  }
  let saved = null;
  let editIndex = -1;
  if (consultState.editingId !== null) {
    editIndex = consultState.consultations.findIndex((c) => Number(c.id) === Number(consultState.editingId));
    if (editIndex >= 0) {
      saved = {
        ...consultState.consultations[editIndex], ...data,
        status: clinical ? 'Finalizada' : consultState.consultations[editIndex].status,
        scheduleStatus: clinical ? 'Atendida' : consultState.consultations[editIndex].scheduleStatus,
        finalizedAt: clinical ? new Date().toISOString() : consultState.consultations[editIndex].finalizedAt,
      };
    }
  } else {
    const medical = data.requiresMedicalConsultation;
    const doctorStartsConsultation = medical && isDoctor();
    saved = {
      id: nextId(consultState.consultations), ...data,
      status: doctorStartsConsultation ? 'En consulta' : medical ? 'Pendiente' : 'Finalizada',
      scheduleStatus: doctorStartsConsultation ? 'En Atención' : medical ? 'Pendiente' : 'Atendida',
      createdAt: new Date().toISOString(),
      finalizedAt: medical ? null : new Date().toISOString(),
      acceptedAt: doctorStartsConsultation ? new Date().toISOString() : null,
    };
  }
  if (!saved) return setFormStatus('consultFormStatus', 'No se encontró la atención que deseas actualizar.');

  consultState.saving = true;
  setButtonLoading(saveButton, true);
  form.querySelectorAll('button, input, select, textarea').forEach((control) => {
    if (control !== saveButton) control.dataset.wasDisabled = String(control.disabled);
    control.disabled = true;
  });

  try {
    if (!window.MedSolutionData?.isConfigured()) {
      throw new Error('Supabase no está conectado. La atención no se guardó para evitar datos locales sin sincronizar.');
    }
    if ((clinical || (data.requiresMedicalConsultation && isDoctor())) && !consultState.pendingPatient?.isNew) {
      await ensureMedicalRecord(data.patientId);
    }

    if (editIndex >= 0) {
      if (window.MedSolutionData?.isConfigured()) saved = await window.MedSolutionData.saveAttention(saved);
      consultState.consultations[editIndex] = saved;
    } else if (consultState.pendingPatient?.isNew && window.MedSolutionData?.isConfigured()) {
      const result = await window.MedSolutionData.savePatientAndAttention(consultState.pendingPatient, saved);
      saved = result.linkedAttention;
      const patient = result.patient;
      if (!consultState.patients.some((item) => Number(item.id) === Number(patient.id))) {
        consultState.patients.push(patient);
        savePatientsToStorage(consultState.patients);
      }
      consultState.consultations.push(saved);
    } else {
      if (window.MedSolutionData?.isConfigured()) saved = await window.MedSolutionData.saveAttention(saved);
      if (consultState.pendingPatient?.isNew) {
        const patient = { ...consultState.pendingPatient };
        delete patient.isNew;
        consultState.patients.push(patient);
        savePatientsToStorage(consultState.patients);
      }
      consultState.consultations.push(saved);
    }

    await saveConsultations();
    const successMessage = saved.requiresMedicalConsultation
      ? (isDoctor()
        ? 'Atención registrada. La Historia Clínica está lista para continuar la consulta.'
        : 'Atención registrada y enviada correctamente al panel del doctor.')
      : 'Procedimiento registrado como realizado.';
    closeConsultModal();
    renderConsultations();
    showFlowMessage(successMessage);
    if (saved.requiresMedicalConsultation && isDoctor() && saved.status === 'En consulta') {
      openConsultModal('clinical', saved);
    }
  } catch (error) {
    const message = error?.message || 'No se pudo registrar la atención.';
    setFormStatus('consultFormStatus', `No se guardó la atención: ${message}`);
    showFlowMessage(`Error: ${message}`, 'error');
  } finally {
    consultState.saving = false;
    form.querySelectorAll('button, input, select, textarea').forEach((control) => {
      if (control.dataset.wasDisabled !== undefined) {
        control.disabled = control.dataset.wasDisabled === 'true';
        delete control.dataset.wasDisabled;
      } else {
        control.disabled = false;
      }
    });
    setButtonLoading(saveButton, false);
    if (consultState.mode === 'create') document.getElementById('serviceType').disabled = true;
  }
}

async function cancelConsultation(id) {
  if (!confirm('¿Cancelar esta atención?')) return;
  const item = consultState.consultations.find((c) => Number(c.id) === Number(id));
  if (item) { item.status = 'Cancelada'; item.cancelledAt = new Date().toISOString(); }
  await saveConsultations(item);
  renderConsultations();
}
async function deleteConsultation(id) {
  if (!confirm('¿Eliminar esta atención?')) return;
  try {
    if (window.MedSolutionData?.isConfigured()) await window.MedSolutionData.deleteAttention(id);
    consultState.consultations = consultState.consultations.filter((c) => Number(c.id) !== Number(id));
    localStorage.setItem(CONSULT_KEY, JSON.stringify(consultState.consultations));
    renderConsultations();
    showFlowMessage('Atención eliminada correctamente.');
  } catch (error) {
    showFlowMessage(`No se pudo eliminar la atención: ${error.message}`, 'error');
  }
}

async function setupAppointmentsModule() {
  await window.MedSolutionData?.ready;
  try {
    await Promise.all([loadCatalog(), loadConsultations()]);
  } catch (error) {
    alert(`No se pudo cargar la configuración: ${error.message}`);
    return;
  }
  configureRoleView();
  configureMonthlyAttentionView();
  renderConsultations();
  document.getElementById('closePatientSearchModalBtn')?.addEventListener('click', closePatientSearchModal);
  document.querySelector('#patientSearchModal .nursing-modal__overlay')?.addEventListener('click', closePatientSearchModal);
  document.getElementById('patientSearchInput')?.addEventListener('input', (e) => renderPatientSearchResults(e.target.value));
  document.getElementById('patientSearchResults')?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-pick-patient]');
    if (button) selectPatientAndContinue(Number(button.dataset.pickPatient), button.dataset.pickName);
  });
  document.getElementById('showRegisterPatientBtn')?.addEventListener('click', showQuickRegisterForm);
  document.getElementById('cancelQuickPatientBtn')?.addEventListener('click', hideQuickRegisterForm);
  document.getElementById('quickPatientForm')?.addEventListener('submit', handleQuickPatientSave);
  document.getElementById('pickPatientBtn')?.addEventListener('click', openPatientSearchModal);
  document.getElementById('newConsultBtn')?.addEventListener('click', () => {
    consultState.pendingPatient = null;
    consultState.selectedServiceId = null;
    openPatientSearchModal();
  });
  document.getElementById('closeServicePickerBtn')?.addEventListener('click', closeServicePicker);
  document.querySelector('#servicePickerModal .nursing-modal__overlay')?.addEventListener('click', closeServicePicker);
  document.getElementById('servicePickerGrid')?.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-choose-service]');
    if (choice) chooseService(choice.dataset.chooseService);
  });
  document.getElementById('serviceType')?.addEventListener('change', toggleServiceFields);
  document.getElementById('closeConsultModalBtn')?.addEventListener('click', closeConsultModal);
  document.getElementById('cancelConsultModalBtn')?.addEventListener('click', closeConsultModal);
  document.querySelector('#consultModal .nursing-modal__overlay')?.addEventListener('click', closeConsultModal);
  document.getElementById('consultForm')?.addEventListener('submit', handleConsultSave);
  document.getElementById('consultTableBody')?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const item = consultState.consultations.find((c) => Number(c.id) === Number(button.dataset.id));
    if (!item) return;
    const action = button.dataset.action;
    if (action === 'accept') acceptConsultation(item).catch((error) => alert(error.message));
    else if (action === 'continue') openConsultModal('clinical', item);
    else if (action === 'cancel') cancelConsultation(item.id).catch((error) => alert(error.message));
    else if (action === 'delete') deleteConsultation(item.id).catch((error) => alert(error.message));
    else if (action === 'view') openConsultModal(requiresMedical(item) ? 'view-clinical' : 'view', item);
    else if (action === 'edit') openConsultModal(requiresMedical(item) && item.status === 'Finalizada' ? 'edit-clinical' : 'edit', item);
    else if (action === 'print') printAttention(item);
  });

  const patientId = Number(getUrlParam('patientId'));
  const consultationId = Number(getUrlParam('consultationId'));
  const item = consultState.consultations.find((c) => Number(c.id) === consultationId);
  if (item && isDoctor()) openConsultModal(requiresMedical(item) ? (['Atendida', 'Finalizada'].includes(item.status) ? 'edit-clinical' : 'clinical') : 'edit', item);
  else if (patientId) {
    const patient = getPatients().find((p) => Number(p.id) === patientId);
    if (patient) { consultState.pendingPatient = patient; openServicePicker(); }
  } else if (getUrlParam('action') === 'new') openPatientSearchModal();

  consultState.unsubscribeAttentions = window.MedSolutionData.subscribeAttentions(async () => {
    await loadConsultations(); configureMonthlyAttentionView(); renderConsultations();
  });
  consultState.unsubscribeServices = window.MedSolutionData.subscribeServices(async () => {
    await loadCatalog(); renderConsultations();
  });
  consultState.unsubscribePatients = window.MedSolutionData.subscribePatients(async () => {
    consultState.patients = await window.MedSolutionData.getPatients();
    localStorage.setItem(PATIENTS_KEY, JSON.stringify(consultState.patients));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAppointmentsModule, { once: true });
else setupAppointmentsModule();
