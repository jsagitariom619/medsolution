// MedSolution data gateway. Supabase is authoritative when configured.
(function () {
  const URL_KEY = 'medsolution.supabase.url';
  const ANON_KEY = 'medsolution.supabase.anonKey';
  let client = null;

  function configuration() {
    return { url: localStorage.getItem(URL_KEY) || '', anonKey: localStorage.getItem(ANON_KEY) || '' };
  }
  function configure(url, anonKey) {
    localStorage.setItem(URL_KEY, (url || '').trim().replace(/\/$/, ''));
    localStorage.setItem(ANON_KEY, (anonKey || '').trim());
    client = null;
    return getClient();
  }
  function getClient() {
    if (client) return client;
    const config = configuration();
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    client = window.supabase.createClient(config.url, config.anonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return client;
  }
  function isConfigured() { return Boolean(getClient()); }
  function readLocal(key) {
    try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function normalizeError(error) {
    if (error) throw new Error(error.message || 'No se pudo completar la operación en Supabase.');
  }

  async function getServices(includeInactive = false) {
    const db = getClient();
    if (!db) return [];
    let query = db.from('services').select('*').order('name');
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    normalizeError(error);
    return data || [];
  }
  async function saveService(service) {
    const db = getClient();
    if (!db) throw new Error('Conecta Supabase para administrar servicios.');
    const payload = { ...service };
    if (!payload.id) delete payload.id;
    const { data, error } = await db.from('services').upsert(payload).select().single();
    normalizeError(error);
    return data;
  }
  async function toggleService(id, active) {
    const services = await getServices(true);
    const service = services.find((item) => String(item.id) === String(id));
    if (!service) throw new Error('Servicio no encontrado.');
    return saveService({ ...service, active });
  }
  async function getStaff() {
    const db = getClient();
    if (!db) return [];
    const { data, error } = await db.from('staff_members').select('*').eq('active', true).order('name');
    normalizeError(error);
    return data || [];
  }
  async function getAllStaff() {
    const db = getClient();
    if (!db) return [];
    const { data, error } = await db.from('staff_members').select('*').order('name');
    normalizeError(error); return data || [];
  }
  async function saveStaff(person) {
    const db = getClient();
    if (!db) throw new Error('Conecta Supabase para administrar el personal.');
    const payload = { ...person }; if (!payload.id) delete payload.id;
    const { data, error } = await db.from('staff_members').upsert(payload).select().single();
    normalizeError(error); return data;
  }
  async function toggleStaff(id, active) {
    const items = await getAllStaff();
    const person = items.find((item) => String(item.id) === String(id));
    if (!person) throw new Error('Integrante no encontrado.');
    return saveStaff({ ...person, active });
  }
  async function getAttentions() {
    const db = getClient();
    if (!db) return readLocal('medsolution.consultations');
    const { data, error } = await db.from('attentions').select('*').order('arrival_at', { ascending: false });
    normalizeError(error);
    return (data || []).map((row) => ({
      ...(row.payload || {}), id: row.legacy_id, remoteId: row.id, patientId: Number(row.patient_ref) || row.patient_ref,
      patientName: row.patient_name, serviceId: row.service_id, serviceType: row.service_name,
      servicePrice: Number(row.price_snapshot || 0), procedureResponsible: row.responsible_name || '',
      registeredByUserId: row.registered_by_user, registeredBy: row.registered_by_name,
      status: row.status, createdAt: row.arrival_at,
    }));
  }
  async function getPatients() {
    const db = getClient();
    if (!db) return readLocal('medsolution.patients');
    const { data, error } = await db.from('patients').select('*').order('full_name');
    normalizeError(error);
    return (data || []).map((row) => ({ ...(row.payload || {}), id: row.legacy_id, remoteId: row.id }));
  }
  async function savePatient(patient) {
    const db = getClient();
    if (!db) return patient;
    const { data, error } = await db.from('patients').upsert({
      legacy_id: Number(patient.id), full_name: `${patient.nombre || ''} ${patient.apellido || ''}`.trim(), payload: patient,
    }, { onConflict: 'legacy_id' }).select().single();
    normalizeError(error); return data;
  }
  async function deletePatient(id) {
    const db = getClient();
    if (!db) return;
    const { error } = await db.from('patients').delete().eq('legacy_id', Number(id));
    normalizeError(error);
  }
  async function saveAttention(attention) {
    const db = getClient();
    if (!db) return attention;
    const {
      id, patientId, patientName, serviceId, serviceType, servicePrice,
      procedureResponsible, registeredByUserId, registeredBy, status, createdAt, ...clinicalPayload
    } = attention;
    const registeredUserUuid = typeof registeredByUserId === 'string' && /^[0-9a-f-]{36}$/i.test(registeredByUserId)
      ? registeredByUserId : null;
    const payload = {
      legacy_id: Number(id), patient_ref: String(patientId),
      patient_name: patientName, service_id: serviceId || null,
      service_name: serviceType, price_snapshot: Number(servicePrice || 0),
      responsible_name: procedureResponsible || null, registered_by_user: registeredUserUuid,
      registered_by_name: registeredBy || '', status,
      arrival_at: createdAt || new Date().toISOString(), payload: clinicalPayload,
    };
    const { data, error } = await db.from('attentions').upsert(payload, { onConflict: 'legacy_id' }).select().single();
    normalizeError(error);
    return data;
  }
  async function deleteAttention(id) {
    const db = getClient();
    if (!db) return;
    const { error } = await db.from('attentions').delete().eq('legacy_id', Number(id));
    normalizeError(error);
  }
  async function ensureMedicalRecord(patientId) {
    const db = getClient();
    if (!db) return null;
    const patientRef = String(patientId);
    const { data: existing, error: findError } = await db.from('medical_records').select('*').eq('patient_ref', patientRef).maybeSingle();
    normalizeError(findError);
    if (existing) return existing;
    const { data, error } = await db.from('medical_records').insert({ patient_ref: patientRef }).select().single();
    if (error?.code === '23505') {
      const retry = await db.from('medical_records').select('*').eq('patient_ref', patientRef).single();
      normalizeError(retry.error); return retry.data;
    }
    normalizeError(error); return data;
  }
  function subscribe(table, callback) {
    const db = getClient();
    if (!db) return () => {};
    const channel = db.channel(`medsolution-${table}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback).subscribe();
    return () => db.removeChannel(channel);
  }
  async function testConnection() {
    const db = getClient();
    if (!db) throw new Error('Completa la URL y la clave pública.');
    const { error } = await db.from('services').select('id', { head: true, count: 'exact' });
    normalizeError(error);
    return true;
  }
  async function getProfiles() {
    const db = getClient();
    if (!db) return readLocal('medsolution.users');
    const { data, error } = await db.from('profiles').select('*').order('full_name');
    normalizeError(error);
    return (data || []).map((profile) => ({
      id: profile.user_id, username: profile.email, email: profile.email,
      name: profile.full_name, role: profile.role, active: profile.active,
      initials: profile.full_name.split(/\s+/).slice(0,2).map((part)=>part[0] || '').join('').toUpperCase(),
    }));
  }
  async function getSettings() {
    const db = getClient();
    if (!db) {
      try { return JSON.parse(localStorage.getItem('medsolution.generalSettings')) || {}; }
      catch { return {}; }
    }
    const { data, error } = await db.from('app_settings').select('key,value');
    normalizeError(error);
    return Object.fromEntries((data || []).map((item) => [item.key, item.value]));
  }
  async function saveSettings(settings) {
    const db = getClient();
    if (!db) {
      localStorage.setItem('medsolution.generalSettings', JSON.stringify(settings));
      return settings;
    }
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await db.from('app_settings').upsert(rows);
    normalizeError(error);
    return settings;
  }
  async function manageUser(action, user) {
    const db = getClient();
    if (!db) throw new Error('La gestión remota de usuarios requiere Supabase.');
    const { data, error } = await db.functions.invoke('manage-user', { body: { action, user } });
    normalizeError(error);
    if (data?.error) throw new Error(data.error);
    return data;
  }

  window.MedSolutionData = {
    configuration, configure, getClient, isConfigured, testConnection,
    getServices, saveService, toggleService, getStaff, getAllStaff, saveStaff, toggleStaff,
    getProfiles, manageUser, getSettings, saveSettings,
    getAttentions, saveAttention, deleteAttention, getPatients, savePatient, deletePatient, ensureMedicalRecord,
    subscribeServices: (callback) => subscribe('services', callback),
    subscribeAttentions: (callback) => subscribe('attentions', callback),
    subscribePatients: (callback) => subscribe('patients', callback),
    subscribeStaff: (callback) => subscribe('staff_members', callback),
  };
})();
