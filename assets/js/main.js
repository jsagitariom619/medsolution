import { renderApp } from './components.js';

const routes = {
  login: 'index.html',
  dashboard: 'pages/dashboard.html',
  patients: 'pages/patients.html',
  appointments: 'pages/appointments.html',
  records: 'pages/medical-records.html',
  schedule: 'pages/schedule.html',
  settings: 'pages/settings.html',
};

const handleLogin = () => {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.location.href = routes.dashboard;
  });
};

const registerShortcuts = () => {
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.querySelector('.search-box input')?.focus();
    }
  });
};

renderApp();
handleLogin();
registerShortcuts();
