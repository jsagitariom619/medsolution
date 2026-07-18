const icons = {
  dashboard: '⌂', patients: '👥', care: '✚', records: '▣', schedule: '◷', reports: '◫', prescriptions: 'Rx', settings: '⚙', logout: '↪', search: '⌕', bell: '♢', trend: '↗', view: '◉', print: '▤'
};

const pageMeta = {
  'dashboard.html': { label: 'Dashboard', title: '¡Bienvenido, Dr. Jeason Flores!', description: 'Aquí tienes un resumen general de tu consultorio médico.' },
  'patients.html': { label: 'Pacientes', title: 'Gestión de pacientes', description: 'Administra registros, búsqueda clínica y seguimiento de pacientes.' },
  'appointments.html': { label: 'Nueva Atención', title: 'Atenciones y citas', description: 'Coordina la agenda del día e inicia nuevas atenciones profesionales.' },
  'medical-records.html': { label: 'Historias Clínicas', title: 'Historias clínicas', description: 'Base preparada para historia general, estética y podológica.' },
  'schedule.html': { label: 'Agenda', title: 'Agenda médica', description: 'Organiza disponibilidad, turnos y planificación diaria del consultorio.' },
  'settings.html': { label: 'Configuración', title: 'Configuración', description: 'Gestiona parámetros del consultorio, seguridad y futuras integraciones.' }
};

const navigation = [
  ['dashboard.html', icons.dashboard, 'Dashboard'],
  ['patients.html', icons.patients, 'Pacientes'],
  ['appointments.html', icons.care, 'Nueva Atención'],
  ['medical-records.html', icons.records, 'Historias Clínicas'],
  ['schedule.html', icons.schedule, 'Agenda'],
  ['appointments.html#reports', icons.reports, 'Reportes'],
  ['medical-records.html#prescriptions', icons.prescriptions, 'Recetas e Impresiones'],
  ['settings.html', icons.settings, 'Configuración']
];

const stats = [
  { icon: icons.patients, label: 'Pacientes registrados', value: '248', detail: '+12 este mes', tone: 'green' },
  { icon: icons.records, label: 'Atenciones este mes', value: '156', detail: '+18% vs mes anterior', tone: 'blue' },
  { icon: '▭', label: 'Historias clínicas', value: '302', detail: 'Total en el sistema', tone: 'purple' },
  { icon: icons.schedule, label: 'Citas programadas', value: '28', detail: 'Para hoy', tone: 'amber' }
];

const appointments = [
  ['09:00', 'ML', 'María Fernanda López', 'Control general', 'Confirmada', 'success'],
  ['10:00', 'CR', 'Carlos Alberto Rojas', 'Dolor lumbar', 'En consulta', 'info'],
  ['11:30', 'AM', 'Ana Gabriela Méndez', 'Control prenatal', 'Confirmada', 'success'],
  ['14:30', 'LV', 'Luis Miguel Vargas', 'Revisión resultados', 'Pendiente', 'warning'],
  ['16:00', 'ET', 'Eliana Suárez Torres', 'Evaluación dermatológica', 'En consulta', 'info']
];

const patients = [
  ['MF', 'María Fernanda López', 'CI: 12345678', '17/06/2025'],
  ['CR', 'Carlos Alberto Rojas', 'CI: 87654321', '16/06/2025'],
  ['AM', 'Ana Gabriela Méndez', 'CI: 11223344', '15/06/2025']
];

const quickActions = [
  ['patients.html', '✚', 'Nuevo Paciente'],
  ['patients.html#search', icons.search, 'Buscar Paciente'],
  ['medical-records.html', icons.records, 'Nueva Historia'],
  ['medical-records.html#prescriptions', icons.prescriptions, 'Nueva Receta'],
  ['medical-records.html#print', icons.print, 'Impresiones']
];

const modules = [
  ['Registro de pacientes', 'Modelo listo para fichas, contacto, antecedentes y trazabilidad clínica.'],
  ['Nueva Atención', 'Punto de entrada para consulta, diagnóstico, indicaciones y receta.'],
  ['Historia Clínica General', 'Estructura preparada para evolución médica integral.'],
  ['Historia Clínica Estética', 'Base para procedimientos, consentimientos y seguimiento fotográfico futuro.'],
  ['Historia Clínica Podológica', 'Preparada para evaluación podológica, evolución y controles.'],
  ['Agenda y Recetas', 'Componentes diseñados para disponibilidad, turnos e impresiones clínicas.']
];

const currentPage = () => window.location.pathname.split('/').pop() || 'index.html';

const sidebar = (page) => `
  <aside class="sidebar" aria-label="Navegación principal">
    <a class="brand brand--light" href="dashboard.html" aria-label="Med Solution dashboard">
      <span class="brand__mark">✚</span>
      <span><strong>Med Solution</strong><small>Sistema Médico Integral</small></span>
    </a>
    <div class="doctor-card">
      <span class="doctor-card__avatar">JF</span>
      <div><strong>Dr. Jeason Flores</strong><small>Médico General</small><em>● En línea</em></div>
    </div>
    <nav class="sidebar__nav">
      ${navigation.map(([href, icon, label]) => `<a class="nav-link ${href.split('#')[0] === page ? 'nav-link--active' : ''}" href="${href}"><span class="nav-link__icon">${icon}</span>${label}</a>`).join('')}
    </nav>
    <div class="security-card"><span>☁︎</span><strong>Tus datos están seguros</strong><small>Sistema preparado para seguridad, roles y políticas de Supabase.</small><em>✓ Backup automático</em></div>
    <a class="logout-link" href="../index.html"><span>${icons.logout}</span>Cerrar sesión</a>
  </aside>`;

