const catalogState={services:[],staff:[],editingServiceId:null,editingStaffId:null,search:'',showInactive:false};
const data=()=>window.MedSolutionData;
function esc(v){const e=document.createElement('div');e.textContent=v==null?'':String(v);return e.innerHTML}
function money(v){return `${Number(v||0).toFixed(2)} Bs`}
function badge(active){return `<span class="service-status ${active===false?'service-status--inactive':''}">${active===false?'Inactivo':'Activo'}</span>`}
function behavior(s){return [s.requires_medical_consultation?'Requiere consulta':'Sin consulta',s.generates_medical_record?'Genera historia':'Sin historia',`Responsable: ${s.allowed_responsible}`].join(' · ')}
async function loadAll(){
  try{
    [catalogState.services,catalogState.staff]=await Promise.all([data().getServices(true),data().getAllStaff()]);
    renderServices();renderStaff();
    const sync=document.getElementById('serviceSync');sync.textContent=data().isConfigured()?'Sincronizado en tiempo real':'Sin conexión a Supabase';
    sync.classList.toggle('sync-indicator--online',data().isConfigured());
  }catch(error){alert(error.message)}
}
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
function openService(item=null){
  const f=document.getElementById('serviceForm');f.reset();catalogState.editingServiceId=item?.id||null;document.getElementById('serviceModalTitle').textContent=item?'Editar servicio':'Nuevo servicio';
  if(item){['name','price','description','allowed_responsible'].forEach(k=>f.elements[k].value=item[k]??'');f.elements.requires_medical_consultation.checked=!!item.requires_medical_consultation;f.elements.generates_medical_record.checked=!!item.generates_medical_record}
  document.getElementById('serviceFormError').style.display='none';document.getElementById('serviceModal').classList.add('nursing-modal--active')
}
function closeService(){document.getElementById('serviceModal').classList.remove('nursing-modal--active');catalogState.editingServiceId=null}
async function saveService(e){e.preventDefault();const f=e.currentTarget;const old=catalogState.services.find(s=>String(s.id)===String(catalogState.editingServiceId));const value={...(old||{}),name:f.elements.name.value.trim(),price:Number(f.elements.price.value),description:f.elements.description.value.trim(),requires_medical_consultation:f.elements.requires_medical_consultation.checked,generates_medical_record:f.elements.generates_medical_record.checked,allowed_responsible:f.elements.allowed_responsible.value,active:old?.active??true};
  if(!value.name||value.price<0)return show('serviceFormError','Nombre y precio son obligatorios.');try{await data().saveService(value);closeService();await loadAll()}catch(error){show('serviceFormError',error.message)}
}
function openStaff(item=null){const f=document.getElementById('staffForm');f.reset();catalogState.editingStaffId=item?.id||null;document.getElementById('staffModalTitle').textContent=item?'Editar integrante':'Nuevo integrante';if(item){f.elements.name.value=item.name||'';f.elements.position.value=item.position||''}document.getElementById('staffFormError').style.display='none';document.getElementById('staffModal').classList.add('nursing-modal--active')}
function closeStaff(){document.getElementById('staffModal').classList.remove('nursing-modal--active');catalogState.editingStaffId=null}
async function saveStaff(e){e.preventDefault();const f=e.currentTarget;const old=catalogState.staff.find(p=>String(p.id)===String(catalogState.editingStaffId));const value={...(old||{}),name:f.elements.name.value.trim(),position:f.elements.position.value.trim(),active:old?.active??true};if(!value.name||!value.position)return show('staffFormError','Nombre completo y cargo son obligatorios.');try{await data().saveStaff(value);closeStaff();await loadAll()}catch(error){show('staffFormError',error.message)}}
function show(id,message){const e=document.getElementById(id);e.textContent=message;e.style.display=''}
function setup(){
  loadAll();data().subscribeServices(loadAll);data().subscribeStaff(loadAll);
  document.getElementById('newServiceBtn').onclick=()=>openService();document.getElementById('closeServiceModalBtn').onclick=closeService;document.getElementById('cancelServiceModalBtn').onclick=closeService;document.getElementById('serviceForm').onsubmit=saveService;
  document.getElementById('newStaffBtn').onclick=()=>openStaff();document.getElementById('closeStaffModalBtn').onclick=closeStaff;document.getElementById('cancelStaffModalBtn').onclick=closeStaff;document.getElementById('staffForm').onsubmit=saveStaff;
  document.getElementById('serviceSearch').oninput=e=>{catalogState.search=e.target.value;renderServices()};document.getElementById('showInactive').onchange=e=>{catalogState.showInactive=e.target.checked;renderServices()};
  document.getElementById('servicesTableBody').onclick=async e=>{const b=e.target.closest('[data-service-action]');if(!b)return;const item=catalogState.services.find(s=>String(s.id)===String(b.dataset.id));if(b.dataset.serviceAction==='edit')openService(item);else{await data().toggleService(b.dataset.id,item.active===false);await loadAll()}};
  document.getElementById('staffTableBody').onclick=async e=>{const b=e.target.closest('[data-staff-action]');if(!b)return;const item=catalogState.staff.find(p=>String(p.id)===String(b.dataset.id));if(b.dataset.staffAction==='edit')openStaff(item);else{await data().toggleStaff(b.dataset.id,item.active===false);await loadAll()}};
}
document.addEventListener('DOMContentLoaded',setup);
