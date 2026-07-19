const PATIENTS_STORAGE_KEY = 'medsolution.patients';
const basePatients = [
  {
    id: 'seed-patient-001',
    firstName: 'María Fernanda',
    lastName: 'López',
    documentId: '12345678',
    birthDate: '1990-04-12',
    sex: 'Femenino',
    maritalStatus: 'Casado/a',
    occupation: 'Contadora',
    phone: '+58 412-555-0101',
    email: 'maria.lopez@email.com',
    address: 'Av. Principal, Edif. Los Olivos',
    city: 'Caracas',
    emergencyContact: 'Juan López - +58 424-555-0199',
    bloodType: 'O+',
    allergies: 'Penicilina',
    medicalHistory: 'Hipertensión controlada',
    photo: '',
  },
  {
    id: 'seed-patient-002',
    firstName: 'Carlos Alberto',
    lastName: 'Rojas',
    documentId: 'V-87654321',
    birthDate: '1984-09-02',
    sex: 'Masculino',
    maritalStatus: 'Soltero/a',
    occupation: 'Ingeniero',
    phone: '+58 414-555-0182',
    email: 'carlos.rojas@email.com',
    address: 'Urb. El Bosque, Casa 14',
    city: 'Valencia',
    emergencyContact: 'Laura Rojas - +58 412-555-0150',
    bloodType: 'A+',
    allergies: 'Ninguna',
    medicalHistory: 'Dolor lumbar recurrente',
    photo: '',
  },
];

const patientsService = {
  async list() {
    return loadPatients();
  },
  async getById(id) {
    return loadPatients().find((patient) => patient.id === id) || null;
  },
  async create(payload) {
    const patients = loadPatients();
    const patient = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    patients.unshift(patient);
    savePatients(patients);
    return patient;
  },
  async update(id, payload) {
    const patients = loadPatients();
    const index = patients.findIndex((patient) => patient.id === id);
    if (index < 0) throw new Error('Paciente no encontrado');

    patients[index] = {
      ...patients[index],
      ...payload,
      id,
      updatedAt: new Date().toISOString(),
    };

    savePatients(patients);
    return patients[index];
  },
  async remove(id) {
    const patients = loadPatients();
    const nextPatients = patients.filter((patient) => patient.id !== id);
    savePatients(nextPatients);
  },
};

const state = {
  patients: [],
  editingId: null,
  currentPhoto: '',
  citiesSignature: '',
};

const dom = {
  tableBody: document.getElementById('patientsTableBody'),
  emptyState: document.getElementById('patientsEmptyState'),
  searchInput: document.getElementById('patientSearch'),
  sexFilter: document.getElementById('filterSex'),
  bloodFilter: document.getElementById('filterBloodType'),
  cityFilter: document.getElementById('filterCity'),
  feedback: document.getElementById('patientsFeedback'),
  formModal: document.getElementById('patientFormModal'),
  detailModal: document.getElementById('patientDetailModal'),
  form: document.getElementById('patientForm'),
  formTitle: document.getElementById('patientFormTitle'),
  birthDate: document.getElementById('birthDate'),
  age: document.getElementById('age'),
  photoInput: document.getElementById('photo'),
  photoPreview: document.getElementById('patientPhotoPreview'),
  detailBody: document.getElementById('patientDetailBody'),
  detailHistoryBtn: document.getElementById('detailOpenHistoryBtn'),
};

const requiredFields = [
  'firstName',
  'lastName',
  'documentId',
  'birthDate',
  'sex',
  'maritalStatus',
  'occupation',
  'phone',
  'email',
  'address',
  'city',
  'emergencyContact',
  'bloodType',
  'allergies',
  'medicalHistory',
];

const formatDate = (isoDate) => {
  if (!isoDate) return 'N/D';
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'N/D' : date.toLocaleDateString('es-VE');
};

const calculateAge = (birthDate) => {
  if (!birthDate) return '';

  const today = new Date();
  const born = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return '';

  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  const dayDiff = today.getDate() - born.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? String(age) : '';
};

