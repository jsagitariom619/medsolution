(function initializePatientAutocomplete(global) {
  'use strict';

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  }

  function patientName(patient) {
    return `${patient?.nombre || ''} ${patient?.apellido || ''}`.trim().replace(/\s+/g, ' ');
  }

  function create(options) {
    const root = typeof options.root === 'string' ? document.querySelector(options.root) : options.root;
    if (!root) throw new Error('No se encontró el contenedor del buscador de pacientes.');
    const input = root.querySelector('[data-patient-autocomplete-input]');
    const valueInput = root.querySelector('[data-patient-autocomplete-value]');
    const results = root.querySelector('[data-patient-autocomplete-results]');
    const selected = root.querySelector('[data-patient-autocomplete-selected]');
    let patients = options.patients || [];
    let medicalRecords = options.medicalRecords || [];
    let selectedPatient = null;

    function historyFor(patientId) {
      return medicalRecords.find((record) => Number(record.patientId) === Number(patientId));
    }

    function showSelection(patient) {
      selectedPatient = patient || null;
      valueInput.value = patient?.id || '';
      if (!patient) {
        selected.hidden = true;
        selected.innerHTML = '';
        return;
      }
      const history = historyFor(patient.id);
      input.value = patientName(patient);
      selected.hidden = false;
      selected.innerHTML = `<div><strong>${escapeHtml(patientName(patient))}</strong><small>CI: ${escapeHtml(patient.ci || 'Sin CI')} · Tel: ${escapeHtml(patient.telefono || 'Sin teléfono')}${history?.id ? ` · HC: ${escapeHtml(history.id)}` : ''}</small></div><button type="button" data-clear-patient aria-label="Cambiar paciente">×</button>`;
      results.hidden = true;
      options.onSelect?.(patient, history || null);
    }

    function render(query = '') {
      const term = normalize(query);
      if (!term) {
        results.innerHTML = '<p class="patient-autocomplete__empty">Escribe un nombre, CI, teléfono o número de Historia Clínica.</p>';
        results.hidden = false;
        return;
      }
      const matches = patients.filter((patient) => {
        const history = historyFor(patient.id);
        return normalize(`${patientName(patient)} ${patient.ci || ''} ${patient.telefono || ''} ${history?.id || ''}`).includes(term);
      }).slice(0, 10);
      results.innerHTML = matches.length ? matches.map((patient) => {
        const history = historyFor(patient.id);
        return `<button type="button" class="patient-autocomplete__result" data-patient-result="${patient.id}"><strong>${escapeHtml(patientName(patient))}</strong><small>CI: ${escapeHtml(patient.ci || 'Sin CI')} · Tel: ${escapeHtml(patient.telefono || 'Sin teléfono')}</small>${history?.id ? `<em>HC: ${escapeHtml(history.id)}</em>` : ''}</button>`;
      }).join('') : '<p class="patient-autocomplete__empty">No se encontraron pacientes.</p>';
      results.hidden = false;
    }

    input.addEventListener('input', () => {
      if (selectedPatient && input.value !== patientName(selectedPatient)) {
        selectedPatient = null;
        valueInput.value = '';
        selected.hidden = true;
      }
      render(input.value);
    });
    input.addEventListener('focus', () => render(input.value));
    results.addEventListener('click', (event) => {
      const choice = event.target.closest('[data-patient-result]');
      if (!choice) return;
      showSelection(patients.find((patient) => Number(patient.id) === Number(choice.dataset.patientResult)));
    });
    selected.addEventListener('click', (event) => {
      if (!event.target.closest('[data-clear-patient]')) return;
      showSelection(null); input.value = ''; input.focus(); render('');
    });
    document.addEventListener('click', (event) => {
      if (!root.contains(event.target)) results.hidden = true;
    });

    return Object.freeze({
      select(patientId) { showSelection(patients.find((patient) => Number(patient.id) === Number(patientId))); },
      clear() { selectedPatient = null; valueInput.value = ''; input.value = ''; selected.hidden = true; results.hidden = true; },
      value() { return selectedPatient; },
      update(nextPatients, nextRecords = medicalRecords) { patients = nextPatients || []; medicalRecords = nextRecords || []; if (valueInput.value) this.select(valueInput.value); },
    });
  }

  global.MedSolutionPatientAutocomplete = Object.freeze({ create });
})(window);
