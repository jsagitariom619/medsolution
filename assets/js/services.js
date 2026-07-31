const catalogState={services:[],staff:[],attentions:[],editingServiceId:null,editingStaffId:null,search:'',showInactive:false,logFilters:{period:'',from:'',to:'',service:'',responsible:'',status:'',patient:''}};
const data=()=>window.MedSolutionData;
let catalogSaving=false;
function esc(v){const e=document.createElement('div');e.textContent=v==null?'':String(v);return e.innerHTML}
function money(v){return `${Number(v||0).toFixed(2)} Bs`}
function badge(active){return `<span class="service-status ${active===false?'service-status--inactive':''}">${active===false?'Inactivo':'Activo'}</span>`}
function behavior(s){return [s.requires_medical_consultation?'Requiere consulta':'Sin consulta',s.generates_medical_record?'Genera historia':'Sin historia',`Responsable: ${s.allowed_responsible}`].join(' · ')}
function authUser(){try{return JSON.parse(sessionStorage.getItem('medsolution.authUser')||localStorage.getItem('medsolution.authUser')||'null')}catch{return null}}
function canManageClinical(){return ['Administrador','Médico'].includes(authUser()?.role)}
function formatDate(value){if(!value)return '—';const [year,month,day]=String(value).split('-');return `${day}/${month}/${year}`}
function boliviaDate(date=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`}
function dateLimits(period){const today=boliviaDate();const base=new Date(`${today}T12:00:00-04:00`);if(period==='today')return [today,today];if(period==='week'){const start=new Date(base);start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));return [boliviaDate(start),today]}if(period==='month')return [`${today.slice(0,7)}-01`,today];return ['', '']}
function displayAttentionStatus(status){return ({'En consulta':'En atención',Finalizada:'Atendida','Pendiente de consulta':'Pendiente'}[status]||status||'Pendiente')}
function attentionResponsible(item){return item.procedureResponsible||item.scheduledProfessional||item.registeredBy||'—'}
async function loadAll(){
  try{
    [catalogState.services,catalogState.staff,catalogState.attentions]=await Promise.all([data().getServices(true),data().getAllStaff(),data().getAttentions()]);
    populateLogFilters();renderServiceLog();renderServices();renderStaff();
    const sync=document.getElementById('serviceSync');sync.textContent=data().isConfigured()?'Sincronizado en tiempo real':'Sin conexión a Supabase';
    sync.classList.toggle('sync-indicator--online',data().isConfigured());
  }catch(error){alert(error.message)}
}
function populateLogFilters(){
  const service=document.getElementById('serviceLogService'),responsible=document.getElementById('serviceLogResponsible');if(!service||!responsible)return;
  const serviceValue=service.value,responsibleValue=responsible.value;
  const serviceNames=[...new Set(catalogState.attentions.map(item=>item.serviceType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const responsibleNames=[...new Set(catalogState.attentions.map(attentionResponsible).filter(name=>name&&name!=='—'))].sort((a,b)=>a.localeCompare(b,'es'));
  service.innerHTML='<option value="">Todos los servicios</option>'+serviceNames.map(name=>`<option>${esc(name)}</option>`).join('');
  responsible.innerHTML='<option value="">Todos los responsables</option>'+responsibleNames.map(name=>`<option>${esc(name)}</option>`).join('');
  service.value=serviceValue;responsible.value=responsibleValue;
}
function filteredServiceLog(){
  const filter=catalogState.logFilters;let [from,to]=dateLimits(filter.period);if(filter.period==='range'){from=filter.from;to=filter.to}
  return catalogState.attentions.filter(item=>{
    if(from&&String(item.date)<from)return false;if(to&&String(item.date)>to)return false;
    if(filter.service&&item.serviceType!==filter.service)return false;
    if(filter.responsible&&attentionResponsible(item)!==filter.responsible)return false;
    if(filter.status&&displayAttentionStatus(item.status)!==filter.status)return false;
    if(filter.patient&&!String(item.patientName||'').toLowerCase().includes(filter.patient.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>`${b.date}${b.time||''}`.localeCompare(`${a.date}${a.time||''}`));
}
function renderServiceLog(){
  const body=document.getElementById('serviceLogBody');if(!body)return;const items=filteredServiceLog();
  document.getElementById('serviceLogCount').textContent=`${items.length} registro${items.length===1?'':'s'}`;
  if(!items.length){body.innerHTML='<tr><td colspan="7" class="patients-empty">No se encontraron servicios realizados con estos filtros.</td></tr>';return}
  body.innerHTML=items.map(item=>`<tr><td>${formatDate(item.date)}</td><td>${esc(item.time||'—')}</td><td><strong>${esc(item.patientName||'Paciente')}</strong></td><td>${esc(item.serviceType||'Servicio')}</td><td>${esc(attentionResponsible(item))}</td><td><span class="service-status ${item.status==='Cancelada'?'service-status--inactive':''}">${esc(displayAttentionStatus(item.status))}</span></td><td><span class="action-links"><button class="btn-action" data-log-action="view" data-id="${item.id}" title="Ver">👁</button>${canManageClinical()?`<a class="btn-action" href="medical-records.html?patientId=${item.patientId}" title="Abrir Historia Clínica">▣</a>`:''}<button class="btn-action" data-log-action="print" data-id="${item.id}" title="Imprimir">⎙</button>${canManageClinical()?`<a class="btn-action" href="appointments.html?consultationId=${item.id}" title="Editar">✎</a>`:''}</span></td></tr>`).join('');
}
function openServiceDetail(item){const target=document.getElementById('serviceDetailContent');target.innerHTML=`<div><span>Fecha y hora</span><strong>${formatDate(item.date)} · ${esc(item.time||'—')}</strong></div><div><span>Estado</span><strong>${esc(displayAttentionStatus(item.status))}</strong></div><div><span>Paciente</span><strong>${esc(item.patientName||'—')}</strong></div><div><span>Servicio</span><strong>${esc(item.serviceType||'—')}</strong></div><div><span>Responsable</span><strong>${esc(attentionResponsible(item))}</strong></div><div><span>Registrado por</span><strong>${esc(item.registeredBy||'—')}</strong></div><div class="full"><span>Observaciones</span><p>${esc(item.observations||item.chiefComplaint||'Sin observaciones')}</p></div>`;document.getElementById('serviceDetailModal').classList.add('nursing-modal--active')}
function closeServiceDetail(){document.getElementById('serviceDetailModal').classList.remove('nursing-modal--active')}
function printServiceLog(item){const popup=window.open('','_blank','width=800,height=650');if(!popup)return alert('Permite ventanas emergentes para imprimir.');popup.document.write(`<!doctype html><html><head><title>Servicio realizado</title><style>body{font-family:Arial;color:#18343b;padding:38px;line-height:1.6}h1{color:#0f4c5c;border-bottom:2px solid #2fb7a6;padding-bottom:12px}.row{padding:9px 0;border-bottom:1px solid #dbe7eb}strong{color:#0f4c5c}</style></head><body><h1>MedSolution · Servicio realizado</h1><div class="row"><strong>Fecha:</strong> ${formatDate(item.date)} · ${esc(item.time||'—')}</div><div class="row"><strong>Paciente:</strong> ${esc(item.patientName||'—')}</div><div class="row"><strong>Servicio:</strong> ${esc(item.serviceType||'—')}</div><div class="row"><strong>Responsable:</strong> ${esc(attentionResponsible(item))}</div><div class="row"><strong>Estado:</strong> ${esc(displayAttentionStatus(item.status))}</div><div class="row"><strong>Observaciones:</strong> ${esc(item.observations||item.chiefComplaint||'—')}</div><script>window.onload=()=>window.print()<\/script></body></html>`);popup.document.close()}
function renderServices(){
  const q=catalogState.search.toLowerCase();const items=catalogState.services.filter(s=>(catalogState.showInactive||s.active!==false)&&(!q||`${s.name} ${s.description||''}`.toLowerCase().includes(q)));
  const body=document.getElementById('servicesTableBody');
  if(!items.length){body.innerHTML='<tr><td colspan="5" class="patients-empty">No hay servicios. Crea el primero desde este panel.</td></tr>';return}
  body.innerHTML=items.map(s=>`<tr><td><strong>${esc(s.name)}</strong><br><small>${esc(s.description||'')}</small></td><td>${money(s.price)}</td><td><small>${esc(behavior(s))}</small></td><td>${badge(s.active)}</td>
  <td><span class="action-links"><button class="btn-action" data-service-action="edit" data-id="${s.id}">✎</button><button class="btn-action ${s.active===false?'':'btn-action--delete'}" data-service-action="toggle" data-id="${s.id}">${s.active===false?'✓':'✕'}</button></span></td></tr>`).join('');
}
function renderStaff(){
  const body=document.getElementById('staffTableBody');if(!catalogState.staff.length){body.innerHTML='<tr><td colspan="4" class="patients-empty">No hay personal registrado.</td></tr>';return}
  body.innerHTML=catalogState.staff.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.position||'')}</td><td>${badge(p.active)}</td><td><span class="action-links">
    <button class="btn-action" data-staff-action="edit" data-id="${p.id}">✎</button><button class="btn-action ${p.active===false?'':'btn-action--delete'}" data-staff-action="toggle" data-id="${p.id}">${p.active===false?'✓':'✕'}</button></span></td></tr>`).join('');
}
function setCatalogSaving(form,saving,text='Guardando…'){
  catalogSaving=saving;const button=form.querySelector('[type="submit"]');
  form.querySelectorAll('button,input,select,textarea').forEach(control=>{if(saving){control.dataset.wasDisabled=String(control.disabled);control.disabled=true}else{control.disabled=control.dataset.wasDisabled==='true';delete control.dataset.wasDisabled}});
  if(saving){button.dataset.originalText=button.textContent;button.textContent=`⏳ ${text}`;button.setAttribute('aria-busy','true')}else{button.textContent=button.dataset.originalText||'Guardar';button.removeAttribute('aria-busy');delete button.dataset.originalText}
}
function catalogToast(message,type='success'){let toast=document.getElementById('catalogToast');if(!toast){toast=document.createElement('div');toast.id='catalogToast';toast.setAttribute('role','status');Object.assign(toast.style,{position:'fixed',right:'24px',bottom:'24px',zIndex:'3000',padding:'14px 18px',borderRadius:'12px',boxShadow:'0 12px 30px rgba(15,76,92,.2)',fontWeight:'700'});document.body.appendChild(toast)}toast.textContent=message;toast.style.background=type==='error'?'#fde2e2':'#dff7f1';toast.style.color=type==='error'?'#9b2c2c':'#0f5f55';toast.style.display='';clearTimeout(catalogToast.timeout);catalogToast.timeout=setTimeout(()=>{toast.style.display='none'},4000)}
function openService(item=null){
  const f=document.getElementById('serviceForm');f.reset();catalogState.editingServiceId=item?.id||null;document.getElementById('serviceModalTitle').textContent=item?'Editar servicio':'Nuevo servicio';
  if(item){['name','price','description','allowed_responsible'].forEach(k=>f.elements[k].value=item[k]??'');f.elements.requires_medical_consultation.checked=!!item.requires_medical_consultation;f.elements.generates_medical_record.checked=!!item.generates_medical_record}
  document.getElementById('serviceFormError').style.display='none';document.getElementById('serviceModal').classList.add('nursing-modal--active')
}
function closeService(){document.getElementById('serviceModal').classList.remove('nursing-modal--active');catalogState.editingServiceId=null}
async function saveService(e){e.preventDefault();if(catalogSaving)return;const f=e.currentTarget;const old=catalogState.services.find(s=>String(s.id)===String(catalogState.editingServiceId));const value={...(old||{}),name:f.elements.name.value.trim(),price:Number(f.elements.price.value),description:f.elements.description.value.trim(),requires_medical_consultation:f.elements.requires_medical_consultation.checked,generates_medical_record:f.elements.generates_medical_record.checked,allowed_responsible:f.elements.allowed_responsible.value,active:old?.active??true};
  if(!value.name||value.price<0)return show('serviceFormError','Nombre y precio son obligatorios.');setCatalogSaving(f,true);try{await data().saveService(value);closeService();await loadAll();catalogToast('Servicio guardado correctamente.')}catch(error){show('serviceFormError',error.message);catalogToast(`Error: ${error.message}`,'error')}finally{setCatalogSaving(f,false)}
}
function openStaff(item=null){const f=document.getElementById('staffForm');f.reset();catalogState.editingStaffId=item?.id||null;document.getElementById('staffModalTitle').textContent=item?'Editar integrante':'Nuevo integrante';if(item){f.elements.name.value=item.name||'';f.elements.position.value=item.position||''}document.getElementById('staffFormError').style.display='none';document.getElementById('staffModal').classList.add('nursing-modal--active')}
function closeStaff(){document.getElementById('staffModal').classList.remove('nursing-modal--active');catalogState.editingStaffId=null}
async function saveStaff(e){e.preventDefault();if(catalogSaving)return;const f=e.currentTarget;const old=catalogState.staff.find(p=>String(p.id)===String(catalogState.editingStaffId));const value={...(old||{}),name:f.elements.name.value.trim(),position:f.elements.position.value.trim(),active:old?.active??true};if(!value.name||!value.position)return show('staffFormError','Nombre completo y cargo son obligatorios.');setCatalogSaving(f,true);try{await data().saveStaff(value);closeStaff();await loadAll();catalogToast('Personal guardado correctamente.')}catch(error){show('staffFormError',error.message);catalogToast(`Error: ${error.message}`,'error')}finally{setCatalogSaving(f,false)}}
function show(id,message){const e=document.getElementById(id);e.textContent=message;e.style.display=''}
async function setup(){
  await data().ready;
  loadAll();data().subscribeServices(loadAll);data().subscribeStaff(loadAll);
  document.getElementById('newServiceBtn').onclick=()=>openService();document.getElementById('closeServiceModalBtn').onclick=closeService;document.getElementById('cancelServiceModalBtn').onclick=closeService;document.getElementById('serviceForm').onsubmit=saveService;
  document.getElementById('newStaffBtn').onclick=()=>openStaff();document.getElementById('closeStaffModalBtn').onclick=closeStaff;document.getElementById('cancelStaffModalBtn').onclick=closeStaff;document.getElementById('staffForm').onsubmit=saveStaff;
  document.getElementById('serviceSearch').oninput=e=>{catalogState.search=e.target.value;renderServices()};document.getElementById('showInactive').onchange=e=>{catalogState.showInactive=e.target.checked;renderServices()};
  ['serviceLogFrom','serviceLogTo','serviceLogService','serviceLogResponsible','serviceLogStatus','serviceLogPatient'].forEach(id=>document.getElementById(id).addEventListener(id==='serviceLogPatient'?'input':'change',event=>{const key={serviceLogFrom:'from',serviceLogTo:'to',serviceLogService:'service',serviceLogResponsible:'responsible',serviceLogStatus:'status',serviceLogPatient:'patient'}[id];catalogState.logFilters[key]=event.target.value;renderServiceLog()}));
  document.getElementById('serviceLogPeriod').onchange=event=>{catalogState.logFilters.period=event.target.value;const custom=event.target.value==='range';document.getElementById('serviceLogFrom').disabled=!custom;document.getElementById('serviceLogTo').disabled=!custom;renderServiceLog()};
  document.getElementById('serviceLogBody').onclick=event=>{const button=event.target.closest('[data-log-action]');if(!button)return;const item=catalogState.attentions.find(entry=>Number(entry.id)===Number(button.dataset.id));if(!item)return;if(button.dataset.logAction==='view')openServiceDetail(item);else printServiceLog(item)};
  document.getElementById('closeServiceDetailBtn').onclick=closeServiceDetail;document.getElementById('closeServiceDetailAction').onclick=closeServiceDetail;document.querySelector('#serviceDetailModal .nursing-modal__overlay').onclick=closeServiceDetail;
  document.getElementById('servicesTableBody').onclick=async e=>{const b=e.target.closest('[data-service-action]');if(!b)return;const item=catalogState.services.find(s=>String(s.id)===String(b.dataset.id));if(b.dataset.serviceAction==='edit')openService(item);else{await data().toggleService(b.dataset.id,item.active===false);await loadAll()}};
  document.getElementById('staffTableBody').onclick=async e=>{const b=e.target.closest('[data-staff-action]');if(!b)return;const item=catalogState.staff.find(p=>String(p.id)===String(b.dataset.id));if(b.dataset.staffAction==='edit')openStaff(item);else{await data().toggleStaff(b.dataset.id,item.active===false);await loadAll()}};
  data().subscribeAttentions(loadAll);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
else setup();
