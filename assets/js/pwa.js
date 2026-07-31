(function initializeMedSolutionPwa(global) {
  'use strict';

  let installPrompt = null;

  function installButtons() {
    return [...document.querySelectorAll('[data-install-medsolution]')];
  }

  function updateInstallButtons() {
    const installed = global.matchMedia?.('(display-mode: standalone)').matches
      || global.navigator.standalone === true;
    installButtons().forEach((button) => {
      button.hidden = installed;
      button.disabled = !installPrompt;
      button.title = installPrompt
        ? 'Instalar MedSolution en este dispositivo'
        : 'La instalación estará disponible cuando el navegador complete la verificación';
    });
  }

  async function requestInstallation() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    updateInstallButtons();
  }

  global.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButtons();
  });

  global.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateInstallButtons();
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-install-medsolution]');
    if (button) requestInstallation().catch((error) => console.error('[PWA] No se pudo iniciar la instalación:', error));
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    global.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .catch((error) => console.error('[PWA] No se pudo registrar el service worker:', error));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateInstallButtons, { once: true });
  else updateInstallButtons();
})(window);
