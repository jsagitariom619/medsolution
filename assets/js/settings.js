// Settings Module — perfiles operativos y parámetros centralizados.

const REQUIRED_SERVICE_VALUES = Object.freeze([
  { label: 'Consulta médica', match: (value) => value.includes('consulta'), medical: true, record: true, responsible: 'Doctor' },
  { label: 'Curaciones', match: (value) => value.includes('curaci') },
  { label: 'Nebulizaciones', match: (value) => value.includes('nebul') },
  { label: 'Inyectables', match: (value) => value.includes('inyect') },
  { label: 'Sueroterapia', match: (value) => value.includes('sueroterapia') },
  { label: 'Procedimientos estéticos', match: (value) => value.includes('estetic') },
  { label: 'Podología', match: (value) => value.includes('podolog') },
  { label: 'Otros procedimientos', match: (value) => value === 'otro' || value === 'procedimientos' || value.includes('otro procedimiento') },
  { label: 'Registro de Anticonceptivos', match: (value) => value.includes('anticoncept') && !value.includes('mensual') && !value.includes('trimestral'), contraceptive: true },
]);

const settingsServiceState = { services: [], savingId: null, subscribed: false };
const systemUsersState = { users: [], editing: null, pendingPhoto: null, removePhoto: false, saving: false, subscribed: false };
const SETTINGS_TIMEOUT_MS = 12000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('medsolution.authUser') || localStorage.getItem('medsolution.authUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function withSettingsTimeout(promise, operation) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} superó el tiempo máximo de 12 segundos.`)), SETTINGS_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timeoutId));
}

function settingsErrorMessage(error, context) {
  const detail = error?.message || String(error || 'Error desconocido');
  return `${context}: ${detail}`;
}

function renderServiceValuesError(error) {
  const message = settingsErrorMessage(error, 'No se pudieron cargar los servicios');
  console.error('[Configuración] Error al consultar public.servicios:', error);
  const body = document.getElementById('serviceValuesTableBody');
  if (body) body.innerHTML = `<tr><td colspan="4" class="patients-empty" style="color:#c93047">${escapeSettingsHtml(message)}</td></tr>`;
  const status = document.getElementById('serviceValuesStatus');
  if (status) { status.textContent = message; status.style.color = '#c93047'; }
}

function renderSystemUsersError(error) {
  const message = settingsErrorMessage(error, 'No se pudieron cargar los usuarios');
  console.error('[Configuración] Error al consultar public.perfiles_sistema:', error);
  const body = document.getElementById('usersTableBody');
  if (body) body.innerHTML = `<tr><td colspan="6" class="patients-empty" style="color:#c93047">${escapeSettingsHtml(message)} Verifica la migración 202607310002 y sus políticas RLS.</td></tr>`;
}

async function ensureSupabaseReady() {
  const client = await withSettingsTimeout(window.MedSolutionData.ready, 'La inicialización de Supabase');
  if (!client || !window.MedSolutionData.isConfigured()) {
    throw new Error('Supabase no está configurado. Verifica SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y /api/config.');
  }
  return client;
}

async function loadUsers() {
  await ensureSupabaseReady();
  systemUsersState.users = await withSettingsTimeout(
    window.MedSolutionData.getSystemUsers(),
    'La consulta a public.perfiles_sistema',
  );
  return systemUsersState.users;
}

