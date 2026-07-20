// Nursing Module JavaScript - Gestión de registros de enfermería

// ── Auth helper ───────────────────────────────────────────────────────────────

function getAuthUser() {
  try {
    const raw = sessionStorage.getItem('medsolution.authUser') || localStorage.getItem('medsolution.authUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function authCan(feature) {
  const user = getAuthUser();
  if (!user) return false;
  const permissions = {
    'nursing.edit':   ['Administrador', 'Médico', 'Auxiliar', 'Enfermería'],
    'nursing.delete': ['Administrador', 'Médico'],
  };
  return Boolean(permissions[feature]?.includes(user.role));
}

// State management
const nursingState = {
  currentTab: 'injectables',
  currentForm: null,
  records: {
    injectables: [
      {
        id: 1,
        date: '17/07/2025',
        patient: 'María Fernanda López',
        medication: 'Amoxicilina',
        dosage: '500mg',
        route: 'IM',
        responsible: 'Lic. Ana García',
        observations: 'Sin reacciones adversas'
      },
      {
        id: 2,
        date: '16/07/2025',
        patient: 'Carlos Alberto Rojas',
        medication: 'Ibuprofeno',
        dosage: '400mg',
        route: 'IV',
        responsible: 'Lic. Patricia Ruiz',
        observations: 'Paciente refiere alivio'
      }
    ],
    dressings: [
      {
        id: 1,
        date: '17/07/2025',
        patient: 'Ana Gabriela Méndez',
        type: 'Úlcera diabética',
        location: 'Pie izquierdo',
        material: 'Gasa estéril, antiséptico',
        responsible: 'Lic. Ana García',
        state: 'En cicatrización'
      },
      {
        id: 2,
        date: '15/07/2025',
        patient: 'Luis Miguel Vargas',
        type: 'Herida quirúrgica',
        location: 'Abdomen',
        material: 'Apósito transparente',
        responsible: 'Lic. Patricia Ruiz',
        state: 'Cicatrizando bien'
      }
    ],
    nebulizations: [
      {
        id: 1,
        date: '17/07/2025',
        patient: 'Eliana Suárez Torres',
        medication: 'Salbutamol',
        dosage: '2.5mg',
        duration: '15',
        responsible: 'Lic. María Santos',
        observations: 'Toleró bien, sin disnea'
      },
      {
        id: 2,
        date: '14/07/2025',
        patient: 'Roberto Flores',
        medication: 'Ipratropio',
        dosage: '0.5mg',
        duration: '20',
        responsible: 'Lic. Ana García',
        observations: 'Paciente con asma alérgica'
      }
    ],
    contraceptives: [
      {
        id: 1,
        date: '17/07/2025',
        patient: 'Sofía Martínez',
        type: 'Inyectable',
        medication: 'Medroxiprogesterona',
        frequency: 'Trimestral',
        nextDate: '16/10/2025',
        responsible: 'Lic. Patricia Ruiz'
      },
      {
        id: 2,
        date: '12/07/2025',
        patient: 'Valentina Ortiz',
        type: 'Inyectable',
        medication: 'Enantato de Noretisterona',
        frequency: 'Mensual',
        nextDate: '11/08/2025',
        responsible: 'Lic. Ana García'
      }
    ],
    serotherapy: [
      {
        id: 1,
        date: '17/07/2025',
        patient: 'Javier Medina',
        serumType: 'Suero fisiológico',
        volume: '1000',
        speed: '125',
        responsible: 'Lic. María Santos',
        observations: 'Hidratación preoperatoria'
      },
      {
        id: 2,
        date: '16/07/2025',
        patient: 'Camila Rojas',
        serumType: 'Dextrosa 5%',
        volume: '500',
        speed: '100',
        responsible: 'Lic. Patricia Ruiz',
        observations: 'Control electrolítico'
      }
    ],
    physiotherapy: [
      {
        id: 1,
        date: '17/07/2025',
        patient: 'Mariana Torres',
        therapyType: 'Masaje terapéutico',
        area: 'Espalda inferior',
        duration: '45',
        responsible: 'Lic. Carlos Mendez',
        state: 'Paciente mejoró movilidad'
      },
      {
        id: 2,
        date: '15/07/2025',
        patient: 'Diego Hernández',
        therapyType: 'Ejercicios de movilidad',
        area: 'Rodilla derecha',
        duration: '60',
        responsible: 'Lic. María Santos',
        state: 'Recuperación postquirúrgica'
      }
    ]
  }
};

// Initialize nursing module
document.addEventListener('DOMContentLoaded', () => {
  initNursingModule();
});

function initNursingModule() {
  setupTabSwitching();
  setupModalHandling();
  setupFormHandling();
  setupFilterHandling();
  setupNewRecordButton();
}

// Tab Switching
function setupTabSwitching() {
  const tabButtons = document.querySelectorAll('.nursing-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('nursing-tab--active'));
      button.classList.add('nursing-tab--active');

      // Hide all tab contents
      const contents = document.querySelectorAll('.nursing-tab-content');
      contents.forEach(content => content.classList.remove('nursing-tab-content--active'));

      // Show selected tab content
      const selectedContent = document.querySelector(`[data-content="${tabName}"]`);
      if (selectedContent) {
        selectedContent.classList.add('nursing-tab-content--active');
      }

      nursingState.currentTab = tabName;
    });
  });
}

