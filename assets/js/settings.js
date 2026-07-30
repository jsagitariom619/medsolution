// Settings Module — muestra los tres usuarios predefinidos (solo lectura).
// Non-module script: kept as regular script for compatibility with non-module
// sibling scripts on this page. Refactor to ES module when migrating to Supabase.

const PREDEFINED_USERS = Object.freeze([
  { id: 1, username: 'admin', name: 'Administrador', role: 'Administrador', initials: 'AD', active: true },
  { id: 2, username: 'doctor', name: 'Médico Demo', role: 'Médico', initials: 'MD', active: true },
  { id: 3, username: 'auxiliar', name: 'Ana Martínez', role: 'Auxiliar', initials: 'AM', active: true },
]);

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
  if (!currentUser || currentUser.role !== 'Administrador') return;

  renderUsersTable();
  document.getElementById('newUserBtn')?.remove();

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
