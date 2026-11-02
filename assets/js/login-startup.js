const DEFAULT_RESTORE_TIMEOUT_MS = 12000;

/**
 * Resolve the login-page startup state without exposing the form while a saved
 * session is being checked. A bounded fallback prevents a stuck data request
 * from leaving the page on the startup screen indefinitely.
 */
export async function resolveLoginStartup({
  hasSessionCandidate,
  restoreSession,
  isAuthenticated,
  onAuthenticated,
  onLogin,
  timeoutMs = DEFAULT_RESTORE_TIMEOUT_MS,
}) {
  if (!hasSessionCandidate) {
    onLogin();
    return 'login';
  }

  const restoration = Promise.resolve()
    .then(restoreSession)
    .then((session) => ({ session }), () => ({ session: null }));

  let timeoutId;
  const outcome = await Promise.race([
    restoration,
    new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    }),
  ]);

  if (outcome.timedOut) {
    onLogin();
    // Once the fallback is shown, late synchronization must not redirect or
    // otherwise change the visible startup state.
    return 'timeout';
  }

  clearTimeout(timeoutId);
  if (outcome.session || isAuthenticated()) {
    onAuthenticated();
    return 'authenticated';
  }

  onLogin();
  return 'login';
}
