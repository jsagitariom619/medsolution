// MedSolution: fecha civil de Bolivia para campos YYYY-MM-DD.
// Los timestamps absolutos continúan almacenándose en UTC/timestamptz.
window.MedSolutionDate = window.MedSolutionDate || {};
window.MedSolutionDate.today = window.MedSolutionDate.today || function medSolutionBoliviaToday(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const contraceptiveState = {
  records: [],
  attentions: [],
  patients: [],
  staff: [],
  services: [],
  medicalRecords: [],
  patientAutocomplete: null,
  editingId: null,
  saving: false,
  page: 1,
  pageSize: 6,
  applyingSourceId: null,
  renewingExpiredId: null,
  filters: { service:'', responsible:'', month:'', year:'' },
};

function currentUser() {
  try {
    const raw = sessionStorage.getItem('medsolution.authUser') || localStorage.getItem('medsolution.authUser');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function hasFullAccess() { return ['Administrador', 'Médico'].includes(currentUser()?.role); }
function escapeControlHtml(value) {
  const element = document.createElement('div');
  element.textContent = value == null ? '' : String(value);
  return element.innerHTML;
}
function formatControlDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
function patientName(patient) { return `${patient?.nombre || ''} ${patient?.apellido || ''}`.trim(); }
function dateOnly(value) { return new Date(`${value}T12:00:00`); }

function addCalendarMonths(value, months) {
  if (!value) return '';
  const source = dateOnly(value);
  const originalDay = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(originalDay, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function nextApplicationDate(applicationDate, type) {
  return addCalendarMonths(applicationDate, type === 'Trimestral' ? 3 : type === 'Mensual' ? 1 : 0);
}

function controlStatus(record) {
  const today = dateOnly(window.MedSolutionDate.today());
  const next = dateOnly(record.nextApplicationDate);
  const days = Math.ceil((next - today) / 86400000);
  if (days < 0) return 'Vencido';
  if (days <= 7) return 'Próximo';
  return 'Vigente';
}

function statusBadge(record) {
  // No llamar "Vencido" a aplicaciones anteriores cuando ya hay un registro posterior.
  const historical = isHistoricalContraceptiveControl(record);
  const status = historical ? 'Histórico' : controlStatus(record);
  const cssClass = { Vigente:'control-status--current', Próximo:'control-status--soon', Vencido:'control-status--expired', Histórico:'control-status--historical' }[status];
  const text = !historical && record.nextApplicationDate === window.MedSolutionDate.today() ? 'Hoy' : status;
  const tooltip = historical ? 'Registro anterior: este paciente tiene una aplicación más reciente' : status;
  return `<span class="control-status ${cssClass}" title="${escapeControlHtml(tooltip)}"><span class="control-status__dot" aria-hidden="true"></span>${text}</span>`;
}
function newerContraceptiveRecord(a, b) {
  if (!b) return true;
  const dateA = String(a.applicationDate || a.date || '').slice(0, 10);
  const dateB = String(b.applicationDate || b.date || '').slice(0, 10);
  if (dateA !== dateB) return dateA > dateB;
  return Number(a.id || 0) > Number(b.id || 0);
}
function latestPatientControl(patientId, controls = contraceptiveState.records) {
  return controls.filter(row => Number(row.patientId) === Number(patientId))
    .reduce((latest, row) => newerContraceptiveRecord(row, latest) ? row : latest, null);
}
/** Vista de seguimiento, una única fila por identidad de paciente.
 * Los movimientos originales permanecen en atenciones e historial.
 * No unir dos pacientes por nombre: solo por patientId.
 */
function activePatientControls(controls = contraceptiveState.records) {
  const byPatient = new Map();
  for (const item of controls) {
    const patientId = Number(item.patientId);
    const key = Number.isSafeInteger(patientId) && patientId > 0
      ? `patient:${patientId}`
      : `unlinked:${item.remoteId || item.id}`;
    const prior = byPatient.get(key);
    if (newerContraceptiveRecord(item, prior)) byPatient.set(key, item);
  }
  return [...byPatient.values()];
}
function isHistoricalContraceptiveControl(control, controls = contraceptiveState.records) {
  if (!control || !Number(control.patientId)) return false;
  const latest = latestPatientControl(control.patientId, controls);
  return Boolean(latest && String(latest.remoteId || latest.id) !== String(control.remoteId || control.id));
}

function canApplyScheduledDose(control, controls = contraceptiveState.records, today = window.MedSolutionDate.today()) {
  if (!control || !['Mensual','Trimestral'].includes(control.contraceptiveType)) return false;
  const next = String(control.nextApplicationDate || '').slice(0,10);
  // El acceso rápido a Aplicar corresponde únicamente al día de la fecha programada.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next !== today) return false;
  const latest = latestPatientControl(control.patientId, controls);
  return latest && String(latest.remoteId || latest.id) === String(control.remoteId || control.id);
}

function canStartNewApplicationAfterExpiry(control, controls = contraceptiveState.records, today = window.MedSolutionDate.today()) {
  // Nueva aplicación requiere un control realmente vencido y actual, no uno histórico.
  // El tipo se vuelve a seleccionar en el nuevo formulario; no depender de su dato antiguo.
  if (!control || isHistoricalContraceptiveControl(control, controls)) return false;
  const next = String(control.nextApplicationDate || '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next >= today) return false;
  const latest = latestPatientControl(control.patientId, controls);
  return Boolean(latest && String(latest.remoteId || latest.id) === String(control.remoteId || control.id));
}

function contraceptiveService() {
  const active = contraceptiveState.services.filter((service) => service.active !== false);
  return active.find((service) => String(service.description || '').includes('[MedSolution:anticonceptivos]'))
    || active.find((service) => /^(registro de )?anticonceptivos?$/i.test(String(service.name || '').trim()))
    || active.find((service) => {
      const name = String(service.name || '').toLowerCase();
      return name.includes('anticoncept') && !name.includes('mensual') && !name.includes('trimestral');
    });
}

function configuredPrice() {
  return Number(contraceptiveService()?.price || 0);
}

async function loadContraceptiveData() {
  const [patients, staff, services, attentions, medicalRecords] = await Promise.all([
    window.MedSolutionData.getPatients(),
    window.MedSolutionData.getStaff(),
    window.MedSolutionData.getServices(true),
    window.MedSolutionData.getAttentions(),
    window.MedSolutionData.getMedicalRecords(),
  ]);
  contraceptiveState.patients = patients;
  contraceptiveState.staff = staff;
  contraceptiveState.services = services;
  contraceptiveState.attentions = attentions;
  contraceptiveState.medicalRecords = medicalRecords;
  contraceptiveState.records = attentions.filter((item) => item.contraceptiveControl === true);
}

function filteredRecords() {
  // Aplicar filtros a la última ficha POR paciente, nunca al movimiento histórico.
  return activePatientControls()
    .filter((record) => !contraceptiveState.filters.service || record.serviceType === contraceptiveState.filters.service)
    .filter((record) => !contraceptiveState.filters.responsible || record.procedureResponsible === contraceptiveState.filters.responsible)
    .filter((record) => !contraceptiveState.filters.month || String(record.applicationDate||record.date||'').slice(5,7) === contraceptiveState.filters.month)
    .filter((record) => !contraceptiveState.filters.year || String(record.applicationDate||record.date||'').slice(0,4) === contraceptiveState.filters.year)
    .sort((a, b) => String(b.applicationDate||b.date||'').localeCompare(String(a.applicationDate||a.date||''))
      || Number(b.id||0) - Number(a.id||0));
}

function renderContraceptiveTable() {
  const body = document.getElementById('controlTableBody');
  const records = filteredRecords();
  const pageCount = Math.max(1, Math.ceil(records.length / contraceptiveState.pageSize));
  contraceptiveState.page = Math.max(1, Math.min(pageCount, contraceptiveState.page));
  const start = (contraceptiveState.page - 1) * contraceptiveState.pageSize;
  const visible = records.slice(start, start + contraceptiveState.pageSize);
  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="7" class="control-empty">No hay controles para los filtros seleccionados.</td></tr>';
  } else {
    body.innerHTML = visible.map((record) => {
      const patient = contraceptiveState.patients.find(item => Number(item.id) === Number(record.patientId));
      const due = canApplyScheduledDose(record);
      const expired = canStartNewApplicationAfterExpiry(record);
      const actions = hasFullAccess()
        ? `<button class="control-action-icon" type="button" data-control-action="history" data-id="${record.id}" title="Ver historial" aria-label="Ver historial de ${escapeControlHtml(record.patientName)}">▣</button>
          <button class="control-action-icon" type="button" data-control-action="edit" data-id="${record.id}" title="Editar aplicación" aria-label="Editar aplicación de ${escapeControlHtml(record.patientName)}">✎</button>
          <button class="control-action-icon control-action-icon--danger" type="button" data-control-action="delete" data-id="${record.id}" title="Eliminar aplicación" aria-label="Eliminar aplicación de ${escapeControlHtml(record.patientName)}">×</button>`
        : '';
      return `<tr data-control-id="${record.id}">
        <td data-label="Paciente"><strong class="control-patient-name">${escapeControlHtml(record.patientName || patientName(patient))}</strong><span class="control-secondary">${escapeControlHtml(patient?.telefono || 'Sin teléfono')}</span></td>
        <td data-label="Última"><span class="control-date">${formatControlDate(record.applicationDate)}</span></td>
        <td data-label="Próxima"><strong class="control-date">${formatControlDate(record.nextApplicationDate)}</strong></td>
        <td data-label="Anticonceptivo"><strong>${escapeControlHtml(record.contraceptiveType || '—')}</strong><span class="control-secondary">${escapeControlHtml(record.contraceptiveMedication || 'Sin medicamento registrado')}</span></td>
        <td data-label="Responsable" class="control-responsible">${escapeControlHtml(record.procedureResponsible || '—')}</td>
        <td data-label="Estado" class="control-status-cell">${statusBadge(record)}</td>
        <td data-label="Acciones" class="control-actions-cell"><div class="control-row-actions">
          ${due ? `<button type="button" class="control-apply-btn" data-control-action="apply" data-id="${record.id}" title="Registrar aplicación correspondiente a hoy">Aplicar</button>` : ''}
          ${expired ? `<button type="button" class="control-apply-btn control-new-btn" data-control-action="new-after-expiry" data-id="${record.id}" title="Nueva aplicación, sin modificar el registro vencido">Nueva aplicación</button>` : ''}
          ${actions || (!due && !expired ? '<span class="control-secondary">—</span>' : '')}
        </div></td>
      </tr>`;
    }).join('');
  }
  const count = document.getElementById('controlCount');
  if (count) count.textContent = `${records.length} paciente${records.length === 1 ? '' : 's'}`;
  const pagination = document.getElementById('controlPagination');
  pagination.hidden = pageCount < 2;
  document.getElementById('controlPageLabel').textContent = `Página ${contraceptiveState.page} de ${pageCount}`;
  document.getElementById('controlPrevPage').disabled = contraceptiveState.page === 1;
  document.getElementById('controlNextPage').disabled = contraceptiveState.page === pageCount;
}


function focusNotifiedContraceptive() {
  const raw = new URLSearchParams(location.search).get('controlId');
  if (!raw || !/^\d+$/.test(raw)) return;
  const id = Number(raw);
  const record = contraceptiveState.records.find(item => Number(item.id) === id);
  if (!record) return;
  // Reemplazar filtros solo para mostrar el control solicitado desde la campana.
  if (Object.values(contraceptiveState.filters).some(Boolean)) {
    contraceptiveState.filters={ service:'', responsible:'', month:'', year:'' };
    ['controlServiceFilter','controlResponsibleFilter','controlMonthFilter','controlYearFilter'].forEach(filterId=>{
      const filter=document.getElementById(filterId);
      if (filter) filter.value='';
    });
  }
  // Un enlace desde Atenciones puede apuntar a un movimiento anterior; localizar
  // su paciente y mostrar la ficha vigente, sin perder el acceso al historial.
  const latest = latestPatientControl(record.patientId);
  if (!latest) return;
  const currentId = Number(latest.id);
  const index=filteredRecords().findIndex(item=>Number(item.id)===currentId);
  if (index < 0) return;
  contraceptiveState.page=Math.floor(index/contraceptiveState.pageSize)+1;
  renderContraceptiveTable();
  const row=document.querySelector(`#controlTableBody tr[data-control-id="${currentId}"]`);
  if (!row) return;
  row.classList.add('control-row--notified');
  row.scrollIntoView({behavior:'smooth',block:'center'});
  if (currentId !== id && hasFullAccess()) openPatientHistory(latest);
}

function renderStaffOptions(selected = '') {
  const select = document.querySelector('#contraceptiveForm [name="responsible"]');
  const staff = [...contraceptiveState.staff].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  select.innerHTML = `<option value="">${staff.length ? 'Seleccionar…' : 'No hay personal activo configurado'}</option>` + staff
    .map((person) => `<option value="${escapeControlHtml(person.name)}">${escapeControlHtml(person.name)}</option>`)
    .join('');
  if (selected) select.value = selected;
}

function renderResponsibleFilter() {
  const activeControls = activePatientControls();
  const names = [...new Set([
    ...contraceptiveState.staff.map((person) => person.name),
    ...activeControls.map((record) => record.procedureResponsible),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const definitions=[['controlServiceFilter',[...new Set(activeControls.map(record=>record.serviceType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))],['controlResponsibleFilter',names],['controlMonthFilter',[...new Set(activeControls.map(record=>String(record.applicationDate||record.date||'').slice(5,7)).filter(Boolean))].sort()],['controlYearFilter',[...new Set(activeControls.map(record=>String(record.applicationDate||record.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a))]];
  definitions.forEach(([id,values])=>{const select=document.getElementById(id),current=select.value;select.innerHTML='<option value="">Todos</option>'+values.map(value=>`<option value="${escapeControlHtml(value)}">${id==='controlMonthFilter'?new Intl.DateTimeFormat('es',{month:'long'}).format(new Date(2024,Number(value)-1,1)):escapeControlHtml(value)}</option>`).join('');select.value=current});
}

function updateNextApplicationPreview() {
  const form = document.getElementById('contraceptiveForm');
  const next = nextApplicationDate(form.elements.applicationDate.value, form.elements.contraceptiveType.value);
  document.getElementById('nextApplicationPreview').textContent = next
    ? `📅 ${formatControlDate(next)}`
    : 'Selecciona la fecha y el tipo.';
}

function showContraceptiveStatus(message = '', type = 'error') {
  const element = document.getElementById('contraceptiveFormStatus');
  element.textContent = message;
  element.style.display = message ? '' : 'none';
  element.style.color = type === 'error' ? '#c93047' : 'var(--aqua)';
}

function showQuickPatientStatus(message = '', type = 'error') {
  const element = document.getElementById('quickPatientStatus');
  element.textContent = message;
  element.style.display = message ? '' : 'none';
  element.style.color = type === 'error' ? '#c93047' : 'var(--aqua)';
}

function resetQuickPatientForm() {
  ['quickPatientName', 'quickPatientLastName', 'quickPatientCi', 'quickPatientPhone']
    .forEach((id) => { document.getElementById(id).value = ''; });
  showQuickPatientStatus();
}

function showQuickPatientForm() {
  resetQuickPatientForm();
  document.getElementById('quickPatientPanel').style.display = '';
  document.getElementById('showQuickPatientBtn').style.display = 'none';
  document.getElementById('quickPatientName').focus();
}

function hideQuickPatientForm() {
  document.getElementById('quickPatientPanel').style.display = 'none';
  document.getElementById('showQuickPatientBtn').style.display = '';
  resetQuickPatientForm();
}

async function saveQuickPatient() {
  const button = document.getElementById('saveQuickPatientBtn');
  if (button.disabled) return;
  const nombre = document.getElementById('quickPatientName').value.trim();
  const apellido = document.getElementById('quickPatientLastName').value.trim();
  const ci = document.getElementById('quickPatientCi').value.trim();
  const telefono = document.getElementById('quickPatientPhone').value.trim();

  if (!nombre) {
    showQuickPatientStatus('Debe ingresar el nombre.');
    document.getElementById('quickPatientName').focus();
    return;
  }
  if (!apellido) {
    showQuickPatientStatus('Debe ingresar el apellido.');
    document.getElementById('quickPatientLastName').focus();
    return;
  }

  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = '⏳ Guardando…';
  showQuickPatientStatus();
  try {
    let patient = ci ? await window.MedSolutionData.findPatientByCi(ci) : null;
    const reused = Boolean(patient);
    if (!patient) {
      patient = await window.MedSolutionData.savePatient({
        nombre,
        apellido,
        ci,
        telefono,
        fechaNacimiento: '',
        genero: '',
        email: '',
        direccion: '',
        registrado: window.MedSolutionDate.today(),
      });
    }
    const index = contraceptiveState.patients.findIndex((item) => Number(item.id) === Number(patient.id));
    if (index >= 0) contraceptiveState.patients[index] = patient;
    else contraceptiveState.patients.push(patient);
    contraceptiveState.patientAutocomplete.update(contraceptiveState.patients,contraceptiveState.medicalRecords);
    contraceptiveState.patientAutocomplete.select(patient.id);
    hideQuickPatientForm();
    showContraceptiveStatus();
    showContraceptiveToast(reused
      ? 'El paciente ya existía y fue seleccionado automáticamente.'
      : 'Paciente creado y seleccionado correctamente.');
  } catch (error) {
    showQuickPatientStatus(`No se pudo guardar el paciente: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Guardar paciente';
    delete button.dataset.originalText;
  }
}

function showContraceptiveToast(message, type = 'success') {
  let toast = document.getElementById('contraceptiveToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'contraceptiveToast';
    toast.setAttribute('role', 'status');
    Object.assign(toast.style, {
      position: 'fixed', right: '24px', bottom: '24px', zIndex: '3000',
      padding: '14px 18px', borderRadius: '12px',
      boxShadow: '0 12px 30px rgba(15,76,92,.2)', fontWeight: '700',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#fde2e2' : '#dff7f1';
  toast.style.color = type === 'error' ? '#9b2c2c' : '#0f5f55';
  toast.style.display = '';
  clearTimeout(showContraceptiveToast.timeout);
  showContraceptiveToast.timeout = setTimeout(() => { toast.style.display = 'none'; }, 4500);
}

function openContraceptiveModal(record = null) {
  const form = document.getElementById('contraceptiveForm');
  form.reset();
  contraceptiveState.editingId = record?.id || null;
  contraceptiveState.applyingSourceId = null;
  contraceptiveState.renewingExpiredId = null;
  const notice = document.getElementById('controlApplyNotice');
  notice.hidden = true;
  notice.textContent = 'Comprueba la identidad del paciente, la fecha, el medicamento y el responsable. La aplicación se registra solo después de confirmarla.';
  document.getElementById('contraceptiveModalTitle').textContent = record ? 'Editar aplicación' : 'Nueva aplicación';
  hideQuickPatientForm();
  contraceptiveState.patientAutocomplete.clear();
  if(record?.patientId)contraceptiveState.patientAutocomplete.select(record.patientId);
  renderStaffOptions(record?.procedureResponsible);
  form.elements.applicationDate.value = record?.applicationDate || window.MedSolutionDate.today();
  form.elements.contraceptiveType.value = record?.contraceptiveType || '';
  form.elements.medication.value = record?.contraceptiveMedication || '';
  form.elements.observations.value = record?.contraceptiveObservations || '';
  form.elements.price.value = Number(record?.servicePrice ?? configuredPrice()) || 0;
  document.getElementById('contraceptivePriceField').style.display = hasFullAccess() ? '' : 'none';
  document.getElementById('contraceptiveResponsibleField').style.display = '';
  form.elements.price.disabled = true;
  form.elements.responsible.disabled = false;
  showContraceptiveStatus();
  updateNextApplicationPreview();
  document.getElementById('contraceptiveModal').classList.add('nursing-modal--active');
}


function openApplyScheduledDose(record) {
  if (!canApplyScheduledDose(record)) {
    showContraceptiveToast('Esta dosis no está pendiente o ya tiene una aplicación posterior.', 'error');
    return;
  }
  if (!contraceptiveState.patients.some(patient => Number(patient.id) === Number(record.patientId))) {
    showContraceptiveToast('No se encontró el paciente. Actualiza el listado antes de continuar.', 'error');
    return;
  }
  // Siempre abrir una NUEVA aplicación: no editar la dosis anterior.
  openContraceptiveModal();
  const form = document.getElementById('contraceptiveForm');
  contraceptiveState.patientAutocomplete.select(record.patientId);
  contraceptiveState.applyingSourceId = record.remoteId || record.id;
  form.elements.applicationDate.value = window.MedSolutionDate.today();
  form.elements.contraceptiveType.value = record.contraceptiveType || '';
  form.elements.medication.value = record.contraceptiveMedication || '';
  form.elements.responsible.value = ''; // Revalidar responsable en cada aplicación.
  document.getElementById('contraceptiveModalTitle').textContent = 'Registrar aplicación programada';
  document.getElementById('controlApplyNotice').hidden = false;
  updateNextApplicationPreview();
}

function openNewApplicationAfterExpiry(record) {
  if (!canStartNewApplicationAfterExpiry(record)) {
    showContraceptiveToast('Este control ya no está vencido o existe una aplicación posterior.', 'error');
    return;
  }
  if (!contraceptiveState.patients.some(patient => Number(patient.id) === Number(record.patientId))) {
    showContraceptiveToast('No se encontró el paciente. Actualiza el listado antes de continuar.', 'error');
    return;
  }
  // Un vencimiento NO confirma una nueva administración ni que el medicamento sea inválido.
  // El profesional decide según la situación clínica; nunca se edita la dosis histórica.
  openContraceptiveModal();
  const form = document.getElementById('contraceptiveForm');
  contraceptiveState.patientAutocomplete.select(record.patientId);
  contraceptiveState.renewingExpiredId = record.remoteId || record.id;
  form.elements.applicationDate.value = window.MedSolutionDate.today();
  form.elements.contraceptiveType.value = '';
  form.elements.medication.value = '';
  form.elements.responsible.value = '';
  document.getElementById('contraceptiveModalTitle').textContent = 'Nueva aplicación — fecha anterior vencida';
  const notice = document.getElementById('controlApplyNotice');
  notice.textContent = 'La fecha programada anterior ya pasó. Antes de registrar una nueva administración, verifica si procede clínicamente y confirma fecha, anticonceptivo, medicamento y responsable. Se conservará el registro histórico.';
  notice.hidden = false;
  updateNextApplicationPreview();
}

function closeContraceptiveModal() {
  contraceptiveState.applyingSourceId = null;
  contraceptiveState.renewingExpiredId = null;
  document.getElementById('controlApplyNotice').hidden = true;
  document.getElementById('contraceptiveForm').reset();
  hideQuickPatientForm();
  document.getElementById('contraceptiveModal').classList.remove('nursing-modal--active');
  contraceptiveState.editingId = null;
}

function setContraceptiveSaving(saving) {
  const form = document.getElementById('contraceptiveForm');
  const button = document.getElementById('saveContraceptiveBtn');
  contraceptiveState.saving = saving;
  form.querySelectorAll('button, input, select, textarea').forEach((control) => {
    if (saving) {
      control.dataset.controlDisabled = String(control.disabled);
      control.disabled = true;
    } else {
      control.disabled = control.dataset.controlDisabled === 'true';
      delete control.dataset.controlDisabled;
    }
  });
  if (saving) {
    button.dataset.originalText = button.textContent;
    button.textContent = '⏳ Guardando…';
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.originalText || 'Guardar aplicación';
    button.removeAttribute('aria-busy');
    delete button.dataset.originalText;
    document.getElementById('contraceptivePriceField').style.display = hasFullAccess() ? '' : 'none';
    document.getElementById('contraceptiveResponsibleField').style.display = '';
    form.elements.price.disabled = true;
    form.elements.responsible.disabled = false;
  }
}

function scheduledDoseFor(controlRemoteId) {
  return contraceptiveState.attentions.find((item) =>
    item.contraceptiveSchedule === true
    && item.sourceContraceptiveRemoteId === controlRemoteId);
}

async function saveScheduledDose(control, service, user) {
  const existing = scheduledDoseFor(control.remoteId);
  const schedule = {
    ...(existing || {}),
    patientId: control.patientId,
    patientName: control.patientName,
    serviceId: service?.id || control.serviceId || null,
    serviceType: `Próxima aplicación · ${control.contraceptiveType}`,
    servicePrice: 0,
    procedureResponsible: control.procedureResponsible,
    registeredByUserId: existing?.registeredByUserId || user?.id || null,
    registeredBy: existing?.registeredBy || user?.name || user?.username || 'Usuario',
    status: 'Pendiente',
    scheduleStatus: 'Pendiente',
    createdAt: `${control.nextApplicationDate}T12:00:00-04:00`,
    date: control.nextApplicationDate,
    time: '12:00',
    chiefComplaint: '',
    requiresMedicalConsultation: false,
    generatesMedicalRecord: false,
    contraceptiveControl: false,
    contraceptiveSchedule: true,
    sourceContraceptiveRemoteId: control.remoteId,
    contraceptiveType: control.contraceptiveType,
    contraceptiveMedication: control.contraceptiveMedication || '',
    applicationDate: control.applicationDate,
    nextApplicationDate: control.nextApplicationDate,
    appointmentObservations: `Próxima dosis ${control.contraceptiveType.toLowerCase()}`,
  };
  return window.MedSolutionData.saveAttention(schedule);
}

async function saveContraceptive(event) {
  event.preventDefault();
  if (contraceptiveState.saving) return;
  const form = event.currentTarget;
  const patientId = Number(form.elements.patientId.value);
  const patient = contraceptiveState.patients.find((item) => Number(item.id) === patientId);
  const applicationDate = form.elements.applicationDate.value;
  const type = form.elements.contraceptiveType.value;
  const nextDate = nextApplicationDate(applicationDate, type);
  const responsible = form.elements.responsible.value;
  if (!patient) {
    showContraceptiveStatus('Debe seleccionar un paciente.');
    document.querySelector('#contraceptivePatientAutocomplete [data-patient-autocomplete-input]')?.focus();
    return;
  }
  if (!applicationDate) {
    showContraceptiveStatus('Debe seleccionar la fecha de aplicación.');
    form.elements.applicationDate.focus();
    return;
  }
  if (!type) {
    showContraceptiveStatus('Debe seleccionar el tipo de anticonceptivo.');
    form.elements.contraceptiveType.focus();
    return;
  }
  if (!responsible) {
    showContraceptiveStatus('Debe seleccionar al responsable de la aplicación.');
    form.elements.responsible.focus();
    return;
  }

  const previous = contraceptiveState.records.find((item) => Number(item.id) === Number(contraceptiveState.editingId));
  const service = contraceptiveService();
  const sameType = previous?.contraceptiveType === type;
  const price = Number(sameType ? previous.servicePrice : configuredPrice());
  const user = currentUser();
  const record = {
    ...(previous || {}),
    patientId,
    patientName: patientName(patient),
    serviceId: service?.id || previous?.serviceId || null,
    serviceType: service?.name || previous?.serviceType || 'Anticonceptivos',
    servicePrice: price,
    procedureResponsible: responsible,
    registeredByUserId: previous?.registeredByUserId || user?.id || null,
    registeredBy: previous?.registeredBy || user?.name || user?.username || 'Usuario',
    status: 'Finalizada',
    createdAt: `${applicationDate}T12:00:00`,
    date: applicationDate,
    time: '12:00',
    chiefComplaint: '',
    requiresMedicalConsultation: false,
    generatesMedicalRecord: false,
    contraceptiveControl: true,
    contraceptiveType: type,
    contraceptiveMedication: form.elements.medication.value.trim(),
    applicationDate,
    nextApplicationDate: nextDate,
    nextControl: nextDate,
    contraceptiveObservations: form.elements.observations.value.trim(),
  };

  showContraceptiveStatus();
  setContraceptiveSaving(true);
  try {
    // Comprobar datos recientes antes de guardar para reducir duplicados en equipos distintos.
    if (!previous) {
      const fresh = await window.MedSolutionData.getAttentions();
      const controls = fresh.filter(item => item.contraceptiveControl === true);
      const duplicate = controls.some(item => Number(item.patientId) === patientId
        && String(item.applicationDate || item.date || '').slice(0,10) === applicationDate
        && item.contraceptiveType === type);
      if (duplicate) throw new Error('Ya existe una aplicación de este tipo registrada para este paciente y fecha. Revisa su historial.');
      if (contraceptiveState.applyingSourceId !== null) {
        const source = controls.find(item => String(item.remoteId || item.id) === String(contraceptiveState.applyingSourceId));
        if (!canApplyScheduledDose(source, controls)) {
          throw new Error('La dosis ya fue registrada o cambió su programación. Actualiza el listado.');
        }
        if (!confirm(`¿Confirmas que se administró el anticonceptivo ${type.toLowerCase()} a ${patientName(patient)} el ${formatControlDate(applicationDate)}?\nVerifica medicamento y responsable antes de continuar.`)) {
          return;
        }
      }
      if (contraceptiveState.renewingExpiredId !== null) {
        const source = controls.find(item => String(item.remoteId || item.id) === String(contraceptiveState.renewingExpiredId));
        if (!canStartNewApplicationAfterExpiry(source, controls)) {
          throw new Error('El control cambió o ya se registró una aplicación posterior. Actualiza el listado.');
        }
        if (!confirm(`¿Confirmas que se administró el anticonceptivo ${type.toLowerCase()} a ${patientName(patient)} el ${formatControlDate(applicationDate)}?\nSe guardará una nueva aplicación sin modificar la vencida.`)) {
          return;
        }
      }
    }
    const saved = await window.MedSolutionData.saveAttention(record);
    if (!saved?.remoteId || !Number(saved.id)) {
      throw new Error('Supabase no confirmó la creación del registro.');
    }
    try {
      await saveScheduledDose(saved, service, user);
    } catch (scheduleError) {
      try {
        if (previous) await window.MedSolutionData.saveAttention(previous);
        else await window.MedSolutionData.deleteAttention(saved.id);
      } catch (rollbackError) {
        throw new Error(`No se pudo crear la próxima dosis en Agenda: ${scheduleError.message}. Tampoco se pudo revertir el registro: ${rollbackError.message}`);
      }
      throw new Error(`No se pudo crear la próxima dosis en Agenda: ${scheduleError.message}`);
    }
    await loadContraceptiveData();
    renderResponsibleFilter();
    contraceptiveState.page = 1; // Mostrar inmediatamente la fecha nueva en la ficha única.
    renderContraceptiveTable();
    form.reset();
    closeContraceptiveModal();
    showContraceptiveToast(price > 0
      ? 'Aplicación guardada y registrada en los ingresos.'
      : 'Control de anticonceptivo guardado correctamente.');
  } catch (error) {
    const message = error?.message || 'No se pudo guardar el control.';
    showContraceptiveStatus(message);
    showContraceptiveToast(`Error: ${message}`, 'error');
  } finally {
    setContraceptiveSaving(false);
  }
}

async function deleteContraceptive(record) {
  if (!hasFullAccess() || !confirm('¿Eliminar este control de anticonceptivo?')) return;
  try {
    const scheduled = scheduledDoseFor(record.remoteId);
    if (scheduled) await window.MedSolutionData.deleteAttention(scheduled.id);
    await window.MedSolutionData.deleteAttention(record.id);
    await loadContraceptiveData();
    renderResponsibleFilter();
    renderContraceptiveTable();
    showContraceptiveToast('Control eliminado correctamente.');
  } catch (error) {
    showContraceptiveToast(`No se pudo eliminar: ${error.message}`, 'error');
  }
}

function openPatientHistory(record) {
  if (!hasFullAccess()) return;
  const patientRecords = contraceptiveState.records
    .filter((item) => Number(item.patientId) === Number(record.patientId))
    .sort((a, b) => String(b.applicationDate).localeCompare(String(a.applicationDate)));
  document.getElementById('contraceptiveHistoryTitle').textContent = `Historial · ${record.patientName}`;
  document.getElementById('contraceptiveHistoryBody').innerHTML = patientRecords.length
    ? patientRecords.map((item) => `<tr><td>${formatControlDate(item.applicationDate)}</td><td>${escapeControlHtml(item.contraceptiveType)}</td><td>${escapeControlHtml(item.contraceptiveMedication || '—')}</td><td>${escapeControlHtml(item.procedureResponsible || '—')}</td><td>${formatControlDate(item.nextApplicationDate)}</td><td>${Number(item.servicePrice || 0).toFixed(2)} Bs</td><td>${escapeControlHtml(item.contraceptiveObservations || '—')}</td></tr>`).join('')
    : '<tr><td colspan="7" class="control-empty">Sin aplicaciones registradas.</td></tr>';
  document.getElementById('contraceptiveHistoryModal').classList.add('nursing-modal--active');
}

function closePatientHistory() {
  document.getElementById('contraceptiveHistoryModal').classList.remove('nursing-modal--active');
}

async function setupContraceptives() {
  await window.MedSolutionData?.ready;
  try {
    await loadContraceptiveData();
  } catch (error) {
    showContraceptiveToast(`No se pudo cargar el módulo: ${error.message}`, 'error');
    return;
  }
  renderContraceptiveTable();
  renderResponsibleFilter();
  focusNotifiedContraceptive();
  contraceptiveState.patientAutocomplete=window.MedSolutionPatientAutocomplete.create({root:'#contraceptivePatientAutocomplete',patients:contraceptiveState.patients,medicalRecords:contraceptiveState.medicalRecords,onSelect:()=>showContraceptiveStatus()});
  document.getElementById('newContraceptiveBtn').addEventListener('click', () => openContraceptiveModal());
  document.getElementById('closeContraceptiveModalBtn').addEventListener('click', closeContraceptiveModal);
  document.getElementById('cancelContraceptiveModalBtn').addEventListener('click', closeContraceptiveModal);
  document.querySelector('#contraceptiveModal .nursing-modal__overlay').addEventListener('click', closeContraceptiveModal);
  document.getElementById('contraceptiveForm').addEventListener('submit', saveContraceptive);
  document.getElementById('showQuickPatientBtn').addEventListener('click', showQuickPatientForm);
  document.getElementById('cancelQuickPatientBtn').addEventListener('click', hideQuickPatientForm);
  document.getElementById('saveQuickPatientBtn').addEventListener('click', saveQuickPatient);
  document.getElementById('quickPatientPanel').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveQuickPatient();
    }
  });
  document.querySelector('#contraceptiveForm [name="applicationDate"]').addEventListener('change', () => {
    showContraceptiveStatus();
    updateNextApplicationPreview();
  });
  document.querySelector('#contraceptiveForm [name="contraceptiveType"]').addEventListener('change', () => {
    showContraceptiveStatus();
    updateNextApplicationPreview();
    document.querySelector('#contraceptiveForm [name="price"]').value = configuredPrice();
  });
  document.querySelector('#contraceptiveForm [name="responsible"]').addEventListener('change', () => showContraceptiveStatus());
  [['controlServiceFilter','service'],['controlResponsibleFilter','responsible'],['controlMonthFilter','month'],['controlYearFilter','year']].forEach(([id,key])=>document.getElementById(id).addEventListener('change',event=>{contraceptiveState.filters[key]=event.target.value;contraceptiveState.page=1;renderContraceptiveTable()}));
  document.getElementById('controlPrevPage').addEventListener('click', () => { contraceptiveState.page -= 1; renderContraceptiveTable(); });
  document.getElementById('controlNextPage').addEventListener('click', () => { contraceptiveState.page += 1; renderContraceptiveTable(); });
  document.getElementById('closeContraceptiveHistoryBtn').addEventListener('click', closePatientHistory);
  document.querySelector('#contraceptiveHistoryModal .nursing-modal__overlay').addEventListener('click', closePatientHistory);
  document.getElementById('controlTableBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-control-action]');
    if (!button) return;
    const record = contraceptiveState.records.find((item) => Number(item.id) === Number(button.dataset.id));
    if (!record) return;
    if (button.dataset.controlAction === 'apply') openApplyScheduledDose(record);
    if (button.dataset.controlAction === 'new-after-expiry') openNewApplicationAfterExpiry(record);
    if (button.dataset.controlAction === 'history') openPatientHistory(record);
    if (button.dataset.controlAction === 'edit') openContraceptiveModal(record);
    if (button.dataset.controlAction === 'delete') deleteContraceptive(record);
  });
  window.MedSolutionData.subscribeAttentions(async () => {
    await loadContraceptiveData();
    renderResponsibleFilter();
    renderContraceptiveTable();
  });
  window.MedSolutionData.subscribePatients(async () => {
    await loadContraceptiveData();
    contraceptiveState.patientAutocomplete.update(contraceptiveState.patients,contraceptiveState.medicalRecords);
    renderResponsibleFilter();
    renderContraceptiveTable();
  });
  window.MedSolutionData.subscribeServices(async () => {
    await loadContraceptiveData();
    renderResponsibleFilter();
    renderContraceptiveTable();
  });
  window.MedSolutionData.subscribeStaff(async () => {
    await loadContraceptiveData();
    renderResponsibleFilter();
    renderStaffOptions(document.querySelector('#contraceptiveForm [name="responsible"]')?.value || '');
    renderContraceptiveTable();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupContraceptives, { once: true });
else setupContraceptives();
