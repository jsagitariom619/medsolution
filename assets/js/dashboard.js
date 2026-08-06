let dashboardSubscriptionsReady=false;
const dashboardData={patients:[],attentions:[],histories:[],realtimeTimers:new Map()};
const DASHBOARD_MODULES = new Set(['patients.html','appointments.html','medical-records.html','schedule.html','services.html','contraceptives.html','reports.html','settings.html']);

function closeDashboardMenus(except = '') {
  [['notifications','dashboardNotificationsButton','dashboardNotificationsMenu'],['user','dashboardUserButton','dashboardUserMenu']].forEach(([name,buttonId,menuId])=>{
    if(name===except)return;
    const button=document.getElementById(buttonId),menu=document.getElementById(menuId);
    if(button)button.setAttribute('aria-expanded','false');
    if(menu)menu.hidden=true;
  });
}

function toggleDashboardMenu(name) {
  const definitions={notifications:['dashboardNotificationsButton','dashboardNotificationsMenu'],user:['dashboardUserButton','dashboardUserMenu']};
  const [buttonId,menuId]=definitions[name]||[];
  const button=document.getElementById(buttonId),menu=document.getElementById(menuId);
  if(!button||!menu)return;
  const opening=menu.hidden;
  closeDashboardMenus(name);
  menu.hidden=!opening;
  button.setAttribute('aria-expanded',String(opening));
}

function renderDashboardNotifications(items) {
  const list=document.getElementById('dashboardNotificationList'),summary=document.getElementById('dashboardNotificationsSummary');
  const total=items.reduce((sum,item)=>sum+item.count,0);
  const badge=document.querySelector('.notification-button span');
  if(badge){badge.textContent=total;badge.hidden=total===0}
  if(summary)summary.textContent=`${total} pendiente${total===1?'':'s'}`;
  if(!list)return;
  list.innerHTML=items.length?items.map(item=>`<a class="dashboard-notification-item" href="${item.href}"><span>${item.icon}</span><div><strong>${dashboardEscape(item.title)}</strong><small>${dashboardEscape(item.description)}</small></div><em>${item.count}</em></a>`).join(''):'<p class="dashboard-dropdown-empty">No hay notificaciones pendientes.</p>';
}

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
  document.getElementById('dashboardNotificationsButton')?.addEventListener('click',event=>{event.stopPropagation();toggleDashboardMenu('notifications')});
  document.getElementById('dashboardUserButton')?.addEventListener('click',event=>{event.stopPropagation();toggleDashboardMenu('user')});
  document.addEventListener('click',event=>{if(!event.target.closest('.dashboard-menu-anchor'))closeDashboardMenus()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeDashboardMenus();document.activeElement?.blur()}});
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#')) return;
    const page = new URL(link.href, location.href).pathname.split('/').pop();
    if (page === 'dashboard.html') {
      event.preventDefault();
      closeDashboardMenus();
      showDashboardHome();
    } else if (dashboardModuleTarget(link.href)) {
      event.preventDefault();
      closeDashboardMenus();
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
  for(let offset=5;offset>=0;offset--){const date=new Date(now.getFullYear(),now.getMonth()-offset,1);const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;months.push({key,label:date.toLocaleDateString('es',{month:'short'}),count:attentions.filter(item=>String(item.date||'').startsWith(key)&&item.contraceptiveControl!==true&&item.contraceptiveSchedule!==true).length})}
  const max=Math.max(1,...months.map(item=>item.count));
  target.innerHTML=months.map(item=>`<div class="dashboard-month-bar"><strong>${item.count}</strong><i style="height:${Math.max(6,(item.count/max)*175)}px"></i><small>${dashboardEscape(item.label)}</small></div>`).join('');
}

function renderDashboardAppointments(schedule) {
  const current=dashboardBoliviaNow();const today=current.date;const currentTime=current.time;
  const items=schedule.filter(item=>item.date>=today&&!['Cancelada','Atendida'].includes(item.status)).sort((a,b)=>`${a.date}${a.time||''}`.localeCompare(`${b.date}${b.time||''}`));
  document.getElementById('dashboardTodayAppointments').innerHTML=items.length?items.slice(0,6).map(item=>`<div class="appointment-row"><time>${item.date===today?dashboardEscape(item.time||'—'):`${dashboardFormatDate(item.date)}<small>${dashboardEscape(item.time||'—')}</small>`}</time><span class="patient-initials">${dashboardInitials(item.patientName)}</span><div><strong>${dashboardEscape(item.patientName)}</strong><small>${dashboardEscape(item.serviceName||item.reason||'Cita pendiente')}</small></div><span class="badge badge--pending">${dashboardEscape(item.status||'Pendiente')}</span></div>`).join(''):'<p class="dashboard-empty">No existen citas programadas.</p>';
  return items.filter(item=>item.date===today&&String(item.time||'')>=currentTime).length;
}