// Modal Handling
function setupModalHandling() {
  const modal = document.getElementById('recordModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  modal.querySelector('.nursing-modal__overlay').addEventListener('click', closeModal);
}

function closeModal() {
  const modal = document.getElementById('recordModal');
  modal.classList.remove('nursing-modal--active');
  document.getElementById('recordForm').reset();
}

function openModal(tabType = null) {
  const modal = document.getElementById('recordModal');
  modal.classList.add('nursing-modal--active');
  
  const tab = tabType || nursingState.currentTab;
  populateFormFields(tab);
}

// Form Field Population
function populateFormFields(tabType) {
  const typeSpecificFields = document.getElementById('typeSpecificFields');
  typeSpecificFields.innerHTML = '';

  const fieldConfigs = {
    injectables: [
      { label: 'Medicamento *', name: 'medication', type: 'text', required: true },
      { label: 'Dosis *', name: 'dosage', type: 'text', required: true },
      { label: 'Vía *', name: 'route', type: 'select', options: ['IM', 'IV', 'SC', 'Oral'], required: true }
    ],
    dressings: [
      { label: 'Tipo de Herida *', name: 'type', type: 'text', required: true },
      { label: 'Localización *', name: 'location', type: 'text', required: true },
      { label: 'Material Utilizado *', name: 'material', type: 'textarea', required: true }
    ],
    nebulizations: [
      { label: 'Medicamento *', name: 'medication', type: 'text', required: true },
      { label: 'Dosis *', name: 'dosage', type: 'text', required: true },
      { label: 'Duración (minutos) *', name: 'duration', type: 'number', required: true }
    ],
    contraceptives: [
      { label: 'Tipo *', name: 'type', type: 'select', options: ['Inyectable', 'Implante', 'DIU'], required: true },
      { label: 'Medicamento *', name: 'medication', type: 'text', required: true },
      { label: 'Frecuencia *', name: 'frequency', type: 'select', options: ['Mensual', 'Trimestral'], required: true }
    ],
    serotherapy: [
      { label: 'Tipo de Suero *', name: 'serumType', type: 'text', required: true },
      { label: 'Volumen (mL) *', name: 'volume', type: 'number', required: true },
      { label: 'Velocidad (mL/h) *', name: 'speed', type: 'number', required: true }
    ],
    physiotherapy: [
      { label: 'Tipo de Terapia *', name: 'therapyType', type: 'text', required: true },
      { label: 'Área *', name: 'area', type: 'text', required: true },
      { label: 'Duración (minutos) *', name: 'duration', type: 'number', required: true }
    ]
  };

  const section = document.createElement('div');
  section.className = 'nursing-form__section';

  const fields = fieldConfigs[tabType] || [];

  fields.forEach(config => {
    if (config.type === 'select') {
      const label = document.createElement('label');
      label.className = 'form-field';
      const span = document.createElement('span');
      span.textContent = config.label;
      const select = document.createElement('select');
      select.name = config.name;
      select.required = config.required;
      config.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });
      label.appendChild(span);
      label.appendChild(select);
      section.appendChild(label);
    } else if (config.type === 'textarea') {
      const label = document.createElement('label');
      label.className = 'form-field';
      const span = document.createElement('span');
      span.textContent = config.label;
      const textarea = document.createElement('textarea');
      textarea.name = config.name;
      textarea.required = config.required;
      textarea.rows = '2';
      label.appendChild(span);
      label.appendChild(textarea);
      section.appendChild(label);
    } else {
      const label = document.createElement('label');
      label.className = 'form-field';
      const span = document.createElement('span');
      span.textContent = config.label;
      const input = document.createElement('input');
      input.type = config.type;
      input.name = config.name;
      input.required = config.required;
      label.appendChild(span);
      label.appendChild(input);
      section.appendChild(label);
    }
  });

  typeSpecificFields.appendChild(section);
}

