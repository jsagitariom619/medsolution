const routes = {
  login: 'index.html',
  dashboard: 'pages/dashboard.html',
  patients: 'pages/patients.html',
  appointments: 'pages/appointments.html',
  records: 'pages/medical-records.html',
  schedule: 'pages/schedule.html',
  nursing: 'pages/nursing.html',
  settings: 'pages/settings.html',
};

const buildUserFromEmail = (email) => {
  const atIndex = email.indexOf('@');
  const prefix = atIndex > -1 ? email.slice(0, atIndex) : email;
  const parts = prefix.split(/[._-]/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  const name = parts.length ? parts.join(' ') : prefix;
  const initials = parts.filter((p) => p).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return { name, initials, role: 'Médico' };
};

const handleLogin = () => {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput && emailInput.value) {
      const user = buildUserFromEmail(emailInput.value);
      localStorage.setItem('medsolution.authUser', JSON.stringify(user));
    }
    window.location.href = routes.dashboard;
  });
};

const updateUserChip = () => {
  const stored = localStorage.getItem('medsolution.authUser');
  if (!stored) return;
  let user;
  try { user = JSON.parse(stored); } catch { return; }

  document.querySelectorAll('[data-user-chip]').forEach((chip) => {
    const avatarEl = chip.querySelector('[data-user-avatar]');
    if (avatarEl) avatarEl.textContent = user.initials;
    const nameEl = chip.querySelector('[data-user-name]');
    if (nameEl) nameEl.textContent = user.name;
  });

  const doctorAvatar = document.querySelector('[data-doctor-avatar]');
  if (doctorAvatar) doctorAvatar.textContent = user.initials;
  const doctorName = document.querySelector('[data-doctor-name]');
  if (doctorName) doctorName.textContent = user.name;
  const welcomeName = document.querySelector('[data-welcome-name]');
  if (welcomeName) welcomeName.textContent = `¡Bienvenido, ${user.name}!`;
};

const setActiveNavigation = () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const targetPage = link.getAttribute('href')?.split('/').pop();
    link.classList.toggle('nav-link--active', targetPage === currentPage);
  });
};

handleLogin();
setActiveNavigation();
updateUserChip();
