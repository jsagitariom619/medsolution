let dashboardSubscriptionsReady=false;
const DASHBOARD_MODULES = new Set(['patients.html','appointments.html','medical-records.html','schedule.html','services.html','contraceptives.html','reports.html','settings.html']);

function dashboardModuleTarget(value) {
  if (!value) return null;
  const url = new URL(value, window.location.href);
  const page = url.pathname.split('/').pop();
  return DASHBOARD_MODULES.has(page) ? `${page}${url.search}${url.hash}` : null;
}

function setDashboardActiveModule(target = '') {
  const page = String(target).split(/[?#]/)[0];
  document.querySelectorAll('.dashboard-sidebar [data-nav-link]').forEach((link) => {
    const linkPage = new URL(link.href, location.href).pathname.split('/').pop();
    link.classList.toggle('nav-link--active', page ? linkPage === page : linkPage === 'dashboard.html');
  });
}

function showDashboardHome(pushState = true) {
  const home = document.getElementById('dashboardHomeView');
  const frame = document.getElementById('dashboardModuleFrame');
  home.hidden = false;
  frame.hidden = true;
  frame.removeAttribute('src');
  delete frame.dataset.currentTarget;
  setDashboardActiveModule();
  if (pushState) history.pushState({ module: '' }, '', 'dashboard.html');
}

function openDashboardModule(target, pushState = true) {
  const moduleTarget = dashboardModuleTarget(target);
  if (!moduleTarget) return false;
  const home = document.getElementById('dashboardHomeView');
  const frame = document.getElementById('dashboardModuleFrame');
  home.hidden = true;
  frame.hidden = false;
  frame.dataset.currentTarget = moduleTarget;
  const moduleUrl = new URL(moduleTarget, location.href);
  moduleUrl.searchParams.set('_msLoad', String(Date.now()));
  frame.src = `${moduleUrl.pathname.split('/').pop()}${moduleUrl.search}${moduleUrl.hash}`;
  setDashboardActiveModule(moduleTarget);
  if (pushState) history.pushState({ module: moduleTarget }, '', `dashboard.html?module=${encodeURIComponent(moduleTarget)}`);
  return true;
}

function setupDashboardShell() {
  const frame = document.getElementById('dashboardModuleFrame');
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#')) return;
    const page = new URL(link.href, location.href).pathname.split('/').pop();
    if (page === 'dashboard.html') {
      event.preventDefault();
      showDashboardHome();
    } else if (dashboardModuleTarget(link.href)) {
      event.preventDefault();
      openDashboardModule(link.href);
    }
  });
  frame.addEventListener('load', () => {
    try {
      const page = frame.contentWindow.location.pathname.split('/').pop();
      if (page === 'dashboard.html') { showDashboardHome(false); return; }
      const loadedUrl = new URL(frame.contentWindow.location.href);
      loadedUrl.searchParams.delete('_msLoad');
      const target = dashboardModuleTarget(`${page}${loadedUrl.search}${loadedUrl.hash}`);
      if (target) {
        frame.dataset.currentTarget = target;
        setDashboardActiveModule(target);
        history.replaceState({ module: target }, '', `dashboard.html?module=${encodeURIComponent(target)}`);
      }
    } catch { /* El módulo conserva su navegación aunque el navegador restrinja la inspección. */ }
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.data?.type !== 'medsolution:users-updated') return;
    window.dispatchEvent(new StorageEvent('storage', { key: 'medsolution.systemUsers' }));
  });
  window.addEventListener('popstate', () => {
    const target = new URLSearchParams(location.search).get('module');
    if (target) openDashboardModule(target, false); else showDashboardHome(false);
  });
  const initial = new URLSearchParams(location.search).get('module');
  if (initial) openDashboardModule(initial, false); else setDashboardActiveModule();
}

