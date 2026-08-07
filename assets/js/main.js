import { login, logout, guardRoute, restoreSession, getUser, can, syncUsers } from './auth.js';

// ── Route map ─────────────────────────────────────────────────────────────────

const routes = {
  login: 'index.html',
  dashboard: 'pages/dashboard.html',
  patients: 'pages/patients.html',
  appointments: 'pages/appointments.html',
  records: 'pages/medical-records.html',
  schedule: 'pages/schedule.html',
  contraceptives: 'pages/contraceptives.html',
  reports: 'pages/reports.html',
  settings: 'pages/settings.html',
};

const MODULE_PAGES = new Set([
  'patients.html', 'appointments.html', 'medical-records.html', 'schedule.html',
  'services.html', 'contraceptives.html', 'reports.html', 'settings.html',
]);

const setupEmbeddedModuleLayout = () => {
  if (window.self === window.top) return false;
  document.body.classList.add('embedded-module');
  const style = document.createElement('style');
  style.textContent = `
    body.embedded-module { min-height: 0; overflow-x: hidden; background: #f5f8fb; }
    body.embedded-module .app-shell { display: block; min-height: 0; }
    body.embedded-module .app-shell > .sidebar,
    body.embedded-module .main-area > .topbar,
    body.embedded-module .main-area > footer,
    body.embedded-module .sidebar-logout { display: none !important; }
    body.embedded-module .main-area { width: 100%; min-width: 0; min-height: 0; margin: 0; background: #f5f8fb; }
  `;
  document.head.appendChild(style);
  return true;
};

const redirectStandaloneModuleToShell = () => {
  if (window.self !== window.top) return false;
  const page = window.location.pathname.split('/').pop();
  if (!MODULE_PAGES.has(page)) return false;
  const target = `${page}${window.location.search}${window.location.hash}`;
  window.location.replace(`dashboard.html?module=${encodeURIComponent(target)}`);
  return true;
};

// ── Login page ────────────────────────────────────────────────────────────────

const showLoginError = (msg) => {
  let el = document.querySelector('[data-login-error]');
  if (!el) {
    el = document.createElement('p');
    el.dataset.loginError = '';
    el.className = 'login-error';
    const form = document.querySelector('[data-login-form]');
    const submitBtn = form?.querySelector('[type="submit"]');
    if (submitBtn) form.insertBefore(el, submitBtn);
  }
  el.textContent = msg;
};

const handleLogin = () => {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  // If already authenticated, go straight to dashboard
  if (getUser()) {
    window.location.replace(routes.dashboard);
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const usernameInput = form.querySelector('input[name="username"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const rememberInput = form.querySelector('input[name="remember"]');

    const user = await login(
      usernameInput?.value || '',
      passwordInput?.value || '',
      rememberInput?.checked || false,
    );

    if (!user) {
      showLoginError('Usuario o contraseña incorrectos.');
      if (passwordInput) passwordInput.value = '';
      passwordInput?.focus();
      return;
    }

    window.location.href = routes.dashboard;
  });
};

// ── User chip & profile ───────────────────────────────────────────────────────

const updateUserChip = () => {
  const user = getUser();
  if (!user) return;

  window.MedSolutionAvatar?.applyAll(user);

  document.querySelectorAll('[data-user-chip]').forEach((chip) => {
    const nameEl = chip.querySelector('[data-user-name]');
    if (nameEl) nameEl.textContent = user.name;
    const roleEl = chip.querySelector('[data-user-role]');
    if (roleEl) roleEl.textContent = user.role;
  });

  const doctorName = document.querySelector('[data-doctor-name]');
  if (doctorName) doctorName.textContent = user.name;
  const doctorRole = document.querySelector('[data-doctor-role]');
  if (doctorRole) doctorRole.textContent = user.position || user.role;
  const welcomeName = document.querySelector('[data-welcome-name]');
  if (welcomeName) welcomeName.textContent = `¡Bienvenido, ${user.name}!`;
};

// ── Role-based visibility ─────────────────────────────────────────────────────