// Form Handling
function setupFormHandling() {
  const form = document.getElementById('recordForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    // Calculate next date for contraceptives
    if (nursingState.currentTab === 'contraceptives') {
      data.nextDate = calculateNextContraceptiveDate(data.frequency);
    }

    // Add to records
    addRecord(nursingState.currentTab, data);

    closeModal();
    renderTable(nursingState.currentTab);
  });
}

function calculateNextContraceptiveDate(frequency) {
  const today = new Date();
  let daysToAdd = 30; // Default para mensual

  if (frequency === 'Trimestral') {
    daysToAdd = 90;
  }

  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + daysToAdd);

  return formatDate(nextDate);
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function addRecord(tabType, data) {
  const records = nursingState.records[tabType];
  const newId = Math.max(...records.map(r => r.id || 0)) + 1;

  records.push({
    id: newId,
    date: formatDate(new Date()),
    ...data
  });
}

// Filter Handling
function setupFilterHandling() {
  const tabs = ['injectables', 'dressings', 'nebulizations', 'contraceptives', 'serotherapy', 'physiotherapy'];

  tabs.forEach(tab => {
    const fromDateInput = document.getElementById(`${tab}FromDate`);
    const toDateInput = document.getElementById(`${tab}ToDate`);
    const patientInput = document.getElementById(`${tab}Patient`);
    const nurseInput = document.getElementById(`${tab}Nurse`);

    if (fromDateInput) fromDateInput.addEventListener('change', () => filterTable(tab));
    if (toDateInput) toDateInput.addEventListener('change', () => filterTable(tab));
    if (patientInput) patientInput.addEventListener('input', () => filterTable(tab));
    if (nurseInput) nurseInput.addEventListener('input', () => filterTable(tab));
  });
}

function filterTable(tabType) {
  const fromDateInput = document.getElementById(`${tabType}FromDate`);
  const toDateInput = document.getElementById(`${tabType}ToDate`);
  const patientInput = document.getElementById(`${tabType}Patient`);
  const nurseInput = document.getElementById(`${tabType}Nurse`);

  const fromDate = fromDateInput?.value;
  const toDate = toDateInput?.value;
  const patientFilter = patientInput?.value.toLowerCase() || '';
  const nurseFilter = nurseInput?.value.toLowerCase() || '';

  const records = nursingState.records[tabType];
  const filtered = records.filter(record => {
    const recordDate = parseDate(record.date);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    const dateMatch = (!from || recordDate >= from) && (!to || recordDate <= to);
    const patientMatch = !patientFilter || record.patient.toLowerCase().includes(patientFilter);
    const nurseMatch = !nurseFilter || record.responsible.toLowerCase().includes(nurseFilter);

    return dateMatch && patientMatch && nurseMatch;
  });

  renderFilteredTable(tabType, filtered);
}

function parseDate(dateString) {
  const [day, month, year] = dateString.split('/');
  return new Date(year, month - 1, day);
}

function renderFilteredTable(tabType, records) {
  const tableBodyId = getTableBodyId(tabType);
  const tableBody = document.getElementById(tableBodyId);

  if (!tableBody) return;

  tableBody.innerHTML = '';

  records.forEach(record => {
    const row = createTableRow(tabType, record);
    tableBody.appendChild(row);
  });
}

// Render Table
function renderTable(tabType) {
  const tableBodyId = getTableBodyId(tabType);
  const tableBody = document.getElementById(tableBodyId);

  if (!tableBody) return;

  tableBody.innerHTML = '';

  const records = nursingState.records[tabType];
  records.forEach(record => {
    const row = createTableRow(tabType, record);
    tableBody.appendChild(row);
  });
}