const loadPatients = () => {
  const stored = localStorage.getItem(PATIENTS_STORAGE_KEY);
  if (!stored) return [...basePatients];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [...basePatients];
  } catch {
    return [...basePatients];
  }
};

const savePatients = (patients) => {
  localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(patients));
};

const fullName = (patient) => `${patient.firstName} ${patient.lastName}`.trim();

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[char] || char;
  });

const buildInitials = (patient) =>
  [patient.firstName, patient.lastName]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'PA';

const setFeedback = (message, type = 'info') => {
  dom.feedback.textContent = message;
  dom.feedback.dataset.type = type;
};

const setPhotoPreview = (photo, initials = 'PA') => {
  if (photo) {
    dom.photoPreview.style.backgroundImage = `url("${photo}")`;
    dom.photoPreview.textContent = '';
    dom.photoPreview.classList.add('patient-photo-preview--image');
    return;
  }

  dom.photoPreview.style.backgroundImage = '';
  dom.photoPreview.textContent = initials;
  dom.photoPreview.classList.remove('patient-photo-preview--image');
};

const resetForm = () => {
  dom.form.reset();
  state.editingId = null;
  state.currentPhoto = '';
  dom.formTitle.textContent = 'Registrar paciente';
  dom.age.value = '';
  setPhotoPreview('', 'PA');
};

const openModal = (modal) => {
  modal.classList.add('patients-modal--active');
};

const closeModal = (modal) => {
  modal.classList.remove('patients-modal--active');
};

