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
 *   medsolution.authUser — per-browser-profile session (user object, NO password)
 * LocalStorage preference key used:
 *   medsolution.rememberedUsername — remembered username only (NO active session)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTH_KEY = 'medsolution.authUser';
const REMEMBERED_USER_KEY = 'medsolution.rememberedUsername';
const USERS_KEY = 'medsolution.systemUsers';
let sessionReady = false;
let remoteUsersSyncSucceeded = false;

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
  'contraceptives.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'services.html': [ROLES.ADMIN, ROLES.MEDICO],
  'reports.html': [ROLES.ADMIN, ROLES.MEDICO],
  'settings.html': [ROLES.ADMIN, ROLES.MEDICO],
};

// ── Feature-level permissions ─────────────────────────────────────────────────
// Fine-grained control within a page.

const FEATURE_PERMISSIONS = {
  'patients.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'patients.edit': [ROLES.ADMIN, ROLES.MEDICO],
  'patients.delete': [ROLES.ADMIN, ROLES.MEDICO],
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
  'contraceptives.manage': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'contraceptives.edit-price': [ROLES.ADMIN, ROLES.MEDICO],
  'contraceptives.delete': [ROLES.ADMIN, ROLES.MEDICO],
  'users.manage': [ROLES.ADMIN, ROLES.MEDICO],
  'services.manage': [ROLES.ADMIN, ROLES.MEDICO],
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

// ── Perfiles operativos ───────────────────────────────────────────────────────
// Los valores base garantizan el primer acceso; Supabase conserva la configuración.

const DEFAULT_USERS = Object.freeze([
  { id: 'admin', username: 'admin', passwordHash: hashPassword('admin123'), name: 'Administrador', role: ROLES.ADMIN, position: 'Administrador del sistema', initials: 'AD', active: true, photoPath: '', photoUrl: '' },
  { id: 'doctor', username: 'doctor', passwordHash: hashPassword('doctor123'), name: 'Médico', role: ROLES.MEDICO, position: 'Médico', initials: 'M', active: true, photoPath: '', photoUrl: '' },
  { id: 'auxiliar', username: 'auxiliar', passwordHash: hashPassword('aux123'), name: 'Auxiliar', role: ROLES.AUXILIAR, position: 'Auxiliar', initials: 'A', active: true, photoPath: '', photoUrl: '' },
]);

function configuredUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw === null) return DEFAULT_USERS;
    const stored = JSON.parse(raw);
    return Array.isArray(stored) ? stored : DEFAULT_USERS;
  } catch { return DEFAULT_USERS; }
}

function toSessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    position: user.position || '',
    initials: user.initials || '',
    photoPath: user.photoPath || '',
    photoUrl: user.photoUrl || '',
  };
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached && cached.id !== undefined && cached.id !== null ? cached : null;
  } catch { return null; }
}

function storeSession(user) {
  const session = toSessionUser(user);
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  sessionStorage.removeItem(AUTH_KEY);
  sessionReady = true;
  return session;
}

function clearStoredSession(keepValidation = false) {
  try { localStorage.removeItem(AUTH_KEY); } catch { /* almacenamiento no disponible */ }
  try { sessionStorage.removeItem(AUTH_KEY); } catch { /* almacenamiento no disponible */ }
  sessionReady = keepValidation;
}

function refreshStoredSession(users) {
  const cached = readStoredSession();
  if (!cached) {
    clearStoredSession(true);
    return;
  }

  // The stable profile ID is the identity key; a matching role is never enough.
  const user = users.find((item) => String(item.id) === String(cached.id));
  if (!user || user.active === false) {
    clearStoredSession(true);
    return;
  }
  storeSession(user);
}

export async function syncUsers() {
  remoteUsersSyncSucceeded = false;
  try {
    const data = window.MedSolutionData;
    if (!data || typeof data.getSystemUsers !== 'function') return configuredUsers();
    await data.ready;
    if (typeof data.isConfigured === 'function' && !data.isConfigured()) return configuredUsers();

    const remote = await data.getSystemUsers();
    if (!Array.isArray(remote)) return configuredUsers();

    const serialized = JSON.stringify(remote);
    if (localStorage.getItem(USERS_KEY) !== serialized) {
      localStorage.setItem(USERS_KEY, serialized);
    }
    remoteUsersSyncSucceeded = true;
    sessionReady = true;
    refreshStoredSession(remote);
    return remote;
  } catch { /* Keep the local login fallback; session restoration fails closed below. */ }
  return configuredUsers();
}

/** Devuelve una copia pública de los tres usuarios, sin sus contraseñas. */
export function getUsers() {
  return configuredUsers().map(({ passwordHash, ...user }) => ({ ...user }));
}

/** Devuelve el usuario de la sesión persistida en este perfil de navegador o null. */
export function getSession() {
  if (!sessionReady) return null;
  try {
    const cached = readStoredSession();
    if (!cached) return null;
    const user = configuredUsers().find((item) => String(item.id) === String(cached.id));
    if (!user) {
      clearStoredSession(true);
      return null;
    }
    if (user.active === false) {
      clearStoredSession(true);
      return null;
    }
    const session = toSessionUser(user);
    if (JSON.stringify(cached) !== JSON.stringify(session)) storeSession(user);
    return session;
  } catch {
    return null;
  }
}

/** Devuelve únicamente el nombre de usuario recordado, nunca una sesión autenticada. */
export function getRememberedUsername() {
  try {
    return localStorage.getItem(REMEMBERED_USER_KEY) || '';
  } catch {
    return '';
  }
}

// ── Auth API ──────────────────────────────────────────────────────────────────

/**
 * Authenticate with username + password.
 * @param {string} username
 * @param {string} password
 * @param {boolean} remember  Remember username separately from the session.
 * @returns {object|null} Session user object, or null on failure.
 *
 */
export async function login(username, password, remember = false) {
  await syncUsers();
  const normalizedUsername = username.trim().toLowerCase();
  const inputHash = hashPassword(password);
  const user = configuredUsers().find(
    (u) => u.username.toLowerCase() === normalizedUsername
      && u.passwordHash === inputHash
      && u.active !== false,
  );
  if (!user) return null;

  const session = storeSession(user);

  // "Recordarme" conserva solo el nombre de usuario, nunca una sesión autenticada.
  if (remember) localStorage.setItem(REMEMBERED_USER_KEY, user.username);
  else localStorage.removeItem(REMEMBERED_USER_KEY);

  return session;
}

/**
 * Destroy the current session.
 */
export async function logout() {
  clearStoredSession();
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

// ── Route guard ────────────────────────────────────────────────────────────────

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
  sessionReady = false;
  await syncUsers();
  if (!remoteUsersSyncSucceeded) return null;
  return getSession();
}
