(function initializeMedSolutionAvatar(global) {
  'use strict';

  function initials(name, fallback = 'MS') {
    const value = String(name || '').trim();
    if (!value) return fallback;
    return value.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toLocaleUpperCase('es');
  }

  function apply(element, profile = {}) {
    if (!element) return;
    const label = String(profile.name || 'Usuario').trim();
    const fallback = String(profile.initials || initials(label)).slice(0, 2).toLocaleUpperCase('es');
    const photoUrl = String(profile.photoUrl || '').trim();

    element.classList.add('medsolution-avatar');
    element.classList.remove('medsolution-avatar--photo');
    element.replaceChildren();
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', `Fotografía de ${label}`);

    const fallbackNode = document.createElement('span');
    fallbackNode.className = 'medsolution-avatar__initials';
    fallbackNode.textContent = fallback;
    element.appendChild(fallbackNode);

    if (!photoUrl) return;
    const image = document.createElement('img');
    image.className = 'medsolution-avatar__image';
    image.alt = '';
    image.decoding = 'async';
    image.addEventListener('load', () => element.classList.add('medsolution-avatar--photo'), { once: true });
    image.addEventListener('error', () => {
      element.classList.remove('medsolution-avatar--photo');
      image.remove();
    }, { once: true });
    image.src = photoUrl;
    element.appendChild(image);
  }

  function applyAll(profile, root = document) {
    root.querySelectorAll('[data-user-avatar], [data-doctor-avatar]').forEach((element) => apply(element, profile));
  }

  global.MedSolutionAvatar = Object.freeze({ apply, applyAll, initials });
})(window);
