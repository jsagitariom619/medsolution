(() => {
  const specialties = [
    { key: 'inyectables', label: 'Inyectables 💊' },
    { key: 'curaciones', label: 'Curaciones 🩹' },
    { key: 'nebulizaciones', label: 'Nebulizaciones ☁️' },
    { key: 'anticonceptivos', label: 'Anticonceptivos 🔬' },
    { key: 'sueroterapia', label: 'Sueroterapia 💉' },
    { key: 'fisioterapia', label: 'Fisioterapia 🏥' },
  ];

  const specialtyFields = {
    inyectables: [
      { key: 'medication', label: 'Medicamento', required: true },
      { key: 'dose', label: 'Dosis', required: true },
      { key: 'route', label: 'Vía (IM/IV/SC/Oral)', required: true },
      { key: 'reaction', label: 'Reacción adversa' },
    ],
    curaciones: [
      { key: 'injuryType', label: 'Tipo de lesión', required: true },
      { key: 'location', label: 'Localización', required: true },
      { key: 'materials', label: 'Materiales usados', required: true },
      { key: 'healingState', label: 'Estado de cicatrización' },
    ],
    nebulizaciones: [
      { key: 'medication', label: 'Medicamento', required: true },
      { key: 'dose', label: 'Dosis', required: true },
      { key: 'duration', label: 'Duración (min)', required: true, type: 'number' },
      { key: 'tolerance', label: 'Tolerancia' },
    ],
    anticonceptivos: [
      { key: 'method', label: 'Método', required: true },
      { key: 'dose', label: 'Dosis', required: true },
      { key: 'frequencyDays', label: 'Frecuencia (días)', required: true, type: 'number' },
      { key: 'nextDose', label: 'Próxima dosis' },
    ],
    sueroterapia: [
      { key: 'fluidType', label: 'Tipo de suero', required: true },
      { key: 'volume', label: 'Volumen (ml)', required: true, type: 'number' },
      { key: 'rate', label: 'Velocidad de infusión', required: true },
      { key: 'duration', label: 'Duración (min)', type: 'number' },
    ],
    fisioterapia: [
      { key: 'therapyType', label: 'Tratamiento', required: true },
      { key: 'area', label: 'Área tratada', required: true },
      { key: 'duration', label: 'Duración (min)', required: true, type: 'number' },
      { key: 'evolution', label: 'Evolución' },
    ],
  };

  const demoRecords = [
    { specialty: 'inyectables', date: '2026-07-05', patient: 'María López', nurse: 'Lic. Ana Pérez', notes: 'Sin complicaciones', details: { medication: 'Diclofenaco', dose: '75mg', route: 'IM', reaction: 'Ninguna' } },
    { specialty: 'inyectables', date: '2026-07-09', patient: 'Carlos Rojas', nurse: 'Lic. Ana Pérez', notes: 'Dolor leve posterior', details: { medication: 'Ceftriaxona', dose: '1g', route: 'IV', reaction: 'Dolor local' } },
    { specialty: 'curaciones', date: '2026-07-03', patient: 'Lucía Torres', nurse: 'Lic. Marta Ruiz', notes: 'Evolución favorable', details: { injuryType: 'Úlcera venosa', location: 'Pierna derecha', materials: 'Gasas y suero', healingState: 'Granulación' } },
    { specialty: 'curaciones', date: '2026-07-11', patient: 'Pedro Méndez', nurse: 'Lic. Marta Ruiz', notes: 'Sin signos de infección', details: { injuryType: 'Herida quirúrgica', location: 'Abdomen', materials: 'Apósitos estériles', healingState: 'Cierre parcial' } },
    { specialty: 'nebulizaciones', date: '2026-07-06', patient: 'Sofía Vargas', nurse: 'Lic. Elena Díaz', notes: 'Buena tolerancia', details: { medication: 'Salbutamol', dose: '2.5mg', duration: '15', tolerance: 'Buena' } },
    { specialty: 'nebulizaciones', date: '2026-07-13', patient: 'Juan Campos', nurse: 'Lic. Elena Díaz', notes: 'Se indica continuar', details: { medication: 'Budesonida', dose: '0.5mg', duration: '20', tolerance: 'Regular' } },
    { specialty: 'anticonceptivos', date: '2026-07-02', patient: 'Andrea Salas', nurse: 'Lic. Carla León', notes: 'Control mensual', details: { method: 'Mesigyna', dose: '1 ampolla', frequencyDays: '30', nextDose: '2026-08-01' } },
    { specialty: 'anticonceptivos', date: '2026-07-10', patient: 'Rosa Medina', nurse: 'Lic. Carla León', notes: 'Aplicación normal', details: { method: 'Depoprovera', dose: '150mg', frequencyDays: '90', nextDose: '2026-10-08' } },
    { specialty: 'sueroterapia', date: '2026-07-04', patient: 'Miguel Arias', nurse: 'Lic. José Silva', notes: 'Hidratación moderada', details: { fluidType: 'SSN 0.9%', volume: '1000', rate: '125 ml/h', duration: '480' } },
    { specialty: 'sueroterapia', date: '2026-07-12', patient: 'Teresa Núñez', nurse: 'Lic. José Silva', notes: 'Paciente estable', details: { fluidType: 'Dextrosa 5%', volume: '500', rate: '80 ml/h', duration: '360' } },
    { specialty: 'fisioterapia', date: '2026-07-07', patient: 'Daniela Cruz', nurse: 'Lic. Laura Peña', notes: 'Mejoría de movilidad', details: { therapyType: 'Ejercicios terapéuticos', area: 'Hombro izquierdo', duration: '30', evolution: 'Positiva' } },
    { specialty: 'fisioterapia', date: '2026-07-14', patient: 'Ernesto Gil', nurse: 'Lic. Laura Peña', notes: 'Dolor disminuido', details: { therapyType: 'Terapia manual', area: 'Zona lumbar', duration: '40', evolution: 'Estable' } },
  ];

  const page = document.querySelector('.nursing-page');
  if (!page) return;

  const refs = {
    tabs: document.getElementById('specialty-tabs'),
    tbody: document.getElementById('records-table-body'),
    title: document.getElementById('table-title'),
    count: document.getElementById('record-count'),
    globalSearch: document.getElementById('global-search'),
    filterStart: document.getElementById('filter-date-start'),
    filterEnd: document.getElementById('filter-date-end'),
    filterPatient: document.getElementById('filter-patient'),
    filterNurse: document.getElementById('filter-nurse'),
    clearFilters: document.getElementById('clear-filters'),
    openModal: document.getElementById('new-record-btn'),
    closeModal: document.getElementById('close-modal'),
    cancelModal: document.getElementById('cancel-modal'),
    modal: document.getElementById('record-modal'),
    form: document.getElementById('record-form'),
    formId: document.getElementById('record-id'),
    formSpecialty: document.getElementById('form-specialty'),
    formDate: document.getElementById('form-date'),
    formPatient: document.getElementById('form-patient'),
    formNurse: document.getElementById('form-nurse'),
    formNotes: document.getElementById('form-notes'),
    dynamicFields: document.getElementById('dynamic-fields'),
  };

  const state = {
    activeSpecialty: specialties[0].key,
    records: demoRecords.map((record, index) => ({ ...record, id: index + 1 })),
  };

  const getSpecialtyLabel = (key) => specialties.find((specialty) => specialty.key === key)?.label ?? key;

  const formatSummary = (record) => {
    const fields = specialtyFields[record.specialty] ?? [];
    const summary = fields
      .slice(0, 3)
      .map((field) => {
        const value = record.details[field.key];
        return value ? `${field.label}: ${value}` : null;
      })
      .filter(Boolean)
      .join(' · ');

    return summary || 'Sin detalle adicional';
  };

  const refreshNurseFilter = () => {
    const previous = refs.filterNurse.value;
    const nurses = [...new Set(state.records.map((record) => record.nurse))].sort();
    refs.filterNurse.innerHTML = '<option value="">Todas</option>';
    nurses.forEach((nurse) => {
      const option = document.createElement('option');
      option.value = nurse;
      option.textContent = nurse;
      refs.filterNurse.append(option);
    });
    refs.filterNurse.value = nurses.includes(previous) ? previous : '';
  };

  const getFilteredRecords = () => {
    const search = refs.globalSearch.value.trim().toLowerCase();
    const start = refs.filterStart.value;
    const end = refs.filterEnd.value;
    const patient = refs.filterPatient.value.trim().toLowerCase();
    const nurse = refs.filterNurse.value;

    return state.records
      .filter((record) => record.specialty === state.activeSpecialty)
      .filter((record) => (!start || record.date >= start) && (!end || record.date <= end))
      .filter((record) => !patient || record.patient.toLowerCase().includes(patient))
      .filter((record) => !nurse || record.nurse === nurse)
      .filter((record) => {
        if (!search) return true;
        const detailText = Object.values(record.details).join(' ').toLowerCase();
        const baseText = `${record.patient} ${record.nurse} ${record.notes}`.toLowerCase();
        return `${baseText} ${detailText}`.includes(search);
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  };

  const renderTable = () => {
    const records = getFilteredRecords();
    refs.title.textContent = `Registros · ${getSpecialtyLabel(state.activeSpecialty)}`;
    refs.count.textContent = `${records.length} ${records.length === 1 ? 'registro' : 'registros'}`;

    if (!records.length) {
      refs.tbody.innerHTML = '<tr><td class="nursing-empty" colspan="5">No hay registros para los filtros seleccionados.</td></tr>';
      return;
    }

    refs.tbody.innerHTML = records
      .map(
        (record) => `
          <tr>
            <td>${record.date}</td>
            <td>${record.patient}</td>
            <td>${record.nurse}</td>
            <td><strong>${formatSummary(record)}</strong><br /><small>${record.notes || 'Sin observaciones'}</small></td>
            <td>
              <div class="row-actions">
                <button type="button" data-action="edit" data-id="${record.id}">Editar</button>
                <button type="button" data-action="delete" data-id="${record.id}">Eliminar</button>
              </div>
            </td>
          </tr>
        `,
      )
      .join('');
  };

  const renderTabs = () => {
    refs.tabs.innerHTML = '';
    specialties.forEach((specialty) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'nursing-tab';
      tab.role = 'tab';
      tab.textContent = specialty.label;
      tab.setAttribute('aria-selected', specialty.key === state.activeSpecialty ? 'true' : 'false');
      tab.addEventListener('click', () => {
        state.activeSpecialty = specialty.key;
        renderTabs();
        renderTable();
      });
      refs.tabs.append(tab);
    });
  };

  const renderSpecialtyOptions = () => {
    refs.formSpecialty.innerHTML = specialties
      .map((specialty) => `<option value="${specialty.key}">${specialty.label}</option>`)
      .join('');
  };

  const renderDynamicFields = (specialtyKey, values = {}) => {
    const fields = specialtyFields[specialtyKey] ?? [];
    refs.dynamicFields.innerHTML = fields
      .map((field) => {
        const type = field.type || 'text';
        const required = field.required ? 'required' : '';
        const value = values[field.key] ?? '';
        return `
          <label class="dynamic-field">
            <span>${field.label}</span>
            <input name="detail-${field.key}" type="${type}" value="${value}" ${required} />
          </label>
        `;
      })
      .join('');
  };

  const resetForm = () => {
    refs.form.reset();
    refs.formId.value = '';
    refs.formSpecialty.value = state.activeSpecialty;
    refs.formDate.value = new Date().toISOString().slice(0, 10);
    renderDynamicFields(state.activeSpecialty);
  };

  const setModalOpen = (open) => {
    refs.modal.classList.toggle('is-open', open);
    refs.modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const collectDetailsFromForm = (specialty) => {
    const details = {};
    (specialtyFields[specialty] ?? []).forEach((field) => {
      const input = refs.form.querySelector(`[name="detail-${field.key}"]`);
      details[field.key] = input?.value?.trim() ?? '';
    });

    if (specialty === 'anticonceptivos') {
      const frequency = Number.parseInt(details.frequencyDays, 10);
      if (Number.isFinite(frequency) && refs.formDate.value) {
        const date = new Date(refs.formDate.value);
        date.setDate(date.getDate() + frequency);
        details.nextDose = date.toISOString().slice(0, 10);
      }
    }

    return details;
  };

  const openForEdit = (record) => {
    refs.formId.value = String(record.id);
    refs.formSpecialty.value = record.specialty;
    refs.formDate.value = record.date;
    refs.formPatient.value = record.patient;
    refs.formNurse.value = record.nurse;
    refs.formNotes.value = record.notes;
    renderDynamicFields(record.specialty, record.details);
    setModalOpen(true);
  };

  refs.formSpecialty.addEventListener('change', () => {
    renderDynamicFields(refs.formSpecialty.value);
  });

  refs.form.addEventListener('submit', (event) => {
    event.preventDefault();

    const specialty = refs.formSpecialty.value;
    const payload = {
      specialty,
      date: refs.formDate.value,
      patient: refs.formPatient.value.trim(),
      nurse: refs.formNurse.value.trim(),
      notes: refs.formNotes.value.trim(),
      details: collectDetailsFromForm(specialty),
    };

    if (!payload.date || !payload.patient || !payload.nurse) return;

    const existingId = Number.parseInt(refs.formId.value, 10);
    if (Number.isFinite(existingId)) {
      state.records = state.records.map((record) => (record.id === existingId ? { ...record, ...payload } : record));
    } else {
      const id = Math.max(0, ...state.records.map((record) => record.id)) + 1;
      state.records.push({ id, ...payload });
    }

    state.activeSpecialty = specialty;
    refreshNurseFilter();
    renderTabs();
    renderTable();
    setModalOpen(false);
  });

  refs.tbody.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;

    const id = Number.parseInt(target.getAttribute('data-id') ?? '', 10);
    if (!Number.isFinite(id)) return;
    const record = state.records.find((item) => item.id === id);
    if (!record) return;

    if (target.dataset.action === 'edit') {
      openForEdit(record);
      return;
    }

    if (target.dataset.action === 'delete' && window.confirm('¿Deseas eliminar este registro?')) {
      state.records = state.records.filter((item) => item.id !== id);
      refreshNurseFilter();
      renderTable();
    }
  });

  [refs.globalSearch, refs.filterStart, refs.filterEnd, refs.filterPatient, refs.filterNurse].forEach((input) => {
    input.addEventListener('input', renderTable);
    input.addEventListener('change', renderTable);
  });

  refs.clearFilters.addEventListener('click', () => {
    refs.filterStart.value = '';
    refs.filterEnd.value = '';
    refs.filterPatient.value = '';
    refs.filterNurse.value = '';
    refs.globalSearch.value = '';
    renderTable();
  });

  refs.openModal.addEventListener('click', () => {
    resetForm();
    setModalOpen(true);
  });

  [refs.closeModal, refs.cancelModal].forEach((button) => {
    button.addEventListener('click', () => setModalOpen(false));
  });

  refs.modal.addEventListener('click', (event) => {
    if (event.target === refs.modal) setModalOpen(false);
  });

  renderSpecialtyOptions();
  refreshNurseFilter();
  renderTabs();
  resetForm();
  renderTable();
})();
