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

const setActiveNavigation = () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const targetPage = link.getAttribute('href')?.split('/').pop();
    link.classList.toggle('nav-link--active', targetPage === currentPage);
  });
};

handleLogin();
setActiveNavigation();