function dashboardEscape(value) { const element=document.createElement('div');element.textContent=value==null?'':String(value);return element.innerHTML; }
function dashboardInitials(name) { return String(name||'').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase(); }
function dashboardFormatDate(date) { if(!date)return '—';const [year,month,day]=date.split('-');return `${day}/${month}/${year}`; }
function dashboardBoliviaNow() { const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(part=>[part.type,part.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`}; }
function dashboardToday() { return dashboardBoliviaNow().date; }

function renderDashboardChart(attentions) {
  const target=document.getElementById('dashboardMonthlyChart');
  const now=new Date();const months=[];
  for(let offset=5;offset>=0;offset--){const date=new Date(now.getFullYear(),now.getMonth()-offset,1);const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;months.push({key,label:date.toLocaleDateString('es',{month:'short'}),count:attentions.filter(item=>String(item.date||'').startsWith(key)&&item.contraceptiveControl!==true).length})}
  const max=Math.max(1,...months.map(item=>item.count));
  target.innerHTML=months.map(item=>`<div class="dashboard-month-bar"><strong>${item.count}</strong><i style="height:${Math.max(6,(item.count/max)*175)}px"></i><small>${dashboardEscape(item.label)}</small></div>`).join('');
}

function renderDashboardAppointments(schedule) {
  const current=dashboardBoliviaNow();const today=current.date;const currentTime=current.time;
  const items=schedule.filter(item=>item.date===today&&!['Cancelada','Atendida'].includes(item.status)).sort((a,b)=>String(a.time).localeCompare(String(b.time)));
  document.getElementById('dashboardTodayAppointments').innerHTML=items.length?items.slice(0,6).map(item=>`<div class="appointment-row"><time>${dashboardEscape(item.time||'—')}</time><span class="patient-initials">${dashboardInitials(item.patientName)}</span><div><strong>${dashboardEscape(item.patientName)}</strong><small>${dashboardEscape(item.serviceName||item.reason||'Cita pendiente')}</small></div><span class="badge badge--pending">${dashboardEscape(item.status||'Pendiente')}</span></div>`).join(''):'<p class="dashboard-empty">No hay citas pendientes para hoy.</p>';
  return items.filter(item=>String(item.time||'')>=currentTime).length;
}

function renderDashboardPatients(patients,attentions) {
  const recent=[...patients].sort((a,b)=>String(b.registrado||'').localeCompare(String(a.registrado||''))).slice(0,5);const target=document.getElementById('dashboardRecentPatients');
  const head='<div class="recent-patients-head"><span>Paciente</span><span>Última atención</span><span>Acciones</span></div>';
  target.innerHTML=head+(recent.length?recent.map(patient=>{const last=attentions.filter(item=>Number(item.patientId)===Number(patient.id)&&item.contraceptiveControl!==true).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];return `<div class="recent-patient-row"><div><span class="patient-photo">${dashboardInitials(`${patient.nombre} ${patient.apellido}`)}</span><p><strong>${dashboardEscape(`${patient.nombre} ${patient.apellido}`)}</strong><small>${dashboardEscape(patient.telefono||patient.ci||'Sin contacto')}</small></p></div><time>${dashboardFormatDate(last?.date||patient.registrado)}</time><span class="action-links"><a href="patients.html?patientId=${patient.id}">Ver</a><a href="appointments.html?action=new&patientId=${patient.id}">Atender</a></span></div>`}).join(''):'<p class="dashboard-empty">No hay pacientes registrados.</p>');
}

async function setupFunctionalDashboard() {
  await window.MedSolutionData?.ready;
  try {
    const [patients,attentions,histories,schedule]=await Promise.all([window.MedSolutionData.getPatients(),window.MedSolutionData.getAttentions(),window.MedSolutionData.getMedicalRecords(),window.MedSolutionData.getAppointments()]);
    const today=dashboardToday(),month=today.slice(0,7);
    const medical=attentions.filter(item=>item.contraceptiveControl!==true),monthly=medical.filter(item=>String(item.date||'').startsWith(month));
    const pending=medical.filter(item=>['Pendiente','Pendiente de consulta','En consulta'].includes(item.status));
    const todaySchedule=schedule.filter(item=>item.date===today&&!['Cancelada','Atendida'].includes(item.status));
    const contraceptiveDue=attentions.filter(item=>item.contraceptiveControl===true&&item.nextApplicationDate===today).length;
    const controlsDue=medical.filter(item=>item.nextControl===today).length;
    document.getElementById('dashboardPatientCount').textContent=patients.length;
    document.getElementById('dashboardMonthlyCareCount').textContent=monthly.length;
    document.getElementById('dashboardHistoryCount').textContent=histories.length;
    document.getElementById('dashboardTodayScheduleCount').textContent=todaySchedule.length;
    document.getElementById('dashboardPatientTrend').textContent=`${patients.filter(item=>String(item.registrado||'').startsWith(month)).length} registrados este mes`;
    document.getElementById('dashboardPendingPatients').textContent=pending.length;
    document.getElementById('dashboardContraceptiveDue').textContent=contraceptiveDue;
    document.getElementById('dashboardControlsDue').textContent=controlsDue;
    const upcoming=renderDashboardAppointments(schedule);document.getElementById('dashboardUpcomingToday').textContent=upcoming;
    const reminders=pending.length+contraceptiveDue+controlsDue+upcoming;document.getElementById('dashboardReminderCount').textContent=`${reminders} pendiente${reminders===1?'':'s'}`;
    const badge=document.querySelector('.notification-button span');if(badge)badge.textContent=reminders;
    renderDashboardChart(attentions);renderDashboardPatients(patients,attentions);
    const search=document.querySelector('.dashboard-search input');if(search)search.onkeydown=event=>{if(event.key==='Enter'&&search.value.trim())openDashboardModule(`patients.html?search=${encodeURIComponent(search.value.trim())}`)};
    if(!dashboardSubscriptionsReady){dashboardSubscriptionsReady=true;window.MedSolutionData.subscribePatients(setupFunctionalDashboard);window.MedSolutionData.subscribeAttentions(setupFunctionalDashboard);window.MedSolutionData.subscribeAppointments(setupFunctionalDashboard)}
  } catch(error) { document.getElementById('dashboardTodayAppointments').innerHTML=`<p class="dashboard-empty">No se pudo cargar el Dashboard: ${dashboardEscape(error.message)}</p>`; }
}
function bootDashboard() {
  if (window.__medSolutionDashboardBooted) return;
  window.__medSolutionDashboardBooted = true;
  setupFunctionalDashboard();
  setupDashboardShell();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootDashboard, { once: true });
else bootDashboard();
