/**
 * MedSolution — Auth Module
 *
 * Autenticación local de MedSolution.
 * Supabase continúa como capa de datos, sin intervenir en el inicio de sesión.
 *
 * Password handling: passwords are stored as FNV-1a 32-bit hashes (not plaintext).
 * Este mecanismo conserva la compatibilidad con la instalación original.
 *
 * LocalStorage key used:
 *   medsolution.authUser — active session (user object, NO password)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTH_KEY = 'medsolution.authUser';

export const ROLES = Object.freeze({
  ADMIN: 'Administrador',
  MEDICO: 'Médico',
  AUXILIAR: 'Auxiliar',
});

// ── Page-level access ─────────────────────────────────────────────────────────
// Defines which roles may visit each page.
// SUPABASE MIGRATION: Enforce via Row Level Security policies on the DB instead.

const PAGE_ACCESS = {
  'dashboard.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'patients.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'appointments.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'medical-records.html': [ROLES.ADMIN, ROLES.MEDICO],
  'schedule.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'contraceptives.html': [ROLES.ADMIN, ROLES.AUXILIAR],
  'services.html': [ROLES.ADMIN],
  'reports.html': [ROLES.ADMIN],
  'settings.html': [ROLES.ADMIN],
};

// ── Feature-level permissions ─────────────────────────────────────────────────
// Fine-grained control within a page.

const FEATURE_PERMISSIONS = {
  'patients.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'patients.edit': [ROLES.ADMIN, ROLES.MEDICO],
  'patients.delete': [ROLES.ADMIN],
  'appointments.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'appointments.edit': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'appointments.delete': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-diagnosis': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-treatment': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-physical-exam': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-vitals': [ROLES.ADMIN, ROLES.MEDICO],
  'medical-records.view': [ROLES.ADMIN, ROLES.MEDICO],
  'medical-records.edit': [ROLES.ADMIN, ROLES.MEDICO],
  'schedule.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'schedule.edit': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'schedule.delete': [ROLES.ADMIN, ROLES.MEDICO],
  'contraceptives.manage': [ROLES.ADMIN, ROLES.AUXILIAR],
  'contraceptives.edit-price': [ROLES.ADMIN],
  'contraceptives.delete': [ROLES.ADMIN],
  'users.manage': [ROLES.ADMIN],
  'services.manage': [ROLES.ADMIN],
};

// ── Password hashing ──────────────────────────────────────────────────────────
// FNV-1a 32-bit — NOT cryptographically secure; prevents raw plaintext storage.
// SUPABASE MIGRATION: Remove this; Supabase Auth handles password hashing server-side.

export function hashPassword(password) {
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Usuarios predefinidos ─────────────────────────────────────────────────────
// Son los únicos usuarios válidos y no dependen del almacenamiento del navegador.

const PREDEFINED_USERS = Object.freeze([
  { id: 1, username: 'admin',      passwordHash: hashPassword('admin123'),   name: 'Administrador',      role: ROLES.ADMIN,      initials: 'AD', active: true },
  { id: 2, username: 'doctor',     passwordHash: hashPassword('doctor123'),  name: 'Médico Demo',        role: ROLES.MEDICO,     initials: 'MD', active: true },
  { id: 3, username: 'auxiliar',   passwordHash: hashPassword('aux123'),     name: 'Ana Martínez',       role: ROLES.AUXILIAR,   initials: 'AM', active: true },
]);

/** Devuelve una copia pública de los tres usuarios, sin sus contraseñas. */
export function getUsers() {
  return PREDEFINED_USERS.map(({ passwordHash, ...user }) => ({ ...user }));
}

/** Devuelve el usuario de la sesión local activa o null. */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const user = PREDEFINED_USERS.find((item) =>
      item.id === cached?.id
      && item.username === cached?.username
      && item.role === cached?.role);
    if (!user) {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    return {
      id: user.id, username: user.username, name: user.name,
      role: user.role, initials: user.initials,
    };
  } catch {
    return null;
  }
}

// ── Auth API ──────────────────────────────────────────────────────────────────

/**
 * Authenticate with username + password.
 * @param {string} username
 * @param {string} password
 * @param {boolean} remember  Persist across browser sessions when true.
 * @returns {object|null} Session user object, or null on failure.
 *
 */
export async function login(username, password, remember = false) {
  const normalizedUsername = username.trim().toLowerCase();
  const inputHash = hashPassword(password);
  const user = PREDEFINED_USERS.find(
    (u) => u.username.toLowerCase() === normalizedUsername
      && u.passwordHash === inputHash
      && u.active !== false,
  );
  if (!user) return null;

  const session = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    initials: user.initials,
  };
  const payload = JSON.stringify(session);

  // Store in sessionStorage (tab-scoped) unless "remember me" is checked
  if (remember) {
    localStorage.setItem(AUTH_KEY, payload);
    sessionStorage.removeItem(AUTH_KEY);
  } else {
    sessionStorage.setItem(AUTH_KEY, payload);
    localStorage.removeItem(AUTH_KEY);
  }
  return session;
}

/**
 * Destroy the current session.
 */
export async function logout() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
}

/** Returns the current user from the active session, or null. */
export function getUser() {
  return getSession();
}

// ── Permission helpers ────────────────────────────────────────────────────────

/** Whether `role` may visit `page` (e.g. 'patients.html'). */
export function canAccess(page, role) {
  const allowed = PAGE_ACCESS[page];
  return !allowed || allowed.includes(role);
}

/** Whether the current session user has a specific feature permission. */
export function can(feature) {
  const user = getSession();
  if (!user) return false;
  const allowed = FEATURE_PERMISSIONS[feature];
  return Boolean(allowed && allowed.includes(user.role));
}

// ── Route guard ───────────────────────────────────────────────────────────────

/**
 * Call on every protected page. Redirects to login if unauthenticated,
 * or to dashboard if the user's role does not permit the current page.
 * Returns the session user when access is granted.
 *
 */
export function guardRoute() {
  const user = getSession();
  const inPages = window.location.pathname.includes('/pages/');
  const loginPath = inPages ? '../index.html' : 'index.html';
  const dashPath = inPages ? 'dashboard.html' : 'pages/dashboard.html';

  if (!user) {
    window.location.replace(loginPath);
    return null;
  }

  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (!canAccess(page, user.role)) {
    window.location.replace(dashPath);
    return null;
  }

  return user;
}

export async function restoreSession() {
  return getSession();
}
