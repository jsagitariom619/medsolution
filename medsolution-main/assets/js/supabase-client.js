// Pasarela única de MedSolution hacia Registro Clínico.
// Las credenciales públicas se obtienen desde /api/config en Vercel.
(function initSupabaseGateway(global) {
  'use strict';

  let client = null;
  let config = null;
  let bootError = null;

  const ready = (async () => {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Supabase no está configurado.');
      config = await response.json();
      if (!global.supabase?.createClient) throw new Error('No se cargó el cliente oficial de Supabase.');
      client = global.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      return client;
    } catch (error) {
      bootError = error;
      return null;
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
      throw new Error(details || `Error de Supabase${error.code ? ` (${error.code})` : ''}.`);
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
    return {
      ...(row.datos_clinicos || {}), id: Number(row.legacy_id), remoteId: row.id,
      patientId: Number(row.pacientes?.legacy_id), patientName: row.pacientes
        ? `${row.pacientes.nombre} ${row.pacientes.apellido || ''}`.trim() : '',
      serviceId: row.servicio_id, serviceType: row.servicio_nombre_snapshot,
      servicePrice: Number(row.precio_snapshot || 0), procedureResponsible: row.responsable_nombre_snapshot || '',
      registeredByUserId: row.registrado_por, registeredBy: row.registrado_por_nombre_snapshot || '',
      status: row.estado, createdAt: row.fecha_hora,
      date: Number.isNaN(arrival.getTime()) ? '' : arrival.toISOString().slice(0, 10),
      time: Number.isNaN(arrival.getTime()) ? '' : arrival.toTimeString().slice(0, 5),
      chiefComplaint: row.motivo || '',
      evolution: row.evolucion || '', diagnosis: row.diagnostico || '', treatment: row.tratamiento || '',
      prescription: row.receta || '', indications: row.indicaciones || '', nextControl: row.proximo_control || '',
    };
  }

  async function getServices(includeInactive = false) {
    const connection = await db();
    if (!connection) return [];
    let query = connection.from('servicios').select('*').order('nombre');
    if (!includeInactive) query = query.eq('activo', true);
    const { data, error } = await query; throwIfError(error); return (data || []).map(mapService);
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
    let query = connection.from('personal_consultorio').select('*').order('nombre_completo');
    if (!includeInactive) query = query.eq('activo', true);
    const { data, error } = await query; throwIfError(error); return (data || []).map(mapStaff);
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
    if (['En consulta', 'Finalizada'].includes(attention.status) && attention.requiresMedicalConsultation !== false) {
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
      responsable_id: responsible?.id || null, registrado_por: uuidOrNull(attention.registeredByUserId),
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
      if (['En consulta', 'Finalizada'].includes(linkedAttention.status)
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
    const {data,error}=await connection.from('historias_clinicas').select('id,paciente_id,creado_en,actualizado_en,pacientes(legacy_id)');
    throwIfError(error);
    return (data||[]).map(item=>({id:item.id,patientId:Number(item.pacientes?.legacy_id),createdAt:item.creado_en,updatedAt:item.actualizado_en}));
  }
  function subscribe(table, callback) {
    if (!client) return () => {};
    const channel = client.channel(`registro-clinico-${table}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback).subscribe();
    return () => client.removeChannel(channel);
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
    getPatients, findPatientByCi, savePatient, deletePatient,
    getAttentions, saveAttention, savePatientAndAttention, deleteAttention,
    ensureMedicalRecord, getMedicalRecords, getSettings, saveSettings,
    subscribeServices: (callback) => subscribe('servicios', callback),
    subscribeStaff: (callback) => subscribe('personal_consultorio', callback),
    subscribePatients: (callback) => subscribe('pacientes', callback),
    subscribeAttentions: (callback) => subscribe('atenciones', callback),
  });
})(window);
