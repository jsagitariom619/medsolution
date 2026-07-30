// MedSolution Clinical Data — capa compartida para pacientes, historia clínica,
// evoluciones médicas y procedimientos de enfermería en LocalStorage.
(function initClinicalData(global) {
  'use strict';

  const Storage = global.MedSolutionStorage;

  const KEYS = Object.freeze({
    patients: 'medsolution.patients',
    histories: 'medsolution.medicalRecords',
    consultations: 'medsolution.consultations',
    nursing: 'medsolution.nursingRecords',
  });

  function parseArray(key) {
    if (Storage) return Storage.readArray(key);
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveArray(key, value) {
    if (Storage) return Storage.writeArray(key, value);
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function localDateIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function nextNumericId(items, namespace = 'generic') {
    if (Storage) return Storage.nextId(namespace, items);
    const ids = (Array.isArray(items) ? items : [])
      .map((item) => Number(item?.id))
      .filter(Number.isFinite);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  function nextPatientId(patients = getPatients()) {
    const references = [
      ...parseArray(KEYS.histories),
      ...parseArray(KEYS.consultations),
      ...parseArray('medsolution.appointments'),
    ].map((item) => ({ id: Number(item?.patientId) }));
    Object.values(getNursingRecords()).forEach((records) => {
      (Array.isArray(records) ? records : []).forEach((record) => references.push({ id: Number(record?.patientId) }));
    });
    return nextNumericId([...patients, ...references], 'patients');
  }

  function getPatientSeed() {
    return [
      { id: 1, nombre: 'María Fernanda', apellido: 'López', ci: '12345678', fechaNacimiento: '1985-03-22', genero: 'Femenino', telefono: '0412-5551234', email: 'mflopez@email.com', direccion: 'Av. Principal, Caracas', registrado: '2025-06-17' },
      { id: 2, nombre: 'Carlos Alberto', apellido: 'Rojas', ci: '87654321', fechaNacimiento: '1978-08-10', genero: 'Masculino', telefono: '0414-5559876', email: 'carojas@email.com', direccion: 'Calle 5, Valencia', registrado: '2025-06-16' },
      { id: 3, nombre: 'Ana Gabriela', apellido: 'Méndez', ci: '11223344', fechaNacimiento: '1993-11-05', genero: 'Femenino', telefono: '0416-5553344', email: 'agmendez@email.com', direccion: 'Urb. Los Jardines, Maracay', registrado: '2025-06-15' },
    ];
  }

  function getPatients() {
    if (localStorage.getItem(KEYS.patients) === null) saveArray(KEYS.patients, getPatientSeed());
    return parseArray(KEYS.patients);
  }

  function savePatients(patients) {
    saveArray(KEYS.patients, patients);
  }

  function fullPatientName(patient) {
    return `${patient?.nombre || ''} ${patient?.apellido || ''}`.trim().replace(/\s+/g, ' ');
  }

  function findPatient(patientId) {
    return getPatients().find((patient) => Number(patient.id) === Number(patientId)) || null;
  }

  function findPatientByIdentity(value) {
    const query = normalizeText(value);
    if (!query) return null;
    return getPatients().find((patient) => {
      return normalizeText(fullPatientName(patient)) === query || normalizeText(patient.ci) === query;
    }) || null;
  }

  function splitPatientName(fullName) {
    const parts = String(fullName || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    if (!parts.length) return { nombre: 'Paciente', apellido: 'sin identificar' };
    if (parts.length === 1) return { nombre: parts[0], apellido: '' };
    return { nombre: parts.slice(0, -1).join(' '), apellido: parts.at(-1) };
  }

  function ensurePatientFromName(fullName) {
    const existing = findPatientByIdentity(fullName);
    if (existing) return existing;

    const patients = getPatients();
    const name = splitPatientName(fullName);
    const patient = {
      id: nextPatientId(patients),
      nombre: name.nombre,
      apellido: name.apellido,
      ci: '',
      fechaNacimiento: '',
      genero: '',
      telefono: '',
      email: '',
      direccion: '',
      registrado: localDateIso(),
      registrationSource: 'nursing',
    };
    patients.push(patient);
    savePatients(patients);
    return patient;
  }

  function normalizeHistory(raw) {
    const history = raw && typeof raw === 'object' ? raw : {};
    return {
      id: Number(history.id) || null,
      patientId: Number(history.patientId) || null,
      bloodType: history.bloodType || '',
      personalHistory: history.personalHistory || '',
      surgicalHistory: history.surgicalHistory || '',
      familyHistory: history.familyHistory || '',
      allergicHistory: history.allergicHistory || '',
      currentMedications: history.currentMedications || '',
      habits: history.habits || '',
      hospitalizations: history.hospitalizations || '',
      chronicDiseases: history.chronicDiseases || '',
      gynecologicalHistory: history.gynecologicalHistory || '',
      immunizations: history.immunizations || '',
      notes: history.notes || '',
      createdAt: history.createdAt || '',
      createdBy: history.createdBy || '',
      updatedAt: history.updatedAt || '',
      updatedBy: history.updatedBy || '',
      source: history.source || 'manual',
    };
  }

  function getHistories() {
    const normalized = parseArray(KEYS.histories)
      .map(normalizeHistory)
      .filter((history) => history.patientId);
    const unique = new Map();
    normalized.forEach((history) => {
      const current = unique.get(history.patientId);
      if (!current) {
        unique.set(history.patientId, history);
        return;
      }
      const merged = { ...current };
      ['bloodType', 'personalHistory', 'surgicalHistory', 'familyHistory', 'allergicHistory', 'currentMedications', 'habits', 'hospitalizations', 'chronicDiseases', 'gynecologicalHistory', 'immunizations', 'notes'].forEach((field) => {
        if (!merged[field] && history[field]) merged[field] = history[field];
      });
      if ((!merged.updatedAt || history.updatedAt > merged.updatedAt) && history.updatedAt) {
        merged.updatedAt = history.updatedAt;
        merged.updatedBy = history.updatedBy;
      }
      unique.set(history.patientId, normalizeHistory(merged));
    });
    const histories = [...unique.values()];
    if (histories.length !== normalized.length) saveArray(KEYS.histories, histories);
    return histories;
  }

  function saveHistories(histories) {
    saveArray(KEYS.histories, histories.map(normalizeHistory));
  }

  function getHistory(patientId) {
    return getHistories().find((history) => Number(history.patientId) === Number(patientId)) || null;
  }

  function getConsultations() {
    return parseArray(KEYS.consultations);
  }

  function saveConsultations(consultations) {
    saveArray(KEYS.consultations, consultations);
  }

  function saveHistory(patientId, data, actorName = '') {
    const numericPatientId = Number(patientId);
    if (!numericPatientId) throw new Error('Paciente inválido para la historia clínica.');

    const histories = getHistories();
    const index = histories.findIndex((history) => Number(history.patientId) === numericPatientId);
    const timestamp = nowIso();
    const cleanData = normalizeHistory({ ...data, patientId: numericPatientId });

    if (index >= 0) {
      const current = histories[index];
      histories[index] = normalizeHistory({
        ...current,
        ...cleanData,
        id: current.id,
        patientId: numericPatientId,
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        source: current.source,
        updatedAt: timestamp,
        updatedBy: actorName || current.updatedBy,
      });
    } else {
      histories.push(normalizeHistory({
        ...cleanData,
        id: nextNumericId(histories, 'histories'),
        patientId: numericPatientId,
        createdAt: timestamp,
        createdBy: actorName,
        updatedAt: timestamp,
        updatedBy: actorName,
        source: data?.source || 'manual',
      }));
    }

    saveHistories(histories);
    return histories.find((history) => Number(history.patientId) === numericPatientId) || null;
  }

  function historyHasContent(history) {
    if (!history) return false;
    return [
      history.bloodType,
      history.personalHistory,
      history.surgicalHistory,
      history.familyHistory,
      history.allergicHistory,
      history.currentMedications,
      history.habits,
      history.hospitalizations,
      history.chronicDiseases,
      history.gynecologicalHistory,
      history.immunizations,
      history.notes,
    ].some((value) => String(value || '').trim());
  }

  // Conserva la información de versiones anteriores: los antecedentes que se
  // repetían en la primera consulta se convierten en la historia clínica única.
  function migrateLegacyHistories() {
    const histories = getHistories();
    const knownPatients = new Set(histories.map((history) => Number(history.patientId)));
    const consultations = parseArray(KEYS.consultations)
      .filter((consultation) => Number(consultation?.patientId))
      .sort((a, b) => `${a.date || ''}${a.time || ''}${a.createdAt || ''}`.localeCompare(`${b.date || ''}${b.time || ''}${b.createdAt || ''}`));

    let changed = false;
    consultations.forEach((consultation) => {
      const patientId = Number(consultation.patientId);
      if (knownPatients.has(patientId)) return;
      const legacyData = {
        patientId,
        personalHistory: consultation.personalHistory || '',
        familyHistory: consultation.familyHistory || '',
        allergicHistory: consultation.allergicHistory || '',
        notes: '',
        source: 'legacy-consultation',
      };
      if (!historyHasContent(legacyData)) return;
      histories.push(normalizeHistory({
        ...legacyData,
        id: nextNumericId(histories, 'histories'),
        createdAt: consultation.createdAt || nowIso(),
        createdBy: consultation.doctorName || '',
        updatedAt: consultation.updatedAt || consultation.createdAt || nowIso(),
        updatedBy: consultation.doctorName || '',
      }));
      knownPatients.add(patientId);
      changed = true;
    });

    if (changed) saveHistories(histories);
    return histories;
  }

  function getNursingRecords() {
    if (Storage) {
      const value = Storage.read(KEYS.nursing, {});
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    try {
      const value = JSON.parse(localStorage.getItem(KEYS.nursing) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function saveNursingRecords(records) {
    if (Storage) return Storage.write(KEYS.nursing, records && typeof records === 'object' ? records : {});
    localStorage.setItem(KEYS.nursing, JSON.stringify(records && typeof records === 'object' ? records : {}));
  }

  global.MedSolutionClinical = Object.freeze({
    KEYS,
    parseArray,
    saveArray,
    nextNumericId,
    nextPatientId,
    normalizeText,
    getPatients,
    savePatients,
    findPatient,
    findPatientByIdentity,
    fullPatientName,
    ensurePatientFromName,
    getHistories,
    saveHistories,
    getHistory,
    saveHistory,
    getConsultations,
    saveConsultations,
    historyHasContent,
    migrateLegacyHistories,
    getNursingRecords,
    saveNursingRecords,
  });
})(window);
