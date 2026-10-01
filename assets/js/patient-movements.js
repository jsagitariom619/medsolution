(function exposePatientMovementReport(global) {
  'use strict';

  const COMPLETED_STATUSES = new Set(['Atendida', 'Finalizada']);

  function buildRows(attentions = []) {
    const seenIds = new Set();
    return (Array.isArray(attentions) ? attentions : [])
      .filter((item) => item && item.scheduledOnly !== true && item.contraceptiveSchedule !== true)
      .filter((item) => {
        const id = item.remoteId ?? item.id;
        if (id == null || id === '') return true;
        const key = String(id);
        if (seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      })
      .map((item) => {
        const createdAt = String(item.createdAt || '');
        const price = Number(item.servicePrice);
        return {
          id: String(item.remoteId ?? item.id ?? ''),
          patientId: item.patientId == null ? '' : String(item.patientId),
          patientName: String(item.patientName || '').trim(),
          date: String(item.date || createdAt.slice(0, 10)).slice(0, 10),
          time: String(item.time || createdAt.slice(11, 16)).slice(0, 5),
          service: String(item.serviceType || '').trim(),
          responsible: String(item.procedureResponsible || '').trim(),
          status: String(item.status || '').trim(),
          costCents: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : 0,
        };
      });
  }

  function filterRows(rows, filters = {}) {
    return rows.filter((row) =>
      (!filters.from || row.date >= filters.from)
      && (!filters.to || row.date <= filters.to)
      && (!filters.patientId || row.patientId === String(filters.patientId))
      && (!filters.service || row.service === filters.service)
      && (!filters.responsible || row.responsible === filters.responsible)
      && (!filters.status || row.status === filters.status));
  }

  function summarize(rows) {
    const completed = rows.filter((row) => COMPLETED_STATUSES.has(row.status));
    const patients = new Set(completed.map((row) => row.patientId || row.patientName).filter(Boolean));
    return {
      movements: rows.length,
      patients: patients.size,
      completedServices: completed.length,
      totalCents: completed.reduce((sum, row) => sum + row.costCents, 0),
    };
  }

  function isCompleted(status) {
    return COMPLETED_STATUSES.has(status);
  }

  function formatMoney(cents) {
    const amount = (Number.isFinite(Number(cents)) ? Number(cents) : 0) / 100;
    return `${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} Bs`;
  }

  global.MedSolutionPatientMovements = { buildRows, filterRows, summarize, isCompleted, formatMoney };
})(window);