function hashPassword(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function setUserPhotoPreview(user, objectUrl = '') {
  const preview = document.getElementById('systemUserPhotoPreview');
  if (!preview) return;
  const source = objectUrl || (!systemUsersState.removePhoto ? user?.photoUrl : '');
  preview.style.backgroundImage = source ? `url("${String(source).replace(/"/g, '%22')}")` : '';
  preview.textContent = source ? '' : getInitials(user?.name || 'Med Solution');
}

function openUserModal(user) {
  systemUsersState.editing = user;
  systemUsersState.pendingPhoto = null;
  systemUsersState.removePhoto = false;
  const modal = document.getElementById('systemUserModal');
  const form = document.getElementById('systemUserForm');
  form.elements.name.value = user.name || '';
  form.elements.username.value = user.username || '';
  form.elements.password.value = '';
  form.elements.position.value = user.position || '';
  form.elements.role.value = user.role || '';
  form.elements.active.value = String(user.active !== false);
  document.getElementById('systemUserStatus').textContent = '';
  setUserPhotoPreview(user);
  modal.classList.add('modal--open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeUserModal() {
  const modal = document.getElementById('systemUserModal');
  modal?.classList.remove('modal--open');
  modal?.setAttribute('aria-hidden', 'true');
  systemUsersState.pendingPhoto = null;
  systemUsersState.editing = null;
}

function publishSystemUsers(users) {
  localStorage.setItem('medsolution.systemUsers', JSON.stringify(users));
  window.parent?.postMessage({ type: 'medsolution:users-updated' }, location.origin);
}

async function saveConfiguredUser(event) {
  event.preventDefault();
  if (systemUsersState.saving || !systemUsersState.editing) return;
  const form = event.currentTarget;
  const status = document.getElementById('systemUserStatus');
  const button = document.getElementById('saveSystemUserBtn');
  const name = form.elements.name.value.trim();
  const username = form.elements.username.value.trim();
  if (!name) { status.textContent = 'Ingrese el nombre completo.'; return; }
  if (!username) { status.textContent = 'Ingrese el usuario.'; return; }
  if (systemUsersState.users.some((user) => user.id !== systemUsersState.editing.id && user.username.toLowerCase() === username.toLowerCase())) {
    status.textContent = 'Ese nombre de usuario ya está en uso.'; return;
  }
  systemUsersState.saving = true;
  button.disabled = true;
  button.textContent = 'Guardando…';
  status.textContent = '';
  let newPhotoPath = '';
  try {
    if (systemUsersState.pendingPhoto) {
      newPhotoPath = await window.MedSolutionData.uploadProfilePhoto(systemUsersState.editing.role, systemUsersState.pendingPhoto);
    }
    const saved = await window.MedSolutionData.saveSystemUser({
      ...systemUsersState.editing,
      name,
      username,
      position: form.elements.position.value.trim(),
      active: form.elements.active.value === 'true',
      passwordHash: form.elements.password.value ? hashPassword(form.elements.password.value) : systemUsersState.editing.passwordHash,
      photoPath: newPhotoPath || (systemUsersState.removePhoto ? '' : systemUsersState.editing.photoPath),
    });
    if ((newPhotoPath || systemUsersState.removePhoto) && systemUsersState.editing.photoPath) {
      await window.MedSolutionData.deleteStoredFile(systemUsersState.editing.photoPath).catch(() => {});
    }
    await loadUsers();
    publishSystemUsers(systemUsersState.users);
    await renderUsersTable(false);
    status.textContent = `✓ Perfil ${saved.role} actualizado.`;
    status.style.color = 'var(--aqua)';
    setTimeout(closeUserModal, 650);
  } catch (error) {
    console.error('[Configuración] No se pudo guardar el perfil del sistema:', error);
    if (newPhotoPath) await window.MedSolutionData.deleteStoredFile(newPhotoPath).catch(() => {});
    status.textContent = error.message || 'No se pudo guardar el perfil.';
    status.style.color = '#c93047';
  } finally {
    systemUsersState.saving = false;
    button.disabled = false;
    button.textContent = 'Guardar cambios';
  }
}

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  return (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

function roleBadgeClass(role) {
  switch (role) {
    case 'Administrador': return 'role-badge role-badge--admin';
    case 'Médico':        return 'role-badge role-badge--medico';
    case 'Auxiliar':      return 'role-badge role-badge--auxiliar';
    default:              return 'role-badge';
  }
}

function normalizeServiceValue(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function escapeSettingsHtml(value) {
  const element = document.createElement('div');
  element.textContent = value == null ? '' : String(value);
  return element.innerHTML;
}

function servicesForValuesTable() {
  const used = new Set();
  const required = REQUIRED_SERVICE_VALUES.map((definition, index) => {
    const existing = settingsServiceState.services.find((service) => {
      if (used.has(String(service.id))) return false;
      return definition.match(normalizeServiceValue(service.name));
    });
    if (existing) used.add(String(existing.id));
    return existing || {
      id: `new-${index}`,
      name: definition.label,
      price: 0,
      active: true,
      description: definition.contraceptive ? '[MedSolution:anticonceptivos]' : '',
      requires_medical_consultation: Boolean(definition.medical),
      generates_medical_record: Boolean(definition.record),
      allowed_responsible: definition.responsible || 'Ambos',
      isNew: true,
    };
  });
  const additional = settingsServiceState.services.filter((service) => {
    if (used.has(String(service.id))) return false;
    const name = normalizeServiceValue(service.name);
    return !(name.includes('anticoncept') && (name.includes('mensual') || name.includes('trimestral')));
  });
  return [...required, ...additional];
}

function renderServiceValues() {
  const body = document.getElementById('serviceValuesTableBody');
  if (!body) return;
  const services = servicesForValuesTable();
  body.innerHTML = services.map((service) => `<tr data-service-value-row="${escapeSettingsHtml(service.id)}">
    <td><input class="service-value-input service-value-name" data-service-value-field="name" value="${escapeSettingsHtml(service.name)}" aria-label="Nombre del servicio" /></td>
    <td><input class="service-value-input" data-service-value-field="price" type="number" min="0" step="0.01" value="${Number(service.price || 0)}" aria-label="Precio en bolivianos" /></td>
    <td><select class="service-value-select" data-service-value-field="active" aria-label="Estado del servicio"><option value="true" ${service.active !== false ? 'selected' : ''}>Activo</option><option value="false" ${service.active === false ? 'selected' : ''}>Inactivo</option></select></td>
    <td><div class="service-value-actions"><button class="btn btn--primary" type="button" data-save-service-value="${escapeSettingsHtml(service.id)}">Guardar</button><span class="service-value-status" data-service-value-status="${escapeSettingsHtml(service.id)}"></span></div></td>
  </tr>`).join('');
}

async function loadServiceValues() {
  await ensureSupabaseReady();
  settingsServiceState.services = await withSettingsTimeout(
    window.MedSolutionData.getServices(true),
    'La consulta a public.servicios',
  );
  renderServiceValues();
}

async function saveServiceValue(button) {
  if (settingsServiceState.savingId) return;
  const id = button.dataset.saveServiceValue;
  const row = button.closest('[data-service-value-row]');
  const displayed = servicesForValuesTable().find((service) => String(service.id) === String(id));
  if (!row || !displayed) return;
  const name = row.querySelector('[data-service-value-field="name"]').value.trim();
  const priceField = row.querySelector('[data-service-value-field="price"]');
  const price = priceField.value.trim() === '' ? 0 : Number(priceField.value);
  const active = row.querySelector('[data-service-value-field="active"]').value === 'true';
  const status = row.querySelector('[data-service-value-status]');
  if (!name) { status.textContent = 'Ingrese un nombre.'; status.style.color = '#c93047'; return; }
  if (!Number.isFinite(price) || price < 0) { status.textContent = 'Precio inválido.'; status.style.color = '#c93047'; return; }
  const contraceptive = normalizeServiceValue(displayed.name).includes('anticoncept')
    || String(displayed.description || '').includes('[MedSolution:anticonceptivos]');
  const description = contraceptive && !String(displayed.description || '').includes('[MedSolution:anticonceptivos]')
    ? `${displayed.description || ''} [MedSolution:anticonceptivos]`.trim()
    : displayed.description || '';
  settingsServiceState.savingId = id;
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = '⏳ Guardando…';
  status.textContent = '';
  try {
    await window.MedSolutionData.saveService({
      ...displayed,
      ...(displayed.isNew ? { id: undefined } : {}),
      name, price, active, description,
      allowed_responsible: displayed.allowed_responsible || 'Ambos',
    });
    if (contraceptive) {
      const legacy = settingsServiceState.services.filter((service) => {
        const normalized = normalizeServiceValue(service.name);
        return service.active !== false && normalized.includes('anticoncept')
          && (normalized.includes('mensual') || normalized.includes('trimestral'));
      });
      for (const service of legacy) await window.MedSolutionData.toggleService(service.id, false);
    }
    await loadServiceValues();
    const globalStatus = document.getElementById('serviceValuesStatus');
    globalStatus.textContent = `✓ ${name} actualizado correctamente. Los registros nuevos usarán ${price.toFixed(2)} Bs.`;
    globalStatus.style.color = 'var(--aqua)';
  } catch (error) {
    console.error('[Configuración] No se pudo guardar el servicio o valor:', error);
    status.textContent = error.message || 'No se pudo guardar.';
    status.style.color = '#c93047';
  } finally {
    settingsServiceState.savingId = null;
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Guardar';
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

async function renderUsersTable(reload = true) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const users = reload ? await loadUsers() : systemUsersState.users;
  const emptyRow = document.getElementById('usersEmptyRow');

  if (emptyRow) emptyRow.style.display = users.length ? 'none' : '';

  Array.from(tbody.querySelectorAll('tr[data-user-row]')).forEach((r) => r.remove());

  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.dataset.userRow = u.id;
    tr.innerHTML = `
      <td>
        <div class="patient-cell">
          <span class="user-photo" ${u.photoUrl ? `style="background-image:url('${escapeSettingsHtml(u.photoUrl)}')"` : ''}>${u.photoUrl ? '' : (u.initials || getInitials(u.name))}</span>
          <strong>${escapeSettingsHtml(u.username)}</strong>
        </div>
      </td>
      <td>${escapeSettingsHtml(u.name)}</td>
      <td>${escapeSettingsHtml(u.position || '—')}</td>
      <td><span class="${roleBadgeClass(u.role)}">${u.role}</span></td>
      <td><span class="badge ${u.active === false ? 'badge--inactive' : ''}">${u.active === false ? 'Inactivo' : 'Activo'}</span></td>
      <td><button class="btn btn--secondary" type="button" data-edit-system-user="${u.id}">Editar</button></td>
    `;
    tbody.insertBefore(tr, emptyRow);
  });
}

async function initializeConnectionStatus() {
  const status = document.getElementById('supabaseConnectionStatus');
  if (!status) return;
  try {
    await ensureSupabaseReady();
    await withSettingsTimeout(window.MedSolutionData.testConnection(), 'La prueba de lectura en public.servicios');
    status.textContent = '✓ Registro Clínico conectado mediante variables de Vercel';
    status.style.color = 'var(--aqua)';
  } catch (error) {
    console.error('[Configuración] Falló la comprobación de conexión con Supabase:', error);
    status.textContent = settingsErrorMessage(error, 'Error de conexión');
    status.style.color = '#c93047';
  }
}

async function initializeSystemUsers() {
  try {
    await renderUsersTable();
    if (!systemUsersState.subscribed) {
      systemUsersState.subscribed = true;
      window.MedSolutionData.subscribeSystemUsers(async () => {
        try {
          await renderUsersTable();
          publishSystemUsers(systemUsersState.users);
        } catch (error) { renderSystemUsersError(error); }
      });
    }
  } catch (error) {
    renderSystemUsersError(error);
  }
}

async function initializeServiceValues() {
  try {
    await loadServiceValues();
    if (!settingsServiceState.subscribed) {
      settingsServiceState.subscribed = true;
      window.MedSolutionData.subscribeServices(async () => {
        try { await loadServiceValues(); }
        catch (error) { renderServiceValuesError(error); }
      });
    }
  } catch (error) {
    renderServiceValuesError(error);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function setupSettingsModule() {
  const currentUser = getCurrentUser();
  if (!currentUser || !['Administrador', 'Médico'].includes(currentUser.role)) return;

  document.getElementById('usersTableBody')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-system-user]');
    if (!button) return;
    const user = systemUsersState.users.find((item) => String(item.id) === button.dataset.editSystemUser);
    if (user) openUserModal(user);
  });
  document.querySelectorAll('[data-close-user-modal]').forEach((button) => button.addEventListener('click', closeUserModal));
  document.getElementById('systemUserForm')?.addEventListener('submit', saveConfiguredUser);
  document.getElementById('systemUserPhoto')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    systemUsersState.pendingPhoto = file;
    systemUsersState.removePhoto = false;
    setUserPhotoPreview(systemUsersState.editing, URL.createObjectURL(file));
  });
  document.getElementById('removeSystemUserPhoto')?.addEventListener('click', () => {
    systemUsersState.pendingPhoto = null;
    systemUsersState.removePhoto = true;
    document.getElementById('systemUserPhoto').value = '';
    setUserPhotoPreview(systemUsersState.editing);
  });
  document.getElementById('serviceValuesTableBody')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-save-service-value]');
    if (button) saveServiceValue(button);
  });

  // Cada bloque finaliza de forma independiente: una tabla ausente o un error
  // RLS nunca vuelve a bloquear el resto de la pantalla de Configuración.
  initializeConnectionStatus();
  initializeServiceValues();
  initializeSystemUsers();

  const generalForm = document.getElementById('generalSettingsForm');
  if (generalForm) {
    window.MedSolutionData.getSettings().then((settings) => {
      generalForm.elements.clinicName.value = settings.clinicName || 'Med Solution';
      generalForm.elements.currency.value = settings.currency || 'BOB';
      generalForm.elements.timezone.value = settings.timezone || 'America/La_Paz';
    }).catch((error) => {
      console.error('[Configuración] No se pudo cargar la configuración general:', error);
      document.getElementById('generalSettingsStatus').textContent = error.message;
    });
    generalForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('generalSettingsStatus');
      try {
        await window.MedSolutionData.saveSettings({
          clinicName: generalForm.elements.clinicName.value.trim(),
          currency: generalForm.elements.currency.value,
          timezone: generalForm.elements.timezone.value.trim(),
        });
        status.textContent = '✓ Configuración guardada';
        status.style.color = 'var(--aqua)';
      } catch (error) {
        console.error('[Configuración] No se pudo guardar la configuración general:', error);
        status.textContent = error.message;
        status.style.color = '#c93047';
      }
    });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupSettingsModule, { once: true });
else setupSettingsModule();