function renderDashboardPatients(patients,attentions) {
  const recent=[...patients].sort((a,b)=>String(b.registrado||'').localeCompare(String(a.registrado||''))).slice(0,5);const target=document.getElementById('dashboardRecentPatients');attentions=attentions.filter(item=>item.scheduledOnly!==true);
  const head='<div class="recent-patients-head"><span>Paciente</span><span>Última atención</span><span>Acciones</span></div>';
  target.innerHTML=head+(recent.length?recent.map(patient=>{const last=attentions.filter(item=>Number(item.patientId)===Number(patient.id)&&item.contraceptiveControl!==true&&item.contraceptiveSchedule!==true).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];return `<div class="recent-patient-row"><div><span class="patient-photo">${dashboardInitials(`${patient.nombre} ${patient.apellido}`)}</span><p><strong>${dashboardEscape(`${patient.nombre} ${patient.apellido}`)}</strong><small>${dashboardEscape(patient.telefono||patient.ci||'Sin contacto')}</small></p></div><time>${dashboardFormatDate(last?.date||patient.registrado)}</time><span class="action-links"><a href="patients.html?patientId=${patient.id}">Ver</a><a href="appointments.html?action=new&patientId=${patient.id}">Atender</a></span></div>`}).join(''):'<p class="dashboard-empty">No hay pacientes registrados.</p>');
}

function scheduleDashboardRefresh(collection){clearTimeout(dashboardData.realtimeTimers.get(collection));dashboardData.realtimeTimers.set(collection,setTimeout(()=>{dashboardData.realtimeTimers.delete(collection);setupFunctionalDashboard(collection)},100))}
async function setupFunctionalDashboard(collection='all') {
  await window.MedSolutionData?.ready;
  try {
    if(collection==='all')[dashboardData.patients,dashboardData.attentions,dashboardData.histories]=await Promise.all([window.MedSolutionData.getPatients(),window.MedSolutionData.getAttentions(),window.MedSolutionData.getMedicalRecords()]);
    else if(collection==='patients')dashboardData.patients=await window.MedSolutionData.getPatients();
    else if(collection==='attentions')dashboardData.attentions=await window.MedSolutionData.getAttentions();
    const {patients,attentions,histories}=dashboardData;
    const schedule=attentions.filter(item=>item.contraceptiveControl!==true).map(item=>({...item,serviceName:item.serviceType,status:item.scheduleStatus||({'Pendiente de consulta':'Pendiente','En consulta':'En Atención',Finalizada:'Atendida'}[item.status]||item.status)}));
    const today=dashboardToday(),month=today.slice(0,7);
    const medical=attentions.filter(item=>item.contraceptiveControl!==true&&item.contraceptiveSchedule!==true&&item.scheduledOnly!==true),monthly=medical.filter(item=>String(item.date||'').startsWith(month));
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
    const scheduledContraceptiveToday=schedule.filter(item=>item.contraceptiveSchedule===true&&item.date===today&&!['Cancelada','Atendida'].includes(item.status)).length;
    const reminders=pending.length+contraceptiveDue+controlsDue+upcoming-Math.min(contraceptiveDue,scheduledContraceptiveToday);document.getElementById('dashboardReminderCount').textContent=`${reminders} pendiente${reminders===1?'':'s'}`;
    const notificationItems=[];
    if(pending.length)notificationItems.push({icon:'🩺',title:'Pacientes pendientes',description:'Atenciones médicas por revisar',count:pending.length,href:'appointments.html'});
    if(upcoming)notificationItems.push({icon:'◷',title:'Próximas citas de hoy',description:'Citas programadas aún pendientes',count:upcoming,href:'schedule.html'});
    if(contraceptiveDue)notificationItems.push({icon:'◉',title:'Anticonceptivos para hoy',description:'Aplicaciones con control programado',count:contraceptiveDue,href:'contraceptives.html'});
    if(controlsDue)notificationItems.push({icon:'↻',title:'Controles médicos para hoy',description:'Pacientes que deben volver a control',count:controlsDue,href:'medical-records.html'});
    renderDashboardNotifications(notificationItems);
    renderDashboardChart(medical);renderDashboardPatients(patients,medical);
    const search=document.querySelector('.dashboard-search input');if(search)search.onkeydown=event=>{if(event.key==='Enter'&&search.value.trim())openDashboardModule(`patients.html?search=${encodeURIComponent(search.value.trim())}`)};
    if(!dashboardSubscriptionsReady){dashboardSubscriptionsReady=true;window.MedSolutionData.subscribePatients(()=>scheduleDashboardRefresh('patients'));window.MedSolutionData.subscribeAttentions(()=>scheduleDashboardRefresh('attentions'))}
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
