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

const STORAGE_KEYS = {
  authUser: 'medsolution.authUser',
};

const FALLBACK_USER = {
  name: 'Usuario autenticado',
  role: 'Sin cargo asignado',
  photo: '',
};

const safeParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const toTitleCase = (value) =>
  value
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const buildNameFromEmail = (email) => {
  const localPart = normalizeText(email).split('@')[0] || '';
  return localPart ? toTitleCase(localPart) : '';
};

const buildInitials = (name) => {
  const words = normalizeText(name).split(/\s+/).filter(Boolean);
  if (!words.length) return 'MS';
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
};

const normalizeUser = (rawUser) => {
  const name = normalizeText(rawUser?.name || rawUser?.full_name || rawUser?.fullName || rawUser?.user_metadata?.full_name);
  const role = normalizeText(rawUser?.role || rawUser?.position || rawUser?.title || rawUser?.user_metadata?.role);
  const photo = normalizeText(rawUser?.photo || rawUser?.avatar_url || rawUser?.avatarUrl || rawUser?.user_metadata?.avatar_url);

  return {
    name: name || FALLBACK_USER.name,
    role: role || FALLBACK_USER.role,
    photo,
  };
};

const getAuthenticatedUser = () => {
  const explicitUser = safeParse(localStorage.getItem(STORAGE_KEYS.authUser)) || safeParse(sessionStorage.getItem(STORAGE_KEYS.authUser));
  if (explicitUser) return normalizeUser(explicitUser);

  const supabaseSession = safeParse(localStorage.getItem('sb-session')) || safeParse(sessionStorage.getItem('sb-session'));
  if (supabaseSession?.user) return normalizeUser(supabaseSession.user);

  return { ...FALLBACK_USER };
};

const saveAuthenticatedUser = (user) => {
  localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(normalizeUser(user)));
};

const renderAvatar = (element, user, { large = false } = {}) => {
  if (!element) return;

  element.classList.remove('avatar--image', 'doctor-profile__avatar--image');
  element.style.backgroundImage = '';

  if (user.photo) {
    const imageClass = large ? 'doctor-profile__avatar--image' : 'avatar--image';
    element.classList.add(imageClass);
    element.style.backgroundImage = `url("${user.photo}")`;
    element.textContent = '';
    element.setAttribute('aria-label', `${user.name}`);
    return;
  }

  element.textContent = buildInitials(user.name);
  element.removeAttribute('aria-label');
};

const applyAuthenticatedUserToUI = () => {
  const user = getAuthenticatedUser();

  document.querySelectorAll('[data-user-name]').forEach((node) => {
    node.textContent = user.name;
  });

  document.querySelectorAll('[data-user-role]').forEach((node) => {
    node.textContent = user.role;
  });

  document.querySelectorAll('[data-user-welcome-name]').forEach((node) => {
    node.textContent = user.name;
  });

  document.querySelectorAll('[data-user-avatar]').forEach((node) => renderAvatar(node, user));
  document.querySelectorAll('[data-user-avatar-large]').forEach((node) => renderAvatar(node, user, { large: true }));
};

const handleLogin = () => {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const email = normalizeText(formData.get('email'));
    const inferredName = buildNameFromEmail(email);

    saveAuthenticatedUser({
      name: inferredName || FALLBACK_USER.name,
      role: 'Profesional de salud',
      photo: '',
    });

    window.location.href = routes.dashboard;
  });
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
applyAuthenticatedUserToUI();

export { getAuthenticatedUser, saveAuthenticatedUser, applyAuthenticatedUserToUI };
