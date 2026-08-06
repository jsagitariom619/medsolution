// Pasarela única de MedSolution hacia Registro Clínico.
// Las credenciales públicas se obtienen desde /api/config en Vercel.
(function initSupabaseGateway(global) {
  'use strict';

  let client = null;
  let config = null;
  let bootError = null;
  const CONFIG_TIMEOUT_MS = 10000;

  const ready = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
    try {
      const response = await fetch('/api/config', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Supabase no está configurado.');
      config = await response.json();
      if (!global.supabase?.createClient) throw new Error('No se cargó el cliente oficial de Supabase.');
      client = global.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      return client;
    } catch (error) {
      bootError = error?.name === 'AbortError'
        ? new Error('La configuración de Supabase no respondió en 10 segundos. Verifica /api/config y las variables de entorno.')
        : error;
      console.error('[Supabase] No se pudo inicializar el cliente:', bootError);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  const localArray = (key) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const throwIfError = (error) => {
    if (error) {
      const details = [error.message, error.details, error.hint]
        .filter(Boolean).join(' · ');
      const databaseError = new Error(details || `Error de Supabase${error.code ? ` (${error.code})` : ''}.`);
      databaseError.code = error.code || '';
      throw databaseError;
    }
  };
  const db = async (required = false) => {
    await ready;
    if (required && !client) throw bootError || new Error('Supabase no está configurado.');
    return client;
  };
  const uuidOrNull = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : null;

  function mapService(row) {
    return {
      id: row.id, name: row.nombre, price: Number(row.precio || 0), description: row.descripcion || '',
      active: row.activo, requires_medical_consultation: row.requiere_consulta_medica,
      generates_medical_record: row.genera_historia_clinica,
      allowed_responsible: row.responsable_autorizado,
    };
  }
  function servicePayload(item) {
    return {
      ...(item.id ? { id: item.id } : {}), nombre: item.name, precio: Number(item.price || 0),
      descripcion: item.description || '', activo: item.active !== false,
      requiere_consulta_medica: Boolean(item.requires_medical_consultation),
      genera_historia_clinica: Boolean(item.generates_medical_record),
      responsable_autorizado: item.allowed_responsible || 'Ambos',
    };
  }
  function mapStaff(row) {
    return { id: row.id, name: row.nombre_completo, position: row.cargo, active: row.activo };
  }
  function mapSystemUser(row) {
    const names = String(row.nombre_completo || '').trim().split(/\s+/);
    return {
      id: row.id, username: row.usuario, passwordHash: row.password_hash,
      name: row.nombre_completo, role: row.rol, position: row.cargo_profesional || '',
      photoPath: row.fotografia_path || '', active: row.activo !== false,
      initials: names.slice(0, 2).map((part) => part[0] || '').join('').toUpperCase(),
    };
  }
  function mapPatient(row) {
    return {
      id: Number(row.legacy_id), remoteId: row.id, nombre: row.nombre, apellido: row.apellido || '',
      ci: row.ci || '', fechaNacimiento: row.fecha_nacimiento || '', genero: row.genero || '',
      telefono: row.telefono || '', email: row.email || '', direccion: row.direccion || '',
      registrado: row.registrado_en,
    };
  }
  function mapAttention(row) {
    const arrival = new Date(row.fecha_hora);
    const arrivalParts = localDateTimeParts(row.fecha_hora);
    return {
      ...(row.datos_clinicos || {}), id: Number(row.legacy_id), remoteId: row.id,
      patientId: Number(row.pacientes?.legacy_id), patientName: row.pacientes
        ? `${row.pacientes.nombre} ${row.pacientes.apellido || ''}`.trim() : '',
      serviceId: row.servicio_id, serviceType: row.servicio_nombre_snapshot,
      servicePrice: Number(row.precio_snapshot || 0), procedureResponsible: row.responsable_nombre_snapshot || '',
      registeredByUserId: row.registrado_por, registeredBy: row.registrado_por_nombre_snapshot || '',
      status: row.estado, createdAt: row.fecha_hora,
      date: Number.isNaN(arrival.getTime()) ? '' : arrivalParts.date,
      time: Number.isNaN(arrival.getTime()) ? '' : arrivalParts.time,
      chiefComplaint: row.motivo || '',
      evolution: row.evolucion || '', diagnosis: row.diagnostico || '', treatment: row.tratamiento || '',
      prescription: row.receta || '', indications: row.indicaciones || '', nextControl: row.proximo_control || '',
    };
  }

  function localDateTimeParts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: '', time: '' };
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((part) => [part.type, part.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  }

  async function fetchAllPages(queryFactory, pageSize = 1000) {
    const rows = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await queryFactory().range(from, from + pageSize - 1);
      throwIfError(error);
      const page = data || [];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async function getServices(includeInactive = false) {
    const connection = await db();
    if (!connection) return [];
    const data = await fetchAllPages(() => {
      let query = connection.from('servicios').select('*').order('nombre');
      if (!includeInactive) query = query.eq('activo', true);
      return query;
    });
    return data.map(mapService);
  }
  async function saveService(item) {
    const connection = await db(true);
    const { data, error } = await connection.from('servicios').upsert(servicePayload(item)).select().single();
    throwIfError(error); return mapService(data);
  }
  async function toggleService(id, active) {
    const connection = await db(true);
    const { data, error } = await connection.from('servicios').update({ activo: active }).eq('id', id).select().single();
    throwIfError(error); return mapService(data);
  }
  async function getStaff(includeInactive = false) {
    const connection = await db();
    if (!connection) return [];
    const data = await fetchAllPages(() => {
      let query = connection.from('personal_consultorio').select('*').order('nombre_completo');
      if (!includeInactive) query = query.eq('activo', true);
      return query;
    });
    return data.map(mapStaff);
  }
  async function saveStaff(item) {
    const connection = await db(true);
    const payload = {
      ...(item.id ? { id: item.id } : {}), nombre_completo: item.name,
      cargo: item.position, activo: item.active !== false,
    };
    const { data, error } = await connection.from('personal_consultorio').upsert(payload).select().single();
    throwIfError(error); return mapStaff(data);
  }
  async function toggleStaff(id, active) {
    const connection = await db(true);
    const { data, error } = await connection.from('personal_consultorio').update({ activo: active }).eq('id', id).select().single();
    throwIfError(error); return mapStaff(data);
  }
  async function getSystemUsers() {
    const connection = await db();
    if (!connection) return [];
    const { data, error } = await connection.from('perfiles_sistema').select('*').order('creado_en');
    throwIfError(error);
    const users = (data || []).map(mapSystemUser);
    for (const user of users) {
      if (!user.photoPath) continue;
      const { data: signed } = await connection.storage.from('medsolution-archivos').createSignedUrl(user.photoPath, 3600);
      user.photoUrl = signed?.signedUrl || '';
    }
    return users;
  }
  async function saveSystemUser(user) {
    const connection = await db(true);
    const payload = {
      ...(user.id ? { id: user.id } : {}), rol: user.role, usuario: user.username,
      password_hash: user.passwordHash, nombre_completo: user.name,
      cargo_profesional: user.position || '', fotografia_path: user.photoPath || null,
      activo: user.active !== false,
    };
    const { data, error } = await connection.from('perfiles_sistema').upsert(payload).select().single();
    throwIfError(error); return mapSystemUser(data);
  }
  async function uploadProfilePhoto(role, file) {
    const connection = await db(true);
    const extension = String(file.name || '').split('.').pop().toLowerCase() || 'jpg';
    const path = `perfiles/${String(role).normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}/${crypto.randomUUID()}.${extension}`;
    const { error } = await connection.storage.from('medsolution-archivos').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    throwIfError(error); return path;
  }
  async function deleteStoredFile(path) {
    if (!path) return;
    const connection = await db(true);
    const { error } = await connection.storage.from('medsolution-archivos').remove([path]); throwIfError(error);
  }
  async function uploadClinicalAttachment(attentionRemoteId, file) {
    if (!attentionRemoteId) throw new Error('La evolución debe estar guardada antes de adjuntar archivos.');
    const connection = await db(true);
    const safeName = String(file.name || 'archivo').normalize('NFD').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `evoluciones/${attentionRemoteId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await connection.storage.from('medsolution-archivos').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    throwIfError(error);
    return { id: crypto.randomUUID(), path, name: file.name, type: file.type, size: file.size, uploadedAt: new Date().toISOString() };
  }
  async function signedFileUrl(path, expiresIn = 900) {
    const connection = await db(true);
    const { data, error } = await connection.storage.from('medsolution-archivos').createSignedUrl(path, expiresIn);
    throwIfError(error); return data?.signedUrl || '';
  }
  async function getPatients() {
    const connection = await db();
    if (!connection) return localArray('medsolution.patients');
    const { data, error } = await connection.from('pacientes').select('*').order('nombre');
    throwIfError(error); return (data || []).map(mapPatient);
  }
  async function findPatientByCi(ci) {
    const normalizedCi = String(ci || '').trim();
    if (!normalizedCi) return null;
    const connection = await db();
    if (!connection) {
      return localArray('medsolution.patients')
        .find((patient) => String(patient.ci || '').trim() === normalizedCi) || null;
    }
    const { data, error } = await connection.from('pacientes')
      .select('*').eq('ci', normalizedCi).maybeSingle();
    throwIfError(error);
    return data ? mapPatient(data) : null;
  }
  async function savePatient(patient) {
    const connection = await db(true);
    const payload = {
      nombre: patient.nombre, apellido: patient.apellido || '', ci: patient.ci || null,
      fecha_nacimiento: patient.fechaNacimiento || null, genero: patient.genero || null,
      telefono: patient.telefono || null, email: patient.email || null,
      direccion: patient.direccion || null, registrado_en: patient.registrado || new Date().toISOString().slice(0, 10),
    };
    const mutation = patient.remoteId
      ? connection.from('pacientes').update(payload).eq('id', patient.remoteId)
      : connection.from('pacientes').insert(payload);
    const { data, error } = await mutation.select().single();
    throwIfError(error); return mapPatient(data);
  }
  async function deletePatient(id) {
    const connection = await db(true);
    const { error } = await connection.from('pacientes').delete().eq('legacy_id', Number(id)); throwIfError(error);
  }
  async function resolvePatient(connection, legacyId) {
    const { data, error } = await connection.from('pacientes').select('id').eq('legacy_id', Number(legacyId)).single();
    throwIfError(error); return data.id;
  }
  async function saveAttention(attention) {
    const connection = await db(true);
    const patientId = await resolvePatient(connection, attention.patientId);
    let medicalRecordId = null;
    if (['En Atención', 'Atendida', 'En consulta', 'Finalizada'].includes(attention.status)
      && attention.requiresMedicalConsultation !== false) {
      const { data: record, error: recordError } = await connection.from('historias_clinicas')
        .select('id').eq('paciente_id', patientId).maybeSingle();
      throwIfError(recordError);
      medicalRecordId = record?.id || null;
    }
    const { data: responsible } = attention.procedureResponsible
      ? await connection.from('personal_consultorio').select('id').eq('nombre_completo', attention.procedureResponsible).maybeSingle()
      : { data: null };
    const clinical = { ...attention };
    [
      'id','remoteId','patientId','patientName','serviceId','serviceType','servicePrice','procedureResponsible',
      'registeredByUserId','registeredBy','status','createdAt','chiefComplaint','evolution','diagnosis',
      'treatment','prescription','indications','nextControl',
    ].forEach((key) => delete clinical[key]);
    const payload = {
      paciente_id: patientId, servicio_id: uuidOrNull(attention.serviceId),
      historia_clinica_id: medicalRecordId,
      // La autenticación es local: el responsable queda preservado en el snapshot,
      // sin intentar vincularlo a public.usuarios (tabla reservada para Supabase Auth).
      responsable_id: responsible?.id || null, registrado_por: null,
      fecha_hora: attention.createdAt || new Date().toISOString(), estado: attention.status,
      servicio_nombre_snapshot: attention.serviceType, precio_snapshot: Number(attention.servicePrice || 0),
      responsable_nombre_snapshot: attention.procedureResponsible || null,
      registrado_por_nombre_snapshot: attention.registeredBy || '',
      motivo: attention.chiefComplaint || '', evolucion: attention.evolution || '',
      diagnostico: attention.diagnosis || '', tratamiento: attention.treatment || '',
      receta: attention.prescription || '', indicaciones: attention.indications || '',
      proximo_control: attention.nextControl || null, datos_clinicos: clinical,
    };
    const mutation = attention.remoteId
      ? connection.from('atenciones').update(payload).eq('id', attention.remoteId)
      : connection.from('atenciones').insert(payload);
    const { data, error } = await mutation.select().single();
    throwIfError(error);
    return { ...attention, id: Number(data.legacy_id), remoteId: data.id };
  }
  async function savePatientAndAttention(patient, attention) {
    const connection = await db(true);
    let persistedPatient = await findPatientByCi(patient.ci);
    let createdPatient = false;

    if (!persistedPatient) {
      persistedPatient = await savePatient(patient);
      createdPatient = true;
    }

    const linkedAttention = {
      ...attention,
      patientId: persistedPatient.id,
      patientName: `${persistedPatient.nombre} ${persistedPatient.apellido || ''}`.trim(),
    };

    try {
      if (['En Atención', 'Atendida', 'En consulta', 'Finalizada'].includes(linkedAttention.status)
        && linkedAttention.requiresMedicalConsultation !== false) {
        const { error: recordError } = await connection.rpc(
          'obtener_o_crear_historia',
          { paciente_legacy_id: Number(persistedPatient.id) },
        );
        throwIfError(recordError);
      }
      const persistedAttention = await saveAttention(linkedAttention);
      return {
        patient: persistedPatient,
        attention: persistedAttention,
        linkedAttention: persistedAttention,
        reusedPatient: !createdPatient,
      };
    } catch (attentionError) {
      if (createdPatient) {
        const { error: rollbackError } = await connection.from('pacientes')
          .delete().eq('id', persistedPatient.remoteId);
        if (rollbackError) {
          throw new Error(`${attentionError.message} No se pudo revertir el paciente recién creado: ${rollbackError.message}`);
        }
      }
      throw attentionError;
    }
  }
  async function getAttentions() {
    const connection = await db();
    if (!connection) return localArray('medsolution.consultations');
    const { data, error } = await connection.from('atenciones')
      .select('*, pacientes(legacy_id,nombre,apellido)').order('fecha_hora', { ascending: false });
    throwIfError(error); return (data || []).map(mapAttention);
  }
  async function deleteAttention(id) {
    const connection = await db(true);
    const { error } = await connection.from('atenciones').delete().eq('legacy_id', Number(id)); throwIfError(error);
  }
  async function ensureMedicalRecord(patientId) {
    const connection = await db(true);
    const { data, error } = await connection.rpc('obtener_o_crear_historia', { paciente_legacy_id: Number(patientId) });
    throwIfError(error); return data;
  }
  async function getMedicalRecords() {
    const connection=await db();
    if(!connection)return localArray('medsolution.medicalRecords');
    const {data,error}=await connection.from('historias_clinicas').select('id,paciente_id,grupo_sanguineo,antecedentes_personales,antecedentes_quirurgicos,antecedentes_familiares,antecedentes_alergicos,medicamentos_actuales,habitos,hospitalizaciones,enfermedades_cronicas,antecedentes_gineco_obstetricos,inmunizaciones,notas,creado_en,actualizado_en,pacientes(legacy_id)');
    throwIfError(error);
    return (data||[]).map(item=>({id:item.id,patientId:Number(item.pacientes?.legacy_id),bloodGroup:item.grupo_sanguineo||'',personalHistory:item.antecedentes_personales||'',surgicalHistory:item.antecedentes_quirurgicos||'',familyHistory:item.antecedentes_familiares||'',allergicHistory:item.antecedentes_alergicos||'',currentMedications:item.medicamentos_actuales||'',habits:item.habitos||'',hospitalizations:item.hospitalizaciones||'',chronicDiseases:item.enfermedades_cronicas||'',gynecologicalHistory:item.antecedentes_gineco_obstetricos||'',immunizations:item.inmunizaciones||'',notes:item.notas||'',createdAt:item.creado_en,updatedAt:item.actualizado_en}));
  }
  async function saveMedicalRecord(item){const connection=await db();if(!connection){const records=localArray('medsolution.medicalRecords'),saved={...item,updatedAt:new Date().toISOString()},index=records.findIndex(record=>String(record.id)===String(item.id));if(index>=0)records[index]=saved;else records.push(saved);localStorage.setItem('medsolution.medicalRecords',JSON.stringify(records));return saved}const payload={grupo_sanguineo:item.bloodGroup||'',antecedentes_personales:item.personalHistory||'',antecedentes_quirurgicos:item.surgicalHistory||'',antecedentes_familiares:item.familyHistory||'',antecedentes_alergicos:item.allergicHistory||'',medicamentos_actuales:item.currentMedications||'',habitos:item.habits||'',hospitalizaciones:item.hospitalizations||'',enfermedades_cronicas:item.chronicDiseases||'',antecedentes_gineco_obstetricos:item.gynecologicalHistory||'',inmunizaciones:item.immunizations||'',notas:item.notes||'',actualizado_en:new Date().toISOString()};const {data,error}=await connection.from('historias_clinicas').update(payload).eq('id',item.id).select('id,actualizado_en').single();throwIfError(error);return {...item,updatedAt:data.actualizado_en}}
  function mapSpecializedHistory(row) {
    return {
      id: row.id, medicalRecordId: row.historia_clinica_id, templateType: row.tipo_plantilla,
      templateName: row.nombre_plantilla_snapshot, templateVersion: Number(row.version_plantilla || 1),
      status: row.estado, startDate: row.fecha_inicio, totalCost: Number(row.costo_total || 0),
      estimatedSessions: row.sesiones_estimadas == null ? null : Number(row.sesiones_estimadas),
      initialData: row.datos_iniciales || {}, createdBy: row.creado_por_nombre_snapshot || '',
      updatedBy: row.actualizado_por_nombre_snapshot || '', finishedAt: row.finalizado_en || '',
      createdAt: row.creado_en, updatedAt: row.actualizado_en,
    };
  }
  async function getSpecializedHistories(medicalRecordId = null) {
    const connection = await db(true);
    let query = connection.from('historias_clinicas_especializadas').select('*').order('fecha_inicio', { ascending: false });
    if (medicalRecordId) query = query.eq('historia_clinica_id', medicalRecordId);
    const { data, error } = await query; throwIfError(error); return (data || []).map(mapSpecializedHistory);
  }
  async function saveSpecializedHistory(item) {
    const connection = await db(true);
    const payload = {
      historia_clinica_id: item.medicalRecordId, tipo_plantilla: item.templateType,
      nombre_plantilla_snapshot: item.templateName, version_plantilla: Number(item.templateVersion || 1),
      estado: item.status || 'Activo', fecha_inicio: item.startDate,
      costo_total: Number(item.totalCost || 0), sesiones_estimadas: item.estimatedSessions ? Number(item.estimatedSessions) : null,
      datos_iniciales: item.initialData || {}, creado_por_nombre_snapshot: item.createdBy || '',
      actualizado_por_nombre_snapshot: item.updatedBy || item.createdBy || '',
      finalizado_en: item.status === 'Finalizado' ? (item.finishedAt || new Date().toISOString()) : null,
    };
    const mutation = item.id
      ? connection.from('historias_clinicas_especializadas').update(payload).eq('id', item.id)
      : connection.from('historias_clinicas_especializadas').insert(payload);
    const { data, error } = await mutation.select().single(); throwIfError(error); return mapSpecializedHistory(data);
  }
  async function deleteSpecializedHistory(id) {
    const connection = await db(true); const { error } = await connection.from('historias_clinicas_especializadas').delete().eq('id', id); throwIfError(error);
  }
  function mapSpecializedEvolution(row) {
    return { id: row.id, specializedHistoryId: row.historia_especializada_id, attentionRemoteId: row.atencion_id, metrics: row.metricas || {}, data: row.datos_evolucion || {}, createdAt: row.creado_en, updatedAt: row.actualizado_en };
  }
  async function getSpecializedEvolutions(specializedHistoryId) {
    const connection = await db(true); const { data, error } = await connection.from('evoluciones_historias_especializadas').select('*').eq('historia_especializada_id', specializedHistoryId).order('creado_en'); throwIfError(error); return (data || []).map(mapSpecializedEvolution);
  }
  async function getSpecializedEvolutionsByHistoryIds(specializedHistoryIds) {
    const ids = [...new Set((specializedHistoryIds || []).filter(Boolean))];
    if (!ids.length) return [];
    const connection = await db(true);
    const { data, error } = await connection.from('evoluciones_historias_especializadas')
      .select('*').in('historia_especializada_id', ids).order('creado_en');
    throwIfError(error); return (data || []).map(mapSpecializedEvolution);
  }
  async function saveSpecializedEvolution(item) {
    const connection = await db(true);
    const payload = {
      historia_especializada_id: item.specializedHistoryId,
      atencion_id: uuidOrNull(item.attentionRemoteId),
      metricas: item.metrics || {},
      datos_evolucion: item.data || {},
    };
    const mutation = item.id
      ? connection.from('evoluciones_historias_especializadas').update(payload).eq('id', item.id)
      : connection.from('evoluciones_historias_especializadas').insert(payload);
    const { data, error } = await mutation.select().single();
    throwIfError(error); return mapSpecializedEvolution(data);
  }
  function mapSpecializedPayment(row) {
    return { id:row.id, specializedHistoryId:row.historia_especializada_id, attentionRemoteId:row.atencion_id||'', paymentDate:row.fecha_pago, amount:Number(row.monto||0), method:row.metodo_pago, observations:row.observaciones||'', registeredBy:row.registrado_por_nombre_snapshot||'', createdAt:row.creado_en, updatedAt:row.actualizado_en };
  }
  async function getSpecializedPayments(specializedHistoryId = null) {
    const connection = await db(true); let query=connection.from('pagos_historias_especializadas').select('*').order('fecha_pago',{ascending:false});if(specializedHistoryId)query=query.eq('historia_especializada_id',specializedHistoryId);const {data,error}=await query;throwIfError(error);return (data||[]).map(mapSpecializedPayment);
  }
  async function getSpecializedPaymentsByHistoryIds(specializedHistoryIds) {
    const ids = [...new Set((specializedHistoryIds || []).filter(Boolean))];
    if (!ids.length) return [];
    const connection = await db(true);
    const { data, error } = await connection.from('pagos_historias_especializadas')
      .select('*').in('historia_especializada_id', ids).order('fecha_pago', { ascending: false });
    throwIfError(error); return (data || []).map(mapSpecializedPayment);
  }
  async function saveSpecializedPayment(item) {
    const connection=await db(true);const payload={historia_especializada_id:item.specializedHistoryId,atencion_id:uuidOrNull(item.attentionRemoteId),fecha_pago:item.paymentDate,monto:Number(item.amount),metodo_pago:item.method,observaciones:item.observations||'',registrado_por_nombre_snapshot:item.registeredBy||''};const mutation=item.id?connection.from('pagos_historias_especializadas').update(payload).eq('id',item.id):connection.from('pagos_historias_especializadas').insert(payload);const {data,error}=await mutation.select().single();throwIfError(error);return mapSpecializedPayment(data);
  }
  async function deleteSpecializedPayment(id) { const connection=await db(true);const {error}=await connection.from('pagos_historias_especializadas').delete().eq('id',id);throwIfError(error); }
  function subscribe(table, callback) {
    let channel = null;
    let cancelled = false;
    ready.then((connection) => {
      if (!connection || cancelled) {
        if (!connection) console.error(`[Realtime] No se pudo suscribir a public.${table}: Supabase no está configurado.`);
        return;
      }
      channel = connection.channel(`registro-clinico-${table}-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          Promise.resolve(callback(payload)).catch((error) => {
            console.error(`[Realtime] Error actualizando public.${table}:`, error);
          });
        })
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') console.info(`[Realtime] Suscripción activa: public.${table}`);
          else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
            console.error(`[Realtime] Suscripción public.${table}: ${status}`, error || '');
          }
        });
    });
    return () => {
      cancelled = true;
      if (channel && client) client.removeChannel(channel);
    };
  }
  async function testConnection() {
    const connection = await db(true);
    const { error } = await connection.from('servicios').select('id', { head: true, count: 'exact' }); throwIfError(error);
    return true;
  }
  function getSettings() {
    try { return Promise.resolve(JSON.parse(localStorage.getItem('medsolution.generalSettings')) || {}); }
    catch { return Promise.resolve({}); }
  }
  function saveSettings(settings) {
    localStorage.setItem('medsolution.generalSettings', JSON.stringify(settings)); return Promise.resolve(settings);
  }

  global.MedSolutionData = Object.freeze({
    ready, configuration: () => config || {}, getClient: () => client, isConfigured: () => Boolean(client),
    testConnection, getServices, saveService, toggleService,
    getStaff: () => getStaff(false), getAllStaff: () => getStaff(true), saveStaff, toggleStaff,
    getSystemUsers, saveSystemUser, uploadProfilePhoto, deleteStoredFile,
    uploadClinicalAttachment, signedFileUrl,
    getPatients, findPatientByCi, savePatient, deletePatient,
    getAttentions, saveAttention, savePatientAndAttention, deleteAttention,
    ensureMedicalRecord, getMedicalRecords, saveMedicalRecord, getSpecializedHistories, saveSpecializedHistory, deleteSpecializedHistory,
    getSpecializedEvolutions, getSpecializedEvolutionsByHistoryIds, saveSpecializedEvolution,
    getSpecializedPayments, getSpecializedPaymentsByHistoryIds, saveSpecializedPayment, deleteSpecializedPayment,
    getSettings, saveSettings,
    subscribeServices: (callback) => subscribe('servicios', callback),
    subscribeStaff: (callback) => subscribe('personal_consultorio', callback),
    subscribePatients: (callback) => subscribe('pacientes', callback),
    subscribeAttentions: (callback) => subscribe('atenciones', callback),
    subscribeSystemUsers: (callback) => subscribe('perfiles_sistema', callback),
    subscribeSpecializedHistories: (callback) => subscribe('historias_clinicas_especializadas', callback),
    subscribeSpecializedEvolutions: (callback) => subscribe('evoluciones_historias_especializadas', callback),
    subscribeSpecializedPayments: (callback) => subscribe('pagos_historias_especializadas', callback),
  });
})(window);
