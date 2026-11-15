(function () {
  'use strict';
  const key = 'pulsoterra-font';
  const root = document.documentElement;
  function savedFont() {
    try { return localStorage.getItem(key) === 'opendyslexic'; }
    catch (_) { return false; }
  }
  function apply(enabled) {
    root.classList.toggle('font-dyslexia', enabled);
    document.querySelectorAll('[data-font-preference]').forEach(button => {
      button.setAttribute('aria-pressed', String(enabled));
      button.title = enabled ? 'Volver a la tipografía estándar' : 'Usar OpenDyslexic';
      const mark = button.querySelector('[data-font-mark]');
      if (mark) mark.textContent = enabled ? '✓' : 'Aa';
    });
  }
  apply(savedFont());
  function initialize() {
    apply(root.classList.contains('font-dyslexia'));
    document.querySelectorAll('[data-font-preference]').forEach(button => {
      button.addEventListener('click', () => {
        const enabled = !root.classList.contains('font-dyslexia');
        apply(enabled);
        try { localStorage.setItem(key, enabled ? 'opendyslexic' : 'standard'); }
        catch (_) { /* The font remains available if local storage is disabled. */ }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(savedFont());
  });
})();