function getTableBodyId(tabType) {
  const mapping = {
    injectables: 'injectablesTable',
    dressings: 'dressingsTable',
    nebulizations: 'nebulizationsTable',
    contraceptives: 'contraceptivesTable',
    serotherapy: 'serotherapyTable',
    physiotherapy: 'physiotherapyTable'
  };
  return mapping[tabType];
}

function createTableRow(tabType, record) {
  const row = document.createElement('tr');

  const rowContent = {
    injectables: `
      <td>${record.date}</td>
      <td>${record.patient}</td>
      <td>${record.medication}</td>
      <td>${record.dosage}</td>
      <td>${record.route}</td>
      <td>${record.responsible}</td>
      <td>${record.observations}</td>
      <td>${authCan('nursing.edit') ? '<button class="btn-action">✎</button>' : ''}${authCan('nursing.delete') ? '<button class="btn-action btn-action--delete">✕</button>' : ''}</td>
    `,
    dressings: `
      <td>${record.date}</td>
      <td>${record.patient}</td>
      <td>${record.type}</td>
      <td>${record.location}</td>
      <td>${record.material}</td>
      <td>${record.responsible}</td>
      <td>${record.state}</td>
      <td>${authCan('nursing.edit') ? '<button class="btn-action">✎</button>' : ''}${authCan('nursing.delete') ? '<button class="btn-action btn-action--delete">✕</button>' : ''}</td>
    `,
    nebulizations: `
      <td>${record.date}</td>
      <td>${record.patient}</td>
      <td>${record.medication}</td>
      <td>${record.dosage}</td>
      <td>${record.duration}</td>
      <td>${record.responsible}</td>
      <td>${record.observations}</td>
      <td>${authCan('nursing.edit') ? '<button class="btn-action">✎</button>' : ''}${authCan('nursing.delete') ? '<button class="btn-action btn-action--delete">✕</button>' : ''}</td>
    `,
    contraceptives: `
      <td>${record.date}</td>
      <td>${record.patient}</td>
      <td>${record.type}</td>
      <td>${record.medication}</td>
      <td>${record.frequency}</td>
      <td class="next-date">${record.nextDate}</td>
      <td>${record.responsible}</td>
      <td>${authCan('nursing.edit') ? '<button class="btn-action">✎</button>' : ''}${authCan('nursing.delete') ? '<button class="btn-action btn-action--delete">✕</button>' : ''}</td>
    `,
    serotherapy: `
      <td>${record.date}</td>
      <td>${record.patient}</td>
      <td>${record.serumType}</td>
      <td>${record.volume}</td>
      <td>${record.speed}</td>
      <td>${record.responsible}</td>
      <td>${record.observations}</td>
      <td>${authCan('nursing.edit') ? '<button class="btn-action">✎</button>' : ''}${authCan('nursing.delete') ? '<button class="btn-action btn-action--delete">✕</button>' : ''}</td>
    `,
    physiotherapy: `
      <td>${record.date}</td>
      <td>${record.patient}</td>
      <td>${record.therapyType}</td>
      <td>${record.area}</td>
      <td>${record.duration}</td>
      <td>${record.responsible}</td>
      <td>${record.state}</td>
      <td>${authCan('nursing.edit') ? '<button class="btn-action">✎</button>' : ''}${authCan('nursing.delete') ? '<button class="btn-action btn-action--delete">✕</button>' : ''}</td>
    `
  };

  row.innerHTML = rowContent[tabType] || '';

  // Add delete functionality
  const deleteBtn = row.querySelector('.btn-action--delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      deleteRecord(tabType, record.id);
      renderTable(tabType);
    });
  }

  return row;
}

function deleteRecord(tabType, recordId) {
  const records = nursingState.records[tabType];
  const index = records.findIndex(r => r.id === recordId);
  if (index > -1) {
    records.splice(index, 1);
  }
}

// New Record Button
function setupNewRecordButton() {
  const newRecordBtn = document.getElementById('newRecordBtn');
  if (newRecordBtn) {
    newRecordBtn.addEventListener('click', () => openModal());
  }
}

// Global Search
const globalSearch = document.getElementById('globalSearch');
if (globalSearch) {
  globalSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const currentTab = nursingState.currentTab;
    const records = nursingState.records[currentTab];

    const filtered = records.filter(record => {
      return JSON.stringify(record).toLowerCase().includes(searchTerm);
    });

    renderFilteredTable(currentTab, filtered);
  });
}
