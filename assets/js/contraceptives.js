const contraceptiveState = {
  records: [],
  attentions: [],
  patients: [],
  staff: [],
  services: [],
  editingId: null,
  saving: false,
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
  const today = dateOnly(new Date().toISOString().slice(0, 10));
  const next = dateOnly(record.nextApplicationDate);
  const days = Math.ceil((next - today) / 86400000);
  if (days < 0) return 'Vencido';
  if (days <= 7) return 'Próximo';
  return 'Vigente';
}

function statusBadge(record) {
  const status = controlStatus(record);
  const config = {
    Vigente: ['🟢', 'control-status--current'],
    Próximo: ['🟡', 'control-status--soon'],
    Vencido: ['🔴', 'control-status--expired'],
  }[status];
  return `<span class="control-status ${config[1]}">${config[0]} ${status}</span>`;
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
  const [patients, staff, services, attentions] = await Promise.all([
    window.MedSolutionData.getPatients(),
    window.MedSolutionData.getStaff(),
    window.MedSolutionData.getServices(true),
    window.MedSolutionData.getAttentions(),
  ]);
  contraceptiveState.patients = patients;
  contraceptiveState.staff = staff;
  contraceptiveState.services = services;
  contraceptiveState.attentions = attentions;
  contraceptiveState.records = attentions.filter((item) => item.contraceptiveControl === true);
}

function filteredRecords() {
  return contraceptiveState.records
    .filter((record) => !contraceptiveState.filters.service || record.serviceType === contraceptiveState.filters.service)
    .filter((record) => !contraceptiveState.filters.responsible || record.procedureResponsible === contraceptiveState.filters.responsible)
    .filter((record) => !contraceptiveState.filters.month || String(record.applicationDate||record.date||'').slice(5,7) === contraceptiveState.filters.month)
    .filter((record) => !contraceptiveState.filters.year || String(record.applicationDate||record.date||'').slice(0,4) === contraceptiveState.filters.year)
    .sort((a, b) => String(b.applicationDate).localeCompare(String(a.applicationDate)));
}

