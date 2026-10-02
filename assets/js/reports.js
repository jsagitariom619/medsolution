const reportState={items:[],attentions:[],specializedHistories:[],specializedPayments:[],medicalRecords:[],patients:[],services:[],staff:[],renderTimer:null,realtimeTimers:new Map()};
const movementState={rows:[]};
function esc(v){const e=document.createElement('div');e.textContent=v==null?'':String(v);return e.innerHTML}
function unique(field){return [...new Set(reportState.items.map(i=>i[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)))}
function fillSelect(id,values){const e=document.getElementById(id),current=e.value;e.innerHTML='<option value="">Todos</option>'+values.map(v=>`<option>${esc(v)}</option>`).join('');e.value=current}
function fillValueSelect(id,values,defaultLabel){const e=document.getElementById(id),current=e.value;e.innerHTML=`<option value="">${esc(defaultLabel)}</option>`+values.map(item=>`<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('');e.value=current}
function emitReportDate(){return new Intl.DateTimeFormat('es-BO',{dateStyle:'long',timeStyle:'short',timeZone:'America/La_Paz'}).format(new Date())}
function renderAppliedFilters(id,items){document.getElementById(id).innerHTML=items.map(([label,value])=>`<div class="document-filters__item"><small>${esc(label)}</small><strong>${esc(value||'Todos')}</strong></div>`).join('')}
function switchReportView(view){const isMovements=view==='movements';document.getElementById('attentionReportView').hidden=isMovements;document.getElementById('movementReportView').hidden=!isMovements;document.getElementById('tabAttentions').setAttribute('aria-selected',String(!isMovements));document.getElementById('tabMovements').setAttribute('aria-selected',String(isMovements));document.querySelector('.report-module-title h1').textContent=isMovements?'Movimientos de pacientes':'Reportes de Atenciones';document.querySelector('.report-module-title p').textContent=isMovements?'Consulta los servicios registrados por paciente.':'Consulta la actividad y los ingresos históricos del consultorio.'}
function movementFilters(){return {year:document.getElementById('movementYearFilter').value,from:document.getElementById('movementDateFrom').value,to:document.getElementById('movementDateTo').value,patientId:document.getElementById('movementPatientFilter').value,service:document.getElementById('movementServiceFilter').value,responsible:document.getElementById('movementResponsibleFilter').value,status:document.getElementById('movementStatusFilter').value}}
function fillMovementSelect(id,values,defaultLabel='Todos'){const select=document.getElementById(id),current=select.value;select.innerHTML=`<option value="">${esc(defaultLabel)}</option>`+values.map(item=>`<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('');select.value=current}
function movementPeriodLabel(filters){const from=filters.from?formatReportDate(filters.from):'',to=filters.to?formatReportDate(filters.to):'';if(from&&to)return `${from} – ${to}`;if(from)return `Desde ${from}`;if(to)return `Hasta ${to}`;return 'Todos los períodos'}
function formatReportDate(value){const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?`${match[3]}/${match[2]}/${match[1]}`:value}
function movementOptions(){
  const year=document.getElementById('movementYearFilter').value;
  const patients=new Map(reportState.patients.map(item=>[String(item.id),`${item.nombre||''} ${item.apellido||''}`.trim()]).filter(([id,name])=>id&&name)),services=new Set(reportState.services.map(item=>item.name).filter(Boolean)),responsibles=new Set(reportState.staff.map(item=>item.name).filter(Boolean)),statuses=new Set();
  movementState.rows.forEach(row=>{if(row.patientId&&!patients.has(row.patientId))patients.set(row.patientId,row.patientName||`Paciente ${row.patientId}`);if(row.service)services.add(row.service);if(row.responsible)responsibles.add(row.responsible);if(row.status)statuses.add(row.status)});
  fillMovementSelect('movementYearFilter',[...new Set(movementState.rows.map(row=>String(row.date||'').slice(0,4)).filter(value=>/^\d{4}$/.test(value)))].sort((a,b)=>b.localeCompare(a)).map(value=>({value,label:value})),'Todos los años');
  document.getElementById('movementYearFilter').value=year;
  fillMovementSelect('movementPatientFilter',[...patients].map(([value,label])=>({value,label})).sort((a,b)=>a.label.localeCompare(b.label,'es')),'Todos los pacientes');
  fillMovementSelect('movementServiceFilter',[...services].sort((a,b)=>a.localeCompare(b,'es')).map(value=>({value,label:value})),'Todos los servicios');
  fillMovementSelect('movementResponsibleFilter',[...responsibles].sort((a,b)=>a.localeCompare(b,'es')).map(value=>({value,label:value})),'Todos');
  fillMovementSelect('movementStatusFilter',[...statuses].sort((a,b)=>a.localeCompare(b,'es')).map(value=>({value,label:value})),'Todos');
}
function renderMovementReport(){
  if(!window.MedSolutionPatientMovements)return;
  const filters=movementFilters(),sourceRows=movementState.rows.filter(row=>!filters.year||String(row.date).slice(0,4)===filters.year),rows=window.MedSolutionPatientMovements.filterRows(sourceRows,filters).sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)),summary=window.MedSolutionPatientMovements.summarize(rows),patientId=filters.patientId;
  document.getElementById('movementCount').textContent=summary.movements;
  document.getElementById('movementPatientCount').textContent=summary.patients;
  document.getElementById('movementServiceCount').textContent=summary.completedServices;
  document.getElementById('movementCostTotal').textContent=window.MedSolutionPatientMovements.formatMoney(summary.totalCents);
  document.getElementById('movementReportTotal').textContent=`${patientId?'TOTAL DEL PACIENTE':'TOTAL DEL PERÍODO'}: ${window.MedSolutionPatientMovements.formatMoney(summary.totalCents)}`;

  const selectedPatient=patientId?sourceRows.find(row=>row.patientId===patientId):null,patientSummary=document.getElementById('movementPatientSummary'),selectedPatientName=selectedPatient?.patientName||document.getElementById('movementPatientFilter').selectedOptions[0]?.textContent||'';
  if(patientId){patientSummary.hidden=false;patientSummary.innerHTML=`<h3>Estado de movimientos del paciente</h3><p><strong>Paciente:</strong> ${esc(selectedPatientName||'—')}</p><p><strong>Período:</strong> ${esc(movementPeriodLabel(filters))}</p><p><strong>Movimientos:</strong> ${summary.movements} · <strong>Servicios realizados:</strong> ${summary.completedServices} · <strong>Costo total:</strong> ${window.MedSolutionPatientMovements.formatMoney(summary.totalCents)}</p>`}else{patientSummary.hidden=true;patientSummary.replaceChildren()}

  const individual=Boolean(patientId),head=document.getElementById('movementTableHead'),body=document.getElementById('movementTableBody');
  head.innerHTML=`<tr><th>N.º</th><th>Fecha / hora</th>${individual?'':'<th>Paciente</th>'}<th>Servicio</th><th>Responsable</th><th>Estado</th><th class="amount">Costo (Bs)</th></tr>`;
  if(!rows.length){body.innerHTML=`<tr><td colspan="${individual?6:7}" class="report-document__empty">No hay movimientos para los filtros seleccionados.</td></tr>`}else{body.innerHTML=rows.map((row,index)=>`<tr><td>${index+1}</td><td><strong>${esc(formatReportDate(row.date)||'—')}</strong>${row.time?`<br><small>${esc(row.time)}</small>`:''}</td>${individual?'':`<td>${esc(row.patientName||'—')}</td>`}<td>${esc(row.service||'—')}</td><td>${esc(row.responsible||'—')}</td><td>${esc(row.status||'—')}</td><td class="amount">${window.MedSolutionPatientMovements.isCompleted(row.status)?window.MedSolutionPatientMovements.formatMoney(row.costCents):'No suma'}</td></tr>`).join('')}

  document.getElementById('movementIssuedAt').textContent=emitReportDate();
  renderAppliedFilters('movementAppliedFilters',[["Año",filters.year||'Todos los años'],["Período",movementPeriodLabel(filters)],["Paciente",patientId?selectedPatientName:'Todos los pacientes'],["Servicio",filters.service||'Todos los servicios'],["Responsable",filters.responsible||'Todos'],["Estado",filters.status||'Todos']]);
  document.getElementById('movementReportStatus').textContent=`${rows.length} movimiento${rows.length===1?'':'s'} · Período: ${movementPeriodLabel(filters)}`;
}
function setMovementRange(range){
  const today=window.MedSolutionDate?.today?.()||new Date().toISOString().slice(0,10),[year,month]=today.split('-').map(Number),firstOfMonth=`${year}-${String(month).padStart(2,'0')}-01`,date=(y,m,d)=>new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10),from=document.getElementById('movementDateFrom'),to=document.getElementById('movementDateTo');
  if(range==='2026-september'){document.getElementById('movementYearFilter').value='2026';from.value='2026-01-01';to.value='2026-09-30';movementOptions();renderMovementReport();return}
  document.getElementById('movementYearFilter').value='';if(range==='today'){from.value=today;to.value=today}else if(range==='this-month'){from.value=firstOfMonth;to.value=today}else if(range==='last-month'){const previous=date(year,month-1,1),[py,pm]=previous.split('-').map(Number);from.value=previous;to.value=date(py,pm,new Date(Date.UTC(py,pm,0)).getUTCDate())}else if(range==='this-year'){from.value=`${year}-01-01`;to.value=today}movementOptions();renderMovementReport();
}
function printCurrentReport(){const isMovements=!document.getElementById('movementReportView').hidden,printClass=isMovements?'print-movements':'print-attentions';document.body.classList.add(printClass);const clean=()=>document.body.classList.remove(printClass);window.addEventListener('afterprint',clean,{once:true});try{window.print()}catch(error){clean();throw error}}
function updateAttentionFilterOptions(){
  const items=reportState.items,services=[...new Set(items.map(item=>item.serviceType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),responsibles=[...new Set(items.map(item=>item.procedureResponsible||item.scheduledProfessional).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  fillSelect('serviceFilter',services);fillSelect('responsibleFilter',responsibles);
  const patients=new Map(items.map(item=>[String(item.patientId||item.patientName||''),String(item.patientName||'').trim()]).filter(([value,label])=>value&&label)),statuses=[...new Set(items.map(item=>String(item.status||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  fillValueSelect('attentionPatientFilter',[...patients].map(([value,label])=>({value,label})).sort((a,b)=>a.label.localeCompare(b.label,'es')),'Todos los pacientes');fillSelect('attentionStatusFilter',statuses);
  const month=document.getElementById('monthFilter'),selectedMonth=month.value,months=[...new Set(items.map(item=>String(item.date||'').slice(5,7)).filter(value=>/^\d{2}$/.test(value)))].sort();
  month.innerHTML='<option value="">Todos</option><option value="01-09">Enero–septiembre</option>'+months.map(value=>`<option value="${value}">${new Intl.DateTimeFormat('es-BO',{month:'long'}).format(new Date(2024,Number(value)-1,1))}</option>`).join('');month.value=[...month.options].some(option=>option.value===selectedMonth)?selectedMonth:'';
  const yearSelect=document.getElementById('yearFilter'),selectedYear=yearSelect.value,productionYears=[...new Set(reportState.items.map(item=>String(item.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  yearSelect.innerHTML='<option value="">Todos los años</option>'+productionYears.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
  yearSelect.value=[...yearSelect.options].some(option=>option.value===selectedYear)?selectedYear:'';
}
function filtered(){
  const patient=document.getElementById('attentionPatientFilter').value,service=document.getElementById('serviceFilter').value,responsible=document.getElementById('responsibleFilter').value,month=document.getElementById('monthFilter').value,year=document.getElementById('yearFilter').value,status=document.getElementById('attentionStatusFilter').value;
  return reportState.items.filter(item=>(!patient||String(item.patientId||item.patientName||'')===patient)&&(!service||item.serviceType===service)&&(!responsible||(item.procedureResponsible||item.scheduledProfessional)===responsible)&&(!month||(month==='01-09'?Number(String(item.date||'').slice(5,7))>=1&&Number(String(item.date||'').slice(5,7))<=9:String(item.date||'').slice(5,7)===month))&&(!year||String(item.date||'').slice(0,4)===year)&&(!status||item.status===status));
}
function render(){
  const items=filtered(),total=items.reduce((sum,i)=>sum+Number(i.servicePrice||0),0),attentionCount=items.filter(item=>!item.specializedPayment).length,revenueRows=items.filter(item=>Number(item.servicePrice||0)>0).length;document.getElementById('totalAttentions').textContent=attentionCount;document.getElementById('totalRevenue').textContent=`${total.toFixed(2)} Bs`;document.getElementById('averageTicket').textContent=`${(revenueRows?total/revenueRows:0).toFixed(2)} Bs`;
  const body=document.getElementById('reportTableBody');body.innerHTML=items.length?items.map((i,index)=>`<tr><td>${index+1}</td><td><strong>${esc(i.date||'—')}</strong><br><small>${esc(i.time||'')}</small></td><td>${esc(i.patientName)}</td><td>${esc(i.serviceType)}</td><td>${esc(i.procedureResponsible||'—')}</td><td>${esc(i.registeredBy||'—')}</td><td>${esc(i.status)}</td><td class="amount"><strong>${Number(i.servicePrice||0).toFixed(2)}</strong></td></tr>`).join(''):'<tr><td colspan="8" class="report-document__empty">No hay atenciones para los filtros seleccionados.</td></tr>';
  document.getElementById('reportIssuedAt').textContent=emitReportDate();
  const year=document.getElementById('yearFilter').value,period=year||'Todos los años',month=document.getElementById('monthFilter').selectedOptions[0]?.textContent||'Todos',title=year&&month==='Enero–septiembre'?`Reporte de Atenciones ${year} · Enero–septiembre`:'Reporte de Atenciones';
  document.getElementById('reportDocumentTitle').textContent=title;
  renderAppliedFilters('reportAppliedFilters',[["Año",period],["Paciente",document.getElementById('attentionPatientFilter').selectedOptions[0]?.textContent],["Servicio",document.getElementById('serviceFilter').selectedOptions[0]?.textContent],["Responsable",document.getElementById('responsibleFilter').selectedOptions[0]?.textContent],["Mes",month],["Estado",document.getElementById('attentionStatusFilter').selectedOptions[0]?.textContent]]);
}
function rebuild(){
  const historyMap=new Map(reportState.specializedHistories.map(item=>[item.id,item])),recordMap=new Map(reportState.medicalRecords.map(item=>[item.id,item])),patientMap=new Map(reportState.patients.map(item=>[Number(item.id),item]));
  const payments=reportState.specializedPayments.map(payment=>{const history=historyMap.get(payment.specializedHistoryId),record=recordMap.get(history?.medicalRecordId),patient=patientMap.get(Number(record?.patientId)),stamp=new Date(payment.paymentDate),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(stamp).map(part=>[part.type,part.value]));return {id:`payment-${payment.id}`,date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,patientName:patient?`${patient.nombre} ${patient.apellido}`.trim():'Paciente',serviceType:history?.templateName||'Tratamiento especializado',servicePrice:payment.amount,procedureResponsible:payment.registeredBy||'—',registeredBy:payment.registeredBy||'—',status:'Pago registrado',specializedPayment:true}});
  reportState.items=[...reportState.attentions.filter(item=>item.contraceptiveSchedule!==true&&item.scheduledOnly!==true),...payments];updateAttentionFilterOptions();movementState.rows=window.MedSolutionPatientMovements.buildRows(reportState.attentions);movementOptions();render();renderMovementReport()
}
function scheduleRebuild(){clearTimeout(reportState.renderTimer);reportState.renderTimer=setTimeout(rebuild,100)}
async function load(){[reportState.attentions,reportState.specializedHistories,reportState.specializedPayments,reportState.medicalRecords,reportState.patients,reportState.services,reportState.staff]=await Promise.all([window.MedSolutionData.getAttentions(),window.MedSolutionData.getSpecializedHistories(),window.MedSolutionData.getSpecializedPayments(),window.MedSolutionData.getMedicalRecords(),window.MedSolutionData.getPatients(),window.MedSolutionData.getServices(true).catch(()=>[]),window.MedSolutionData.getStaff(true).catch(()=>[])]);rebuild()}
async function refreshCollection(name,getter){reportState[name]=await getter();scheduleRebuild()}
function scheduleRefresh(name,getter){clearTimeout(reportState.realtimeTimers.get(name));reportState.realtimeTimers.set(name,setTimeout(()=>{reportState.realtimeTimers.delete(name);refreshCollection(name,getter).catch(error=>console.error(`[Reportes] No se pudo actualizar ${name}:`,error))},100))}
async function setup(){
  await window.MedSolutionData.ready;
  load().catch(error=>{document.getElementById('movementReportStatus').textContent=`No se pudieron cargar los movimientos: ${error.message}`;alert(error.message)});
  ['attentionPatientFilter','serviceFilter','responsibleFilter','monthFilter','attentionStatusFilter'].forEach(id=>document.getElementById(id).addEventListener('change',render));
  document.getElementById('yearFilter').addEventListener('change',()=>{updateAttentionFilterOptions();render()});
  document.getElementById('printReportBtn').addEventListener('click',printCurrentReport);
  document.querySelectorAll('[data-report-view]').forEach(button=>button.addEventListener('click',()=>switchReportView(button.dataset.reportView)));
  ['movementDateFrom','movementDateTo','movementPatientFilter','movementServiceFilter','movementResponsibleFilter','movementStatusFilter'].forEach(id=>document.getElementById(id).addEventListener('input',renderMovementReport));
  ['movementPatientFilter','movementServiceFilter','movementResponsibleFilter','movementStatusFilter'].forEach(id=>document.getElementById(id).addEventListener('change',renderMovementReport));
  document.getElementById('movementYearFilter').addEventListener('change',()=>{document.getElementById('movementDateFrom').value='';document.getElementById('movementDateTo').value='';renderMovementReport()});
  document.querySelectorAll('[data-movement-range]').forEach(button=>button.addEventListener('click',()=>setMovementRange(button.dataset.movementRange)));
  document.querySelector('[data-clear-movement-filters]').addEventListener('click',()=>{['movementYearFilter','movementDateFrom','movementDateTo','movementPatientFilter','movementServiceFilter','movementResponsibleFilter','movementStatusFilter'].forEach(id=>document.getElementById(id).value='');movementOptions();renderMovementReport()});
  window.MedSolutionData.subscribeAttentions(()=>scheduleRefresh('attentions',window.MedSolutionData.getAttentions));
  window.MedSolutionData.subscribeSpecializedPayments(()=>scheduleRefresh('specializedPayments',window.MedSolutionData.getSpecializedPayments));
  window.MedSolutionData.subscribeSpecializedHistories(()=>scheduleRefresh('specializedHistories',window.MedSolutionData.getSpecializedHistories));
  window.MedSolutionData.subscribeServices(()=>scheduleRefresh('services',()=>window.MedSolutionData.getServices(true)));
  window.MedSolutionData.subscribeStaff(()=>scheduleRefresh('staff',()=>window.MedSolutionData.getStaff(true)));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
else setup();
