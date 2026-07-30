// Settings Module — User Management (Admin only)
// Reads/writes users via the same medsolution.users localStorage key used by auth.js.
// Passwords are stored as FNV-1a hashes (same as auth.js) — NOT plaintext.
// Non-module script: kept as regular script for compatibility with non-module
// sibling scripts on this page. Refactor to ES module when migrating to Supabase.

const USERS_KEY = 'medsolution.users';

// ── Password hash (mirrors auth.js — keep in sync) ────────────────────────────
// FNV-1a 32-bit; NOT cryptographically secure. SUPABASE: server-side bcrypt/Argon2.
function hashPassword(password) {
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h.toString(16).padStart(8, '0');
}

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
  if (window.MedSolutionData?.isConfigured()) return window.MedSolutionData.getProfiles();
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function nextId(users) {
  const ids = users.map((u) => u.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
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

// ── State ─────────────────────────────────────────────────────────────────────

const state = { editingId: null };

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
    const isSelf = currentUser && String(currentUser.id) === String(u.id);
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
      <td>
        <span class="action-links">
          <button class="btn-action" data-action="edit" data-id="${u.id}" title="Editar">✎</button>
          ${isSelf ? '' : `<button class="btn-action btn-action--delete" data-action="toggle" data-id="${u.id}" title="${u.active === false ? 'Activar' : 'Desactivar'}">${u.active === false ? '✓' : '✕'}</button>`}
        </span>
      </td>
    `;
    tbody.insertBefore(tr, emptyRow);
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openUserModal(mode, user = null) {
  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');
  const form = document.getElementById('userForm');
  const errEl = document.getElementById('userFormError');
  if (!modal || !form) return;

  form.reset();
  if (errEl) errEl.style.display = 'none';
  state.editingId = null;

  if (mode === 'edit' && user) {
    if (title) title.textContent = 'Editar Usuario';
    state.editingId = user.id;
    form.elements.name.value = user.name || '';
    form.elements.username.value = user.username || '';
    // Do not pre-populate password — leave blank; only update if a new value is entered
    form.elements.role.value = user.role || '';
    form.elements.initials.value = user.initials || '';
    // Password not required on edit
    form.elements.password.removeAttribute('required');
    form.elements.password.placeholder = 'Dejar en blanco para no cambiar';
  } else {
    if (title) title.textContent = 'Nuevo Usuario';
    form.elements.password.setAttribute('required', '');
    form.elements.password.placeholder = '••••••••';
  }

  modal.classList.add('nursing-modal--active');
  setTimeout(() => form.elements.name?.focus(), 80);
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.classList.remove('nursing-modal--active');
  state.editingId = null;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function handleUserSave(event) {
  event.preventDefault();
  const form = document.getElementById('userForm');
  const errEl = document.getElementById('userFormError');
  if (!form) return;

  const name = form.elements.name.value.trim();
  const username = form.elements.username.value.trim().toLowerCase();
  const password = form.elements.password.value;
  const role = form.elements.role.value;
  const initialsInput = form.elements.initials.value.trim().toUpperCase();

  if (!name || !username || !role) {
    showFormError(errEl, 'Nombre, usuario y rol son obligatorios.');
    return;
  }
  if (state.editingId === null && !password) {
    showFormError(errEl, 'La contraseña es obligatoria para nuevos usuarios.');
    return;
  }

  const users = await loadUsers();

  // Check username uniqueness
  const duplicate = users.find((u) => u.username === username && String(u.id) !== String(state.editingId));
  if (duplicate) {
    showFormError(errEl, `El nombre de usuario "${username}" ya está en uso.`);
    return;
  }

  const initials = initialsInput || getInitials(name);

  if (window.MedSolutionData?.isConfigured()) {
    await window.MedSolutionData.manageUser(state.editingId !== null ? 'update' : 'create', {
      id: state.editingId, email: username, name, password, role, active: true,
    });
  } else if (state.editingId !== null) {
    const idx = users.findIndex((u) => String(u.id) === String(state.editingId));
    if (idx > -1) {
      users[idx] = {
        ...users[idx],
        name,
        username,
        role,
        initials,
        ...(password ? { password } : {}),
      };
    }
  } else {
    users.push({ id: nextId(users), username, password, name, role, initials, active: true });
  }

  if (!window.MedSolutionData?.isConfigured()) saveUsers(users);
  closeUserModal();
  await renderUsersTable();
}

async function handleToggleActive(userId) {
  const users = await loadUsers();
  const currentUser = getCurrentUser();
  const idx = users.findIndex((u) => String(u.id) === String(userId));
  if (idx === -1) return;
  if (currentUser && String(currentUser.id) === String(userId)) return; // can't deactivate self
  users[idx].active = !users[idx].active;
  if (window.MedSolutionData?.isConfigured()) {
    await window.MedSolutionData.manageUser('toggle', {
      ...users[idx], email: users[idx].email || users[idx].username,
    });
  } else saveUsers(users);
  await renderUsersTable();
}

function showFormError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function setupSettingsModule() {
  await window.MedSolutionData?.ready;
  // Only run user management if admin
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'Administrador') return;

  renderUsersTable();

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

  document.getElementById('newUserBtn')?.addEventListener('click', () => openUserModal('create'));
  document.getElementById('closeUserModalBtn')?.addEventListener('click', closeUserModal);
  document.getElementById('cancelUserModalBtn')?.addEventListener('click', closeUserModal);
  document.querySelector('#userModal .nursing-modal__overlay')?.addEventListener('click', closeUserModal);
  document.getElementById('userForm')?.addEventListener('submit', handleUserSave);

  document.getElementById('usersTableBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const users = await loadUsers();
    const user = users.find((u) => String(u.id) === String(id));
    if (!user) return;
    if (btn.dataset.action === 'edit') openUserModal('edit', user);
    else if (btn.dataset.action === 'toggle') await handleToggleActive(id);
  });
}

document.addEventListener('DOMContentLoaded', setupSettingsModule);