const topbar = () => `
  <header class="topbar">
    <button class="menu-btn" type="button" aria-label="Abrir menú">☰</button>
    <label class="search-box"><span>${icons.search}</span><input type="search" placeholder="Buscar paciente..." /><kbd>Ctrl + K</kbd></label>
    <div class="topbar__actions"><button class="notification-btn" type="button" aria-label="Notificaciones">${icons.bell}<span>3</span></button><div class="user-chip"><span class="avatar">JF</span><span><strong>Dr. Jeason Flores</strong><small>Administrador</small></span>⌄</div></div>
  </header>`;

const statCards = () => `<section class="stats-grid" aria-label="Indicadores principales">${stats.map((item) => `<article class="metric-card metric-card--${item.tone}"><span class="metric-card__icon">${item.icon}</span><div><small>${item.label}</small><strong>${item.value}</strong><em>${item.detail} ${icons.trend}</em></div></article>`).join('')}</section>`;

const chartPanel = () => `
  <article class="panel chart-panel"><div class="panel__header"><h2>Atenciones por mes</h2><button class="btn btn--ghost">Este año ⌄</button></div>
    <div class="chart" role="img" aria-label="Gráfico de atenciones por mes">
      <svg viewBox="0 0 640 260" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#14b8a6" stop-opacity="0.28"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0.02"/></linearGradient></defs><path class="chart-grid" d="M0 40H640M0 95H640M0 150H640M0 205H640"/><path class="chart-fill" d="M18 190 L95 155 L170 172 L245 135 L320 116 L395 72 L470 112 L545 78 L622 106 L622 238 L18 238 Z"/><path class="chart-line" d="M18 190 L95 155 L170 172 L245 135 L320 116 L395 72 L470 112 L545 78 L622 106"/><g class="chart-dots"><circle cx="18" cy="190" r="5"/><circle cx="95" cy="155" r="5"/><circle cx="170" cy="172" r="5"/><circle cx="245" cy="135" r="5"/><circle cx="395" cy="72" r="5"/><circle cx="545" cy="78" r="5"/><circle cx="622" cy="106" r="6"/></g></svg>
      <div class="chart-tooltip"><strong>Junio</strong><span>156 atenciones</span></div>
      <div class="chart-labels"><span>Ene</span><span>Feb</span><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span></div>
    </div>
  </article>`;

const appointmentsPanel = () => `<article class="panel"><div class="panel__header"><h2>Próximas citas de hoy</h2><a class="btn btn--ghost" href="schedule.html">Ver agenda</a></div><div class="appointment-list">${appointments.map(([time, initials, name, reason, status, tone]) => `<div class="appointment-row"><time>${time}</time><span class="mini-avatar">${initials}</span><div><strong>${name}</strong><small>${reason}</small></div><span class="status status--${tone}">${status}</span><button aria-label="Más opciones">⋮</button></div>`).join('')}</div></article>`;

const quickPanel = () => `<article class="panel"><div class="panel__header"><h2>Accesos rápidos</h2></div><div class="quick-grid">${quickActions.map(([href, icon, label]) => `<a class="quick-card" href="${href}"><span>${icon}</span><strong>${label}</strong></a>`).join('')}</div></article>`;

const patientsPanel = () => `<article class="panel"><div class="panel__header"><h2>Pacientes recientes</h2><a class="btn btn--ghost" href="patients.html">Ver todos</a></div><div class="patients-table"><div class="patients-table__head"><span>Paciente</span><span>Última atención</span><span>Acciones</span></div>${patients.map(([initials, name, id, date]) => `<div class="patient-row"><div><span class="mini-avatar mini-avatar--photo">${initials}</span><p><strong>${name}</strong><small>${id}</small></p></div><time>${date}</time><span class="patient-actions"><button aria-label="Ver paciente">${icons.view}</button><button aria-label="Imprimir ficha">${icons.print}</button></span></div>`).join('')}</div></article>`;

const dashboard = () => `${statCards()}<section class="dashboard-grid dashboard-grid--primary">${chartPanel()}${appointmentsPanel()}</section><section class="dashboard-grid dashboard-grid--secondary">${quickPanel()}${patientsPanel()}</section>`;

const modulePage = (page) => `<section class="module-grid">${modules.map(([title, text]) => `<article class="module-card"><span>✚</span><h2>${title}</h2><p>${text}</p></article>`).join('')}</section><section class="panel roadmap-panel"><h2>Arquitectura preparada para Supabase</h2><p>Los componentes de navegación, búsqueda, tarjetas, tablas y estados están centralizados para conectar autenticación, base de datos, storage y políticas de seguridad sin reestructurar la interfaz.</p></section>`;

export const renderApp = () => {
  const root = document.querySelector('[data-app-root]');
  if (!root) return;
  const page = currentPage();
  const meta = pageMeta[page] || pageMeta['dashboard.html'];
  root.innerHTML = `${sidebar(page)}<main class="main-area">${topbar()}<section class="content"><div class="welcome-row"><div><h1>${meta.title}</h1><p>${meta.description}</p></div><a class="btn btn--primary btn--care" href="appointments.html"><span>${icons.care}</span>Nueva Atención</a></div>${page === 'dashboard.html' ? dashboard() : modulePage(page)}</section><footer class="app-footer"><span>© 2025 Med Solution · Sistema Médico Integral.</span><span>Versión 1.0.0 ✚</span></footer></main>`;
};
