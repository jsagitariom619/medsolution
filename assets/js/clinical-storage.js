// MedSolution Storage Adapter — único punto de acceso a la persistencia clínica.
// Una futura implementación Supabase conservará esta misma interfaz.
(function initClinicalStorage(global) {
  'use strict';

  const COUNTERS_KEY = 'medsolution.idCounters';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function readArray(key) {
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  }

  function writeArray(key, value) {
    return write(key, Array.isArray(value) ? value : []);
  }

  function nextId(namespace, existingItems = []) {
    const counters = read(COUNTERS_KEY, {});
    const maximumExisting = existingItems
      .map((item) => Number(item?.id))
      .filter(Number.isFinite)
      .reduce((maximum, id) => Math.max(maximum, id), 0);
    const next = Math.max(Number(counters[namespace]) || 0, maximumExisting) + 1;
    counters[namespace] = next;
    write(COUNTERS_KEY, counters);
    return next;
  }

  global.MedSolutionStorage = Object.freeze({ read, write, readArray, writeArray, nextId });
})(window);
