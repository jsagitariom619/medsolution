import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { resolveLoginStartup } from '../assets/js/login-startup.js';

const projectRoot = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', projectRoot), 'utf8');
const serviceWorker = await readFile(new URL('service-worker.js', projectRoot), 'utf8');
const manifest = JSON.parse(await readFile(new URL('manifest.json', projectRoot), 'utf8'));

function bootWithStorage({ localSession = null, tabSession = null, storageThrows = false } = {}) {
  const classes = new Set();
  const store = (value) => ({
    getItem() {
      if (storageThrows) throw new Error('storage unavailable');
      return value;
    },
  });
  const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(script, 'early session-candidate check exists in the document head');
  runInNewContext(script, {
    document: { documentElement: { classList: { add: (value) => classes.add(value) } } },
    localStorage: store(localSession),
    sessionStorage: store(tabSession),
  });
  return classes;
}

test('a saved session shows the institutional startup before the login form can paint', () => {
  assert.ok(bootWithStorage({ localSession: '{"id":"doctor-1"}' }).has('auth-session-pending'));
  assert.match(html, /data-auth-startup[^>]*role="status"/);
  assert.match(html, /assets\/images\/medsolution-logo\.png/);
  assert.match(html, /Iniciando MedSolution\.\.\./);
  assert.match(html, /auth-session-pending \[data-login-shell\] \{ display: none; \}/);
  assert.match(html, /data-login-form/);
});

test('no session or unavailable browser storage leaves the regular login visible', () => {
  assert.equal(bootWithStorage().has('auth-session-pending'), false);
  assert.equal(bootWithStorage({ storageThrows: true }).has('auth-session-pending'), false);
  assert.equal(bootWithStorage({ tabSession: '{"id":"legacy-session"}' }).has('auth-session-pending'), true);
});

test('a valid restored session navigates directly without revealing the login form', async () => {
  let finishRestore;
  const events = [];
  const startup = resolveLoginStartup({
    hasSessionCandidate: true,
    restoreSession: () => new Promise((resolve) => { finishRestore = resolve; }),
    isAuthenticated: () => false,
    onAuthenticated: () => events.push('dashboard'),
    onLogin: () => events.push('login'),
    timeoutMs: 100,
  });
  await Promise.resolve();
  assert.deepEqual(events, []);
  finishRestore({ id: 'doctor-1' });
  assert.equal(await startup, 'authenticated');
  assert.deepEqual(events, ['dashboard']);
});

test('missing, disabled, or deleted profiles reveal the normal login form', async () => {
  for (const restoredSession of [null, undefined]) {
    const events = [];
    assert.equal(await resolveLoginStartup({
      hasSessionCandidate: true,
      restoreSession: async () => restoredSession,
      isAuthenticated: () => false,
      onAuthenticated: () => events.push('dashboard'),
      onLogin: () => events.push('login'),
      timeoutMs: 100,
    }), 'login');
    assert.deepEqual(events, ['login']);
  }
});

test('a failed synchronization reveals the form instead of leaving an endless loader', async () => {
  const events = [];
  assert.equal(await resolveLoginStartup({
    hasSessionCandidate: true,
    restoreSession: async () => { throw new Error('offline'); },
    isAuthenticated: () => false,
    onAuthenticated: () => events.push('dashboard'),
    onLogin: () => events.push('login'),
    timeoutMs: 100,
  }), 'login');
  assert.deepEqual(events, ['login']);
});

test('a slow but successful synchronization keeps the form hidden until it finishes', async () => {
  const events = [];
  const startup = resolveLoginStartup({
    hasSessionCandidate: true,
    restoreSession: () => new Promise((resolve) => setTimeout(() => resolve({ id: 'doctor-1' }), 15)),
    isAuthenticated: () => false,
    onAuthenticated: () => events.push('dashboard'),
    onLogin: () => events.push('login'),
    timeoutMs: 100,
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(events, []);
  assert.equal(await startup, 'authenticated');
  assert.deepEqual(events, ['dashboard']);
});

test('a stuck synchronization falls back after the bounded timeout and ignores late results', async () => {
  let finishRestore;
  const events = [];
  assert.equal(await resolveLoginStartup({
    hasSessionCandidate: true,
    restoreSession: () => new Promise((resolve) => { finishRestore = resolve; }),
    isAuthenticated: () => false,
    onAuthenticated: () => events.push('dashboard'),
    onLogin: () => events.push('login'),
    timeoutMs: 5,
  }), 'timeout');
  assert.deepEqual(events, ['login']);
  finishRestore({ id: 'doctor-1' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.join(','), 'login');
});

test('the service worker installs the new startup module and replaces the prior cache', () => {
  assert.match(serviceWorker, /medsolution-pwa-v23/);
  assert.match(serviceWorker, /'\/assets\/js\/login-startup\.js'/);
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /self\.clients\.claim\(\)/);
});


test('new installations use Registro Clínico and all current icons are precached', () => {
  assert.equal(manifest.name, 'Registro Clínico');
  assert.equal(manifest.short_name, 'Registro Clínico');
  assert.ok(manifest.icons.some((icon) => icon.src === '/assets/icons/icon-192x192-maskable.png?v=rc-icon-20261102-v3' && icon.purpose === 'maskable'));
  assert.ok(manifest.icons.some((icon) => icon.src === '/assets/icons/icon-512x512-maskable.png?v=rc-icon-20261102-v3' && icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    assert.ok(icon.src.endsWith('?v=rc-icon-20261102-v3'), icon.src + ' is versioned');
    assert.ok(serviceWorker.includes("'" + icon.src + "'"), icon.src + ' is precached');
  }
  assert.match(html, /assets\/icons\/favicon\.ico/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /Instalar Registro Clínico/);
});