const applyRoleRestrictions = (user) => {
  // Hide elements whose required roles don't include the current user
  document.querySelectorAll('[data-requires-role]').forEach((el) => {
    const roles = el.dataset.requiresRole.split(',').map((r) => r.trim());
    const allowed = roles.includes(user.role)
      || (user.role === 'Médico' && roles.includes('Administrador'));
    if (!allowed) {
      el.style.display = 'none';
    }
  });

  // Make fields read-only when the user lacks a specific feature permission
  document.querySelectorAll('[data-role-feature]').forEach((el) => {
    const feature = el.dataset.roleFeature;
    if (!can(feature)) {
      el.querySelectorAll('input:not([type="hidden"]), textarea').forEach((f) => {
        f.readOnly = true;
        f.setAttribute('aria-readonly', 'true');
      });
      el.querySelectorAll('select').forEach((f) => {
        f.disabled = true;
        f.setAttribute('aria-disabled', 'true');
      });
      el.classList.add('field--restricted');
    }
  });

  // Expose auth info globally so non-module scripts (patients.js, etc.) can read it
  window.MedSolutionAuth = { user, can };
};

const capitalizeFirstCharacter = (value) => {
  if (!value) return value;
  const index = value.search(/\S/);
  if (index < 0) return value;
  return `${value.slice(0, index)}${value.charAt(index).toLocaleUpperCase('es')}${value.slice(index + 1)}`;
};

const setupAutomaticCapitalization = () => {
  document.addEventListener('input', (event) => {
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement)
      && !(field instanceof HTMLInputElement && (field.type === 'text' || field.type === 'search'))) return;
    if (field.dataset.noAutoCapitalize !== undefined) return;
    const capitalized = capitalizeFirstCharacter(field.value);
    if (capitalized === field.value) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    field.value = capitalized;
    if (start !== null && end !== null) field.setSelectionRange(start, end);
  });
};

// ── Logout ────────────────────────────────────────────────────────────────────

const setupLogout = () => {
  const inPages = window.location.pathname.includes('/pages/');
  const loginPath = inPages ? '../index.html' : 'index.html';

  // Wire up any existing logout button/link
  document.querySelectorAll('[data-logout-btn]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      await logout();
      window.location.href = loginPath;
    });
  });

  // Inject a logout link into sidebars that don't already have one
  document.querySelectorAll('.sidebar').forEach((sidebar) => {
    if (sidebar.querySelector('.sidebar-logout, [data-logout-btn]')) return;
    const a = document.createElement('a');
    a.className = 'sidebar-logout';
    a.href = '#';
    a.dataset.logoutBtn = '';
    a.innerHTML = '<span>↪</span>Cerrar sesión';
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      await logout();
      window.location.href = loginPath;
    });
    sidebar.appendChild(a);
  });
};

// ── Active navigation ─────────────────────────────────────────────────────────

const setActiveNavigation = () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const targetPage = link.getAttribute('href')?.split('/').pop();
    link.classList.toggle('nav-link--active', targetPage === currentPage);
  });
};

// ── Init ──────────────────────────────────────────────────────────────────────

const isLoginPage = window.location.pathname.split('/').pop() === 'index.html'
  || window.location.pathname === '/'
  || window.location.pathname.endsWith('/');

async function initializeApplication() {
  if (redirectStandaloneModuleToShell()) return;
  setupEmbeddedModuleLayout();
  await window.MedSolutionData?.ready;
  if (isLoginPage) {
    await restoreSession();
    handleLogin();
    return;
  }
  await restoreSession();
  const user = guardRoute();
  if (user) {
    applyRoleRestrictions(user);
    setActiveNavigation();
    updateUserChip();
    setupLogout();
  }
}

setupAutomaticCapitalization();
initializeApplication();
window.addEventListener('storage', async (event) => {
  if (event.key !== 'medsolution.systemUsers') return;
  await syncUsers();
  if (window.MedSolutionAuth) window.MedSolutionAuth.user = getUser();
  updateUserChip();
});
