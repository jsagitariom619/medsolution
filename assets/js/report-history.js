(function exposeReportHistory(global, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.MedSolutionReportHistory = api;
})(typeof window !== 'undefined' ? window : globalThis, function createReportHistory() {
  'use strict';

  const SIMULATED_YEARS = new Set(['2024', '2025']);

  function sourceForYear(year, productionRows, historicalSources = {}) {
    const selectedYear = String(year || '');
    if (SIMULATED_YEARS.has(selectedYear)) {
      const source = historicalSources[selectedYear];
      return Array.isArray(source) ? source : [];
    }
    // Production data is returned as-is. Historical arrays are never appended to it.
    return Array.isArray(productionRows) ? productionRows : [];
  }

  function isSimulatedYear(year) {
    return SIMULATED_YEARS.has(String(year || ''));
  }

  function filterRows(rows, filters = {}) {
    const source = Array.isArray(rows) ? rows : [];
    const monthMatches = (date) => {
      const month = Number(String(date || '').slice(5, 7));
      if (!filters.month) return true;
      if (filters.month === '01-09') return month >= 1 && month <= 9;
      return String(date || '').slice(5, 7) === filters.month;
    };
    return source.filter((row) =>
      (!filters.patient || String(row.patientId || row.patientName || '') === filters.patient)
      && (!filters.service || row.serviceType === filters.service)
      && (!filters.responsible || (row.procedureResponsible || row.scheduledProfessional) === filters.responsible)
      && (!filters.status || row.status === filters.status)
      && (!filters.year || String(row.date || '').slice(0, 4) === filters.year)
      && monthMatches(row.date));
  }

  function hydrateDataset(dataset) {
    const year = Number(dataset?.year);
    const yearKey = String(year);
    if (!isSimulatedYear(yearKey) || dataset?.source !== `historical_${yearKey}_simulated`
      || !Array.isArray(dataset?.patientNames) || !Array.isArray(dataset?.services)
      || !Array.isArray(dataset?.responsibles) || !Array.isArray(dataset?.months)
      || dataset.months.length !== 12) {
      throw new Error('La fuente histórica no tiene una estructura válida.');
    }
    const prefix = yearKey.slice(-2);
    let sequence = 0;
    return dataset.months.flatMap((monthRows, monthIndex) => {
      if (!Array.isArray(monthRows)) throw new Error(`El mes ${monthIndex + 1} del histórico no es válido.`);
      const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      return monthRows.map((row) => {
        if (!Array.isArray(row) || row.length !== 6) throw new Error(`Un movimiento del mes ${monthIndex + 1} no es válido.`);
        const [day, timeSlot, patientIndex, serviceIndex, responsibleIndex, statusIndex] = row.map(Number);
        if (!Number.isInteger(day) || day < 1 || day > daysInMonth
          || !Number.isInteger(patientIndex) || !dataset.patientNames[patientIndex]
          || !Number.isInteger(serviceIndex) || !Array.isArray(dataset.services[serviceIndex])
          || !Number.isInteger(responsibleIndex) || !dataset.responsibles[responsibleIndex]
          || ![0, 1].includes(statusIndex)) {
          throw new Error(`Un movimiento del mes ${monthIndex + 1} contiene valores fuera de rango.`);
        }
        const hour = Math.floor(timeSlot / 6);
        const minute = (timeSlot % 6) * 10;
        if (!Number.isInteger(timeSlot) || hour < 0 || hour > 23) throw new Error('La hora de un movimiento no es válida.');
        const [serviceType, servicePrice] = dataset.services[serviceIndex];
        const responsible = dataset.responsibles[responsibleIndex];
        sequence += 1;
        return {
          id: `hist${prefix}-${String(sequence).padStart(4, '0')}`,
          date: `${yearKey}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          patientId: `hist${prefix}-patient-${String(patientIndex + 1).padStart(3, '0')}`,
          patientName: dataset.patientNames[patientIndex],
          serviceType: String(serviceType),
          procedureResponsible: responsible,
          registeredBy: responsible,
          status: statusIndex === 0 ? 'Finalizada' : 'Atendida',
          servicePrice: Number(servicePrice),
          source: `historical_${yearKey}_simulated`,
        };
      });
    });
  }

  function simulatedNotice(year) {
    if (!isSimulatedYear(year)) return '';
    return `REPORTE SIMULADO ${year}: los pacientes, movimientos y montos son ficticios; no representan actividad clínica ni contable real.`;
  }

  function alignServiceNames(movements, services) {
    const catalogNames = [...new Set((Array.isArray(services) ? services : [])
      .map((service) => String(service?.name || '').trim()).filter(Boolean))];
    if (!catalogNames.length) return Array.isArray(movements) ? movements : [];
    const catalog = new Set(catalogNames);
    let fallbackIndex = 0;
    return (Array.isArray(movements) ? movements : []).map((movement) => {
      if (catalog.has(movement.serviceType)) return movement;
      const aligned = { ...movement, serviceType: catalogNames[fallbackIndex % catalogNames.length] };
      fallbackIndex += 1;
      return aligned;
    });
  }

  return Object.freeze({ sourceForYear, filterRows, isSimulatedYear, simulatedNotice, alignServiceNames, hydrateDataset });
});
