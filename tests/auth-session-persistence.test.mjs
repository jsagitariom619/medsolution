import assert from 'node:assert/strict';
import { test } from 'node:test';

const authUrl = new URL('../assets/js/auth.js', import.meta.url).href;
let importNumber = 0;

function legacyHash(password) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < password.length; index += 1) {
    hash ^= password.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, '0');
}

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
}

function profile(id, username, role, active = true) {
  return {
    id, username, passwordHash: legacyHash('correct-password'), name: username,
    role, position: role, initials: username.slice(0, 1).toUpperCase(),
    active, photoPath: '', photoUrl: '',
  };
}

async function loadAuth({ users, local = new MemoryStorage(), session = new MemoryStorage(), fail = false }) {
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  globalThis.window = {
    location: {
      pathname: '/pages/dashboard.html',
      replaced: '',
      replace(path) { this.replaced = path; },
    },
    MedSolutionData: {
      ready: Promise.resolve(),
      isConfigured: () => true,
      getSystemUsers: async () => {
        if (fail) throw new Error('synthetic network failure');
        return users;
      },
    },
  };
  const auth = await import(`${authUrl}?test=${++importNumber}`);
  return { auth, local, session, window: globalThis.window };
}

test('restores the same profile from localStorage and stores no password/hash', async () => {
  const users = [profile('doctor-1', 'doctor', 'Médico')];
  const first = await loadAuth({ users });
  const signedIn = await first.auth.login('doctor', 'correct-password');

  assert.equal(signedIn.id, 'doctor-1');
  const persisted = first.local.getItem('medsolution.authUser');
  assert.ok(persisted);
  assert.doesNotMatch(persisted, /password|hash/i);

  const reopened = await loadAuth({ users, local: first.local });
  const restored = await reopened.auth.restoreSession();
  assert.equal(restored.id, 'doctor-1');
  assert.equal(restored.username, 'doctor');
  assert.equal(reopened.session.getItem('medsolution.authUser'), null);
});

test('keeps two device storage areas independent', async () => {
  const users = [profile('doctor-1', 'doctor', 'Médico')];
  const deviceA = await loadAuth({ users });
  await deviceA.auth.login('doctor', 'correct-password');

  const deviceB = await loadAuth({ users, local: new MemoryStorage() });
  assert.equal(await deviceB.auth.restoreSession(), null);
  assert.equal(deviceA.local.getItem('medsolution.authUser') !== null, true);
  assert.equal(deviceB.local.getItem('medsolution.authUser'), null);
});

test('manual logout removes the persistent and legacy tab session', async () => {
  const { auth, local, session } = await loadAuth({ users: [profile('doctor-1', 'doctor', 'Médico')] });
  await auth.login('doctor', 'correct-password');
  session.setItem('medsolution.authUser', '{"id":"old-tab-session"}');

  await auth.logout();
  assert.equal(local.getItem('medsolution.authUser'), null);
  assert.equal(session.getItem('medsolution.authUser'), null);
  assert.equal(auth.getUser(), null);
});

test('does not switch to another profile with the same role when identity disappears', async () => {
  const first = await loadAuth({ users: [profile('doctor-1', 'doctor-one', 'Médico')] });
  await first.auth.login('doctor-one', 'correct-password');

  const reopened = await loadAuth({
    users: [profile('doctor-2', 'doctor-two', 'Médico')],
    local: first.local,
  });
  assert.equal(await reopened.auth.restoreSession(), null);
  assert.equal(reopened.local.getItem('medsolution.authUser'), null);
});

test('invalidates disabled users and users missing from a successful remote sync', async () => {
  for (const remoteUsers of [
    [profile('doctor-1', 'doctor', 'Médico', false)],
    [],
  ]) {
    const first = await loadAuth({ users: [profile('doctor-1', 'doctor', 'Médico')] });
    await first.auth.login('doctor', 'correct-password');

    const reopened = await loadAuth({ users: remoteUsers, local: first.local });
    assert.equal(await reopened.auth.restoreSession(), null);
    assert.equal(reopened.local.getItem('medsolution.authUser'), null);
  }
});

test('does not restore an unverified session after a remote profile check fails', async () => {
  const first = await loadAuth({ users: [profile('doctor-1', 'doctor', 'Médico')] });
  await first.auth.login('doctor', 'correct-password');
  const persistedBefore = first.local.getItem('medsolution.authUser');

  const reopened = await loadAuth({
    users: [], local: first.local, fail: true,
  });
  assert.equal(await reopened.auth.restoreSession(), null);
  assert.equal(reopened.local.getItem('medsolution.authUser'), persistedBefore);
});

test('keeps every existing module route and feature permission tied to the role', async () => {
  const routes = {
    'dashboard.html': ['Administrador', 'Médico', 'Auxiliar'],
    'patients.html': ['Administrador', 'Médico', 'Auxiliar'],
    'appointments.html': ['Administrador', 'Médico', 'Auxiliar'],
    'medical-records.html': ['Administrador', 'Médico'],
    'schedule.html': ['Administrador', 'Médico', 'Auxiliar'],
    'contraceptives.html': ['Administrador', 'Médico', 'Auxiliar'],
    'services.html': ['Administrador', 'Médico'],
    'reports.html': ['Administrador', 'Médico'],
    'settings.html': ['Administrador', 'Médico'],
  };
  const roleUsers = [
    profile('admin-1', 'admin', 'Administrador'),
    profile('doctor-1', 'doctor', 'Médico'),
    profile('assistant-1', 'assistant', 'Auxiliar'),
  ];
  const expectedAuxiliaryFeatures = new Set([
    'patients.create', 'appointments.create', 'appointments.edit',
    'schedule.create', 'schedule.edit', 'contraceptives.manage',
  ]);

  for (const role of ['Administrador', 'Médico', 'Auxiliar']) {
    const username = roleUsers.find((user) => user.role === role).username;
    const app = await loadAuth({ users: roleUsers });
    await app.auth.login(username, 'correct-password');

    for (const [page, allowedRoles] of Object.entries(routes)) {
      app.window.location.pathname = `/pages/${page}`;
      app.window.location.replaced = '';
      const result = app.auth.guardRoute();
      assert.equal(result?.role === role, allowedRoles.includes(role), `${role} access to ${page}`);
      if (!allowedRoles.includes(role)) assert.equal(app.window.location.replaced, 'dashboard.html');
    }

    for (const feature of [
      'patients.create', 'patients.edit', 'patients.delete',
      'appointments.create', 'appointments.edit', 'appointments.delete',
      'appointments.edit-diagnosis', 'appointments.edit-treatment',
      'appointments.edit-physical-exam', 'appointments.edit-vitals',
      'medical-records.view', 'medical-records.edit',
      'schedule.create', 'schedule.edit', 'schedule.delete',
      'contraceptives.manage', 'contraceptives.edit-price', 'contraceptives.delete',
      'users.manage', 'services.manage',
    ]) {
      const shouldAllow = role !== 'Auxiliar' || expectedAuxiliaryFeatures.has(feature);
      assert.equal(app.auth.can(feature), shouldAllow, `${role} permission ${feature}`);
    }
  }
});