function renderContraceptiveTable() {
  const body = document.getElementById('controlTableBody');
  const records = filteredRecords();
  const showPrice = hasFullAccess();
  document.querySelectorAll('[data-price-column]').forEach((element) => {
    element.style.display = showPrice ? '' : 'none';
  });
  if (!records.length) {
    body.innerHTML = `<tr><td colspan="${showPrice ? 9 : 8}" class="control-empty">No hay controles para los filtros seleccionados.</td></tr>`;
  } else {
    body.innerHTML = records.map((record) => {
      const patient = contraceptiveState.patients.find((item) => Number(item.id) === Number(record.patientId));
      return `<tr>
        <td><strong>${escapeControlHtml(record.patientName)}</strong></td>
        <td>${escapeControlHtml(patient?.telefono || '—')}</td>
        <td>${formatControlDate(record.applicationDate)}</td>
        <td><strong>${formatControlDate(record.nextApplicationDate)}</strong></td>
        <td>${escapeControlHtml(record.contraceptiveType)}</td>
        <td>${escapeControlHtml(record.procedureResponsible || '—')}</td>
        <td>${statusBadge(record)}</td>
        <td data-price-column style="${showPrice ? '' : 'display:none'}">${Number(record.servicePrice || 0).toFixed(2)} Bs</td>
        <td><span class="action-links">
          ${hasFullAccess() ? `<button class="btn-action" type="button" data-control-action="history" data-id="${record.id}" title="Ver historial">▣</button>
          <button class="btn-action" type="button" data-control-action="edit" data-id="${record.id}" title="Editar">✎</button>
          <button class="btn-action btn-action--delete" type="button" data-control-action="delete" data-id="${record.id}" title="Eliminar">✕</button>` : '<span style="color:var(--gray-500)">—</span>'}
        </span></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('controlCount').textContent = `${records.length} registro${records.length === 1 ? '' : 's'}`;
}

function renderPatientOptions(term = '', selectedId = '') {
  const select = document.getElementById('contraceptivePatient');
  const currentSelection = selectedId || select.value;
  const query = term.toLowerCase().trim();
  const patients = contraceptiveState.patients.filter((patient) =>
    !query || `${patientName(patient)} ${patient.ci || ''} ${patient.telefono || ''}`.toLowerCase().includes(query));
  select.innerHTML = '<option value="">Seleccionar…</option>' + patients
    .map((patient) => `<option value="${patient.id}">${escapeControlHtml(patientName(patient))} · ${escapeControlHtml(patient.telefono || 'Sin teléfono')}</option>`)
    .join('');
  if (currentSelection && patients.some((patient) => String(patient.id) === String(currentSelection))) {
    select.value = String(currentSelection);
  }
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
  const names = [...new Set([
    ...contraceptiveState.staff.map((person) => person.name),
    ...contraceptiveState.records.map((record) => record.procedureResponsible),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const definitions=[['controlServiceFilter',[...new Set(contraceptiveState.records.map(record=>record.serviceType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))],['controlResponsibleFilter',names],['controlMonthFilter',[...new Set(contraceptiveState.records.map(record=>String(record.applicationDate||record.date||'').slice(5,7)).filter(Boolean))].sort()],['controlYearFilter',[...new Set(contraceptiveState.records.map(record=>String(record.applicationDate||record.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a))]];
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
        registrado: new Date().toISOString().slice(0, 10),
      });
    }
    const index = contraceptiveState.patients.findIndex((item) => Number(item.id) === Number(patient.id));
    if (index >= 0) contraceptiveState.patients[index] = patient;
    else contraceptiveState.patients.push(patient);
    document.getElementById('contraceptivePatientSearch').value = '';
    renderPatientOptions('', patient.id);
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
  document.getElementById('contraceptiveModalTitle').textContent = record ? 'Editar aplicación' : 'Nueva aplicación';
  document.getElementById('contraceptivePatientSearch').value = '';
  hideQuickPatientForm();
  renderPatientOptions('', record?.patientId);
  renderStaffOptions(record?.procedureResponsible);
  form.elements.applicationDate.value = record?.applicationDate || new Date().toISOString().slice(0, 10);
  form.elements.contraceptiveType.value = record?.contraceptiveType || '';
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

function closeContraceptiveModal() {
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
    form.elements.patientId.focus();
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
    applicationDate,
    nextApplicationDate: nextDate,
    nextControl: nextDate,
    contraceptiveObservations: form.elements.observations.value.trim(),
  };

  showContraceptiveStatus();
  setContraceptiveSaving(true);
  try {
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
    ? patientRecords.map((item) => `<tr><td>${formatControlDate(item.applicationDate)}</td><td>${escapeControlHtml(item.contraceptiveType)}</td><td>${escapeControlHtml(item.procedureResponsible || '—')}</td><td>${formatControlDate(item.nextApplicationDate)}</td><td>${Number(item.servicePrice || 0).toFixed(2)} Bs</td><td>${escapeControlHtml(item.contraceptiveObservations || '—')}</td></tr>`).join('')
    : '<tr><td colspan="6" class="control-empty">Sin aplicaciones registradas.</td></tr>';
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
  document.querySelector('#contraceptiveForm [name="patientId"]').addEventListener('change', () => showContraceptiveStatus());
  document.querySelector('#contraceptiveForm [name="responsible"]').addEventListener('change', () => showContraceptiveStatus());
  document.getElementById('contraceptivePatientSearch').addEventListener('input', (event) => {
    renderPatientOptions(event.target.value, document.getElementById('contraceptivePatient').value);
  });
  [['controlServiceFilter','service'],['controlResponsibleFilter','responsible'],['controlMonthFilter','month'],['controlYearFilter','year']].forEach(([id,key])=>document.getElementById(id).addEventListener('change',event=>{contraceptiveState.filters[key]=event.target.value;renderContraceptiveTable()}));
  document.getElementById('closeContraceptiveHistoryBtn').addEventListener('click', closePatientHistory);
  document.querySelector('#contraceptiveHistoryModal .nursing-modal__overlay').addEventListener('click', closePatientHistory);
  document.getElementById('controlTableBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-control-action]');
    if (!button) return;
    const record = contraceptiveState.records.find((item) => Number(item.id) === Number(button.dataset.id));
    if (!record) return;
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
