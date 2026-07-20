/**
 * MedSolution — Auth Module
 *
 * Architecture designed for migration to Supabase Auth.
 * Each adapter function is annotated with its Supabase equivalent so the
 * migration is a targeted swap-out, not a rewrite.
 *
 * LocalStorage keys used:
 *   medsolution.authUser  — active session (user object)
 *   medsolution.users     — user directory (seeded on first run)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTH_KEY = 'medsolution.authUser';
const USERS_KEY = 'medsolution.users';

export const ROLES = Object.freeze({
  ADMIN: 'Administrador',
  MEDICO: 'Médico',
  AUXILIAR: 'Auxiliar',
  ENFERMERIA: 'Enfermería',
});

// ── Page-level access ─────────────────────────────────────────────────────────
// Defines which roles may visit each page.
// SUPABASE MIGRATION: Enforce via Row Level Security policies on the DB instead.

const PAGE_ACCESS = {
  'dashboard.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'patients.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'appointments.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'medical-records.html': [ROLES.ADMIN, ROLES.MEDICO],
  'schedule.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'nursing.html': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'settings.html': [ROLES.ADMIN],
};

// ── Feature-level permissions ─────────────────────────────────────────────────
// Fine-grained control within a page.

const FEATURE_PERMISSIONS = {
  'patients.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'patients.edit': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'patients.delete': [ROLES.ADMIN],
  'appointments.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'appointments.edit': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'appointments.delete': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-diagnosis': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-treatment': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-physical-exam': [ROLES.ADMIN, ROLES.MEDICO],
  'appointments.edit-vitals': [ROLES.ADMIN, ROLES.MEDICO, ROLES.ENFERMERIA],
  'medical-records.view': [ROLES.ADMIN, ROLES.MEDICO],
  'medical-records.edit': [ROLES.ADMIN, ROLES.MEDICO],
  'nursing.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'nursing.edit': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR, ROLES.ENFERMERIA],
  'nursing.delete': [ROLES.ADMIN, ROLES.MEDICO],
  'schedule.create': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'schedule.edit': [ROLES.ADMIN, ROLES.MEDICO, ROLES.AUXILIAR],
  'schedule.delete': [ROLES.ADMIN, ROLES.MEDICO],
  'users.manage': [ROLES.ADMIN],
};

// ── Default user seed ─────────────────────────────────────────────────────────
// Applied once on first run; Admin can manage users via Settings afterward.

const DEFAULT_USERS = [
  { id: 1, username: 'admin', password: 'admin123', name: 'Administrador', role: ROLES.ADMIN, initials: 'AD', active: true },
  { id: 2, username: 'doctor', password: 'doctor123', name: 'Dr. Jeason Flores', role: ROLES.MEDICO, initials: 'JF', active: true },
  { id: 3, username: 'auxiliar', password: 'aux123', name: 'Ana Martínez', role: ROLES.AUXILIAR, initials: 'AM', active: true },
  { id: 4, username: 'enfermeria', password: 'enf123', name: 'Rosa Pérez', role: ROLES.ENFERMERIA, initials: 'RP', active: true },
];

// ── LocalStorage adapter ──────────────────────────────────────────────────────
// SUPABASE MIGRATION: Replace each function body with the Supabase equivalent.

function seedUsersIfNeeded() {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  }
}

/** Returns all users. SUPABASE: supabase.from('users').select('*') */
export function getUsers() {
  seedUsersIfNeeded();
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

/** Persists users array. SUPABASE: supabase.from('users').upsert(users) */
export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Returns the active session user or null. SUPABASE: supabase.auth.getUser() */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
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
 * SUPABASE MIGRATION: supabase.auth.signInWithPassword({ email, password })
 */
export function login(username, password, remember = false) {
  seedUsersIfNeeded();
  const users = getUsers();
  const user = users.find(
    (u) => u.username === username.trim() && u.password === password && u.active !== false,
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
 * SUPABASE MIGRATION: supabase.auth.signOut()
 */
export function logout() {
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
 * SUPABASE MIGRATION: Combine with supabase.auth.onAuthStateChange()
 * and server-side middleware for true enforcement.
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