const updateCityFilter = (patients) => {
  const selected = dom.cityFilter.value;
  const cities = [...new Set(patients.map((patient) => patient.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const signature = cities.join('|');

  if (signature === state.citiesSignature) {
    if (!cities.includes(selected)) {
      dom.cityFilter.value = '';
    }
    return;
  }

  state.citiesSignature = signature;
  dom.cityFilter.innerHTML = '<option value="">Todas las ciudades</option>' + cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join('');
  dom.cityFilter.value = cities.includes(selected) ? selected : '';
};

const filteredPatients = () => {
  const query = dom.searchInput.value.trim().toLowerCase();
  const sex = dom.sexFilter.value;
  const bloodType = dom.bloodFilter.value;
  const city = dom.cityFilter.value;

  return state.patients.filter((patient) => {
    const source = [
      patient.firstName,
      patient.lastName,
      patient.documentId,
      patient.phone,
      patient.email,
      patient.city,
      patient.emergencyContact,
    ]
      .join(' ')
      .toLowerCase();

    const matchesQuery = !query || source.includes(query);
    const matchesSex = !sex || patient.sex === sex;
    const matchesBlood = !bloodType || patient.bloodType === bloodType;
    const matchesCity = !city || patient.city === city;

    return matchesQuery && matchesSex && matchesBlood && matchesCity;
  });
};

const renderPatientsTable = () => {
  const patients = filteredPatients();

  dom.tableBody.innerHTML = patients
    .map(
      (patient) => `
        <tr>
          <td data-label="Paciente">
            <div class="patient-cell">
              <span class="patient-avatar${patient.photo ? ' patient-avatar--image' : ''}"${patient.photo ? ` style="background-image:url('${escapeHtml(patient.photo)}')"` : ''}>${patient.photo ? '' : buildInitials(patient)}</span>
              <div>
                <strong>${escapeHtml(fullName(patient))}</strong>
                <small>${escapeHtml(patient.email)}</small>
              </div>
            </div>
          </td>
          <td data-label="CI/Pasaporte">${escapeHtml(patient.documentId)}</td>
          <td data-label="Edad">${escapeHtml(calculateAge(patient.birthDate))}</td>
          <td data-label="Sexo">${escapeHtml(patient.sex)}</td>
          <td data-label="Ciudad">${escapeHtml(patient.city)}</td>
          <td data-label="Teléfono">${escapeHtml(patient.phone)}</td>
          <td data-label="Grupo sanguíneo"><span class="badge">${escapeHtml(patient.bloodType)}</span></td>
          <td data-label="Acciones">
            <div class="patients-actions">
              <button type="button" class="btn-action" data-action="view" data-id="${patient.id}" aria-label="Visualizar paciente">👁</button>
              <button type="button" class="btn-action" data-action="edit" data-id="${patient.id}" aria-label="Editar paciente">✎</button>
              <button type="button" class="btn-action btn-action--delete" data-action="delete" data-id="${patient.id}" aria-label="Eliminar paciente">✕</button>
              <button type="button" class="btn btn--secondary btn--history" data-action="history" data-id="${patient.id}">Abrir Historia Clínica</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');

  dom.emptyState.hidden = patients.length !== 0;
};

const showDetail = (patient) => {
  dom.detailBody.innerHTML = `
    <div class="patient-detail-layout">
      <div class="patient-detail-photo${patient.photo ? ' patient-detail-photo--image' : ''}"${patient.photo ? ` style="background-image:url('${escapeHtml(patient.photo)}')"` : ''}>${patient.photo ? '' : buildInitials(patient)}</div>
      <div class="patient-detail-grid">
        <p><strong>Nombres:</strong> ${escapeHtml(patient.firstName)}</p>
        <p><strong>Apellidos:</strong> ${escapeHtml(patient.lastName)}</p>
        <p><strong>CI/Pasaporte:</strong> ${escapeHtml(patient.documentId)}</p>
        <p><strong>Fecha de nacimiento:</strong> ${escapeHtml(formatDate(patient.birthDate))}</p>
        <p><strong>Edad:</strong> ${escapeHtml(calculateAge(patient.birthDate))}</p>
        <p><strong>Sexo:</strong> ${escapeHtml(patient.sex)}</p>
        <p><strong>Estado civil:</strong> ${escapeHtml(patient.maritalStatus)}</p>
        <p><strong>Ocupación:</strong> ${escapeHtml(patient.occupation)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(patient.phone)}</p>
        <p><strong>Correo:</strong> ${escapeHtml(patient.email)}</p>
        <p><strong>Dirección:</strong> ${escapeHtml(patient.address)}</p>
        <p><strong>Ciudad:</strong> ${escapeHtml(patient.city)}</p>
        <p><strong>Contacto de emergencia:</strong> ${escapeHtml(patient.emergencyContact)}</p>
        <p><strong>Grupo sanguíneo:</strong> ${escapeHtml(patient.bloodType)}</p>
        <p><strong>Alergias:</strong> ${escapeHtml(patient.allergies)}</p>
        <p><strong>Antecedentes importantes:</strong> ${escapeHtml(patient.medicalHistory)}</p>
      </div>
    </div>
  `;

  dom.detailHistoryBtn.dataset.id = patient.id;
  openModal(dom.detailModal);
};

const fillForm = (patient) => {
  state.editingId = patient.id;
  state.currentPhoto = patient.photo || '';
  dom.formTitle.textContent = 'Editar paciente';

  Object.entries(patient).forEach(([key, value]) => {
    const field = dom.form.elements.namedItem(key);
    if (field && typeof field.value !== 'undefined') {
      field.value = value ?? '';
    }
  });

  dom.age.value = calculateAge(patient.birthDate);
  setPhotoPreview(patient.photo, buildInitials(patient));
  openModal(dom.formModal);
};

const validateFormData = (data) => {
  data.documentId = data.documentId.replace(/\s+/g, '');

  for (const field of requiredFields) {
    if (!String(data[field] || '').trim()) {
      throw new Error('Completa todos los campos obligatorios del paciente.');
    }
  }

  const emailField = dom.form.elements.namedItem('email');
  if (emailField instanceof HTMLInputElement && !emailField.checkValidity()) {
    throw new Error('Ingresa un correo electrónico válido.');
  }

  if (!/^(?=.*[A-Za-z0-9])[A-Za-z0-9-]{5,20}$/.test(data.documentId)) {
    throw new Error('Ingresa un CI/Pasaporte válido (5 a 20 caracteres, alfanumérico con guiones opcionales).');
  }

  if (!/^[+()\d\s-]{7,20}$/.test(data.phone)) {
    throw new Error('Ingresa un teléfono válido.');
  }

  const calculatedAge = calculateAge(data.birthDate);
  if (calculatedAge === '') {
    throw new Error('La fecha de nacimiento no es válida.');
  }

  const age = Number(calculatedAge);
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    throw new Error('La fecha de nacimiento no es válida.');
  }
};

const openMedicalRecord = (patientId) => {
  window.location.href = `medical-records.html?patientId=${encodeURIComponent(patientId)}`;
};

const refreshPatients = async () => {
  state.patients = await patientsService.list();
  updateCityFilter(state.patients);
  renderPatientsTable();
};

const bindEvents = () => {
  document.getElementById('newPatientBtn').addEventListener('click', () => {
    resetForm();
    openModal(dom.formModal);
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.closest('.patients-modal')));
  });

  document.querySelectorAll('.patients-modal').forEach((modal) => {
    modal.querySelector('.patients-modal__overlay').addEventListener('click', () => closeModal(modal));
  });

  [dom.searchInput, dom.sexFilter, dom.bloodFilter, dom.cityFilter].forEach((control) => {
    control.addEventListener('input', renderPatientsTable);
    control.addEventListener('change', renderPatientsTable);
  });

  dom.birthDate.addEventListener('change', () => {
    dom.age.value = calculateAge(dom.birthDate.value);
  });

  dom.photoInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) {
      setPhotoPreview(state.currentPhoto, 'PA');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      state.currentPhoto = typeof reader.result === 'string' ? reader.result : '';
      setPhotoPreview(state.currentPhoto, 'PA');
    };
    reader.readAsDataURL(file);
  });

  dom.form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(dom.form);
      const payload = Object.fromEntries(formData.entries());
      delete payload.photoFile;
      payload.birthDate = payload.birthDate || '';
      payload.photo = state.currentPhoto || '';

      validateFormData(payload);

      if (state.editingId) {
        await patientsService.update(state.editingId, payload);
        setFeedback('Paciente actualizado correctamente.', 'success');
      } else {
        await patientsService.create(payload);
        setFeedback('Paciente registrado correctamente.', 'success');
      }

      closeModal(dom.formModal);
      resetForm();
      await refreshPatients();
    } catch (error) {
      setFeedback(error.message || 'No se pudo guardar el paciente.', 'error');
    }
  });

  dom.tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const patient = await patientsService.getById(button.dataset.id);
    if (!patient) {
      setFeedback('Paciente no encontrado.', 'error');
      return;
    }

    if (button.dataset.action === 'view') {
      showDetail(patient);
      return;
    }

    if (button.dataset.action === 'edit') {
      fillForm(patient);
      return;
    }

    if (button.dataset.action === 'history') {
      openMedicalRecord(patient.id);
      return;
    }

    if (button.dataset.action === 'delete') {
      const confirmed = window.confirm(`¿Eliminar a ${fullName(patient)}? Esta acción no se puede deshacer.`);
      if (!confirmed) return;

      await patientsService.remove(patient.id);
      setFeedback('Paciente eliminado correctamente.', 'success');
      await refreshPatients();
    }
  });

  dom.detailHistoryBtn.addEventListener('click', () => {
    const patientId = dom.detailHistoryBtn.dataset.id;
    if (patientId) openMedicalRecord(patientId);
  });
};

const init = async () => {
  dom.birthDate.max = new Date().toISOString().split('T')[0];
  bindEvents();
  await refreshPatients();
  setFeedback('Módulo de pacientes listo para operar en modo local. Preparado para integrar Supabase.', 'info');
};

window.patientsService = patientsService;

document.addEventListener('DOMContentLoaded', init);
