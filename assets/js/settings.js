// Settings Module — muestra los tres usuarios predefinidos (solo lectura).
// Non-module script: kept as regular script for compatibility with non-module
// sibling scripts on this page. Refactor to ES module when migrating to Supabase.

const PREDEFINED_USERS = Object.freeze([
  { id: 1, username: 'admin', name: 'Administrador', role: 'Administrador', initials: 'AD', active: true },
  { id: 2, username: 'doctor', name: 'Médico Demo', role: 'Médico', initials: 'MD', active: true },
  { id: 3, username: 'auxiliar', name: 'Ana Martínez', role: 'Auxiliar', initials: 'AM', active: true },
]);

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('medsolution.authUser') || localStorage.getItem('medsolution.authUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function loadUsers() {
  return PREDEFINED_USERS.map((user) => ({ ...user }));
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
  settingsServiceState.services = await window.MedSolutionData.getServices(true);
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
    status.textContent = error.message || 'No se pudo guardar.';
    status.style.color = '#c93047';
  } finally {
    settingsServiceState.savingId = null;
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Guardar';
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

async function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const users = await loadUsers();
  const currentUser = getCurrentUser();
  const emptyRow = document.getElementById('usersEmptyRow');

  if (emptyRow) emptyRow.style.display = users.length ? 'none' : '';

  Array.from(tbody.querySelectorAll('tr[data-user-row]')).forEach((r) => r.remove());

  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.dataset.userRow = u.id;
    tr.innerHTML = `
      <td>
        <div class="patient-cell">
          <span class="avatar" style="width:34px;height:34px;font-size:.78rem">${u.initials || getInitials(u.name)}</span>
          <strong>${u.username}</strong>
        </div>
      </td>
      <td>${u.name}</td>
      <td><span class="${roleBadgeClass(u.role)}">${u.role}</span></td>
      <td><span class="badge ${u.active === false ? 'badge--inactive' : ''}">${u.active === false ? 'Inactivo' : 'Activo'}</span></td>
      <td><span style="color:var(--gray-500);font-size:.84rem">Definido en el sistema</span></td>
    `;
    tbody.insertBefore(tr, emptyRow);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function setupSettingsModule() {
  await window.MedSolutionData?.ready;
  // Only run user management if admin
  const currentUser = getCurrentUser();
  if (!currentUser || !['Administrador', 'Médico'].includes(currentUser.role)) return;

  renderUsersTable();
  document.getElementById('newUserBtn')?.remove();

  try {
    await loadServiceValues();
    document.getElementById('serviceValuesTableBody')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-save-service-value]');
      if (button) saveServiceValue(button);
    });
    if (!settingsServiceState.subscribed) {
      settingsServiceState.subscribed = true;
      window.MedSolutionData.subscribeServices(loadServiceValues);
    }
  } catch (error) {
    const status = document.getElementById('serviceValuesStatus');
    if (status) { status.textContent = error.message; status.style.color = '#c93047'; }
  }

  const configForm = document.getElementById('supabaseConfigForm');
  if (configForm) {
    const status = document.getElementById('supabaseConnectionStatus');
    window.MedSolutionData.ready.then(async () => {
      await window.MedSolutionData.testConnection();
      status.textContent = '✓ Registro Clínico conectado mediante variables de Vercel';
      status.style.color = 'var(--aqua)';
    }).catch((error) => {
      status.textContent = `Error: ${error.message}`;
      status.style.color = '#c93047';
    });
  }

  const generalForm = document.getElementById('generalSettingsForm');
  if (generalForm) {
    window.MedSolutionData.getSettings().then((settings) => {
      generalForm.elements.clinicName.value = settings.clinicName || 'Med Solution';
      generalForm.elements.currency.value = settings.currency || 'BOB';
      generalForm.elements.timezone.value = settings.timezone || 'America/La_Paz';
    }).catch((error) => {
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
        status.textContent = error.message;
        status.style.color = '#c93047';
      }
    });
  }

}

document.addEventListener('DOMContentLoaded', setupSettingsModule);
