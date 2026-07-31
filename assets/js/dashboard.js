const DASHBOARD_SCHEDULE_KEY = 'medsolution.appointments';
let dashboardSubscriptionsReady=false;

function dashboardReadSchedule() {
  try { const value = JSON.parse(localStorage.getItem(DASHBOARD_SCHEDULE_KEY)); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function dashboardEscape(value) { const element=document.createElement('div');element.textContent=value==null?'':String(value);return element.innerHTML; }
function dashboardInitials(name) { return String(name||'').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase(); }
function dashboardFormatDate(date) { if(!date)return '—';const [year,month,day]=date.split('-');return `${day}/${month}/${year}`; }
function dashboardToday() { const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); }

function renderDashboardChart(attentions) {
  const target=document.getElementById('dashboardMonthlyChart');
  const now=new Date();const months=[];
  for(let offset=5;offset>=0;offset--){const date=new Date(now.getFullYear(),now.getMonth()-offset,1);const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;months.push({key,label:date.toLocaleDateString('es',{month:'short'}),count:attentions.filter(item=>String(item.date||'').startsWith(key)&&item.contraceptiveControl!==true).length})}
  const max=Math.max(1,...months.map(item=>item.count));
  target.innerHTML=months.map(item=>`<div class="dashboard-month-bar"><strong>${item.count}</strong><i style="height:${Math.max(6,(item.count/max)*175)}px"></i><small>${dashboardEscape(item.label)}</small></div>`).join('');
}

function renderDashboardAppointments(schedule) {
  const today=dashboardToday();const currentTime=new Date().toTimeString().slice(0,5);
  const items=schedule.filter(item=>item.date===today&&!['Cancelada','Atendida'].includes(item.status)).sort((a,b)=>String(a.time).localeCompare(String(b.time)));
  document.getElementById('dashboardTodayAppointments').innerHTML=items.length?items.slice(0,6).map(item=>`<div class="appointment-row"><time>${dashboardEscape(item.time||'—')}</time><span class="patient-initials">${dashboardInitials(item.patientName)}</span><div><strong>${dashboardEscape(item.patientName)}</strong><small>${dashboardEscape(item.serviceName||item.reason||'Cita programada')}</small></div><span class="badge ${item.status==='Confirmada'?'':'badge--pending'}">${dashboardEscape(item.status||'Programada')}</span></div>`).join(''):'<p class="dashboard-empty">No hay citas pendientes para hoy.</p>';
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
    const [patients,attentions,histories]=await Promise.all([window.MedSolutionData.getPatients(),window.MedSolutionData.getAttentions(),window.MedSolutionData.getMedicalRecords()]);
    const schedule=dashboardReadSchedule(),today=dashboardToday(),month=today.slice(0,7);
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
    const search=document.querySelector('.dashboard-search input');if(search)search.onkeydown=event=>{if(event.key==='Enter'&&search.value.trim())location.href=`patients.html?search=${encodeURIComponent(search.value.trim())}`};
    if(!dashboardSubscriptionsReady){dashboardSubscriptionsReady=true;window.MedSolutionData.subscribePatients(setupFunctionalDashboard);window.MedSolutionData.subscribeAttentions(setupFunctionalDashboard);window.addEventListener('storage',event=>{if(event.key===DASHBOARD_SCHEDULE_KEY)setupFunctionalDashboard()})}
  } catch(error) { document.getElementById('dashboardTodayAppointments').innerHTML=`<p class="dashboard-empty">No se pudo cargar el Dashboard: ${dashboardEscape(error.message)}</p>`; }
}
document.addEventListener('DOMContentLoaded',setupFunctionalDashboard);
