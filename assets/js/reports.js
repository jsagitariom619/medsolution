const reportState={items:[]};
function esc(v){const e=document.createElement('div');e.textContent=v==null?'':String(v);return e.innerHTML}
function unique(field){return [...new Set(reportState.items.map(i=>i[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)))}
function fillSelect(id,values){const e=document.getElementById(id),current=e.value;e.innerHTML='<option value="">Todos</option>'+values.map(v=>`<option>${esc(v)}</option>`).join('');e.value=current}
function range(){
  const ref=new Date(`${document.getElementById('referenceDate').value}T12:00:00`),period=document.getElementById('periodFilter').value;
  const start=new Date(ref),end=new Date(ref);
  if(period==='week'){const offset=(ref.getDay()+6)%7;start.setDate(ref.getDate()-offset);end.setDate(start.getDate()+6)}
  if(period==='month'){start.setDate(1);end.setMonth(start.getMonth()+1,0)}
  return [start.toISOString().slice(0,10),end.toISOString().slice(0,10)]
}
function filtered(){
  const [start,end]=range(),service=document.getElementById('serviceFilter').value,responsible=document.getElementById('responsibleFilter').value,user=document.getElementById('userFilter').value;
  return reportState.items.filter(i=>i.date>=start&&i.date<=end&&(!service||i.serviceType===service)&&(!responsible||i.procedureResponsible===responsible)&&(!user||i.registeredBy===user));
}
function render(){
  const items=filtered(),total=items.reduce((sum,i)=>sum+Number(i.servicePrice||0),0);document.getElementById('totalAttentions').textContent=items.length;document.getElementById('totalRevenue').textContent=`${total.toFixed(2)} Bs`;document.getElementById('averageTicket').textContent=`${(items.length?total/items.length:0).toFixed(2)} Bs`;
  const body=document.getElementById('reportTableBody');body.innerHTML=items.length?items.map(i=>`<tr><td><strong>${esc(i.date||'—')}</strong><br><small>${esc(i.time||'')}</small></td><td>${esc(i.patientName)}</td><td>${esc(i.serviceType)}</td><td><strong>${Number(i.servicePrice||0).toFixed(2)} Bs</strong></td><td>${esc(i.procedureResponsible||'—')}</td><td>${esc(i.registeredBy||'—')}</td><td>${esc(i.status)}</td></tr>`).join(''):'<tr><td colspan="7" class="patients-empty">No hay atenciones para los filtros seleccionados.</td></tr>';
}
async function load(){reportState.items=(await window.MedSolutionData.getAttentions()).filter(item=>item.contraceptiveSchedule!==true);fillSelect('serviceFilter',unique('serviceType'));fillSelect('responsibleFilter',unique('procedureResponsible'));fillSelect('userFilter',unique('registeredBy'));render()}
async function setup(){await window.MedSolutionData.ready;document.getElementById('referenceDate').value=new Date().toISOString().slice(0,10);load().catch(e=>alert(e.message));['periodFilter','referenceDate','serviceFilter','responsibleFilter','userFilter'].forEach(id=>document.getElementById(id).addEventListener('change',render));document.getElementById('printReportBtn').onclick=()=>window.print();window.MedSolutionData.subscribeAttentions(()=>load())}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
else setup();
