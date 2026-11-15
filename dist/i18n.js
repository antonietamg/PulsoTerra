(function () {
  'use strict';
  const key = 'pulsoterra-language';
  const normalize = text => text.trim().replace(/\s+/g, ' ');
  const exact = new Map();
  const patterns = [];
  for (const dictionary of [window.PulsoContentTranslations, window.PulsoGalleryTranslations, window.PulsoAppTranslations, window.PulsoGuideTranslations, window.PulsoAccessibilityTranslations]) {
    if (!dictionary) continue;
    for (const [source, translation] of Object.entries(dictionary.exact || {})) exact.set(normalize(source), translation);
    for (const pattern of dictionary.patterns || []) patterns.push({expression: new RegExp(pattern.source, pattern.flags || ''), replacement: pattern.replacement});
  }
  for (const [source, translation] of Object.entries({
    'Idioma': 'Language',
    'Tipografía para dislexia': 'Dyslexia-friendly font',
    'Usar OpenDyslexic': 'Use OpenDyslexic',
    'Volver a la tipografía estándar': 'Use the standard font'
  })) exact.set(source, translation);
  for (const [label, short, english] of [
    ['Disponibilidad de agua', 'Agua', 'Water'],
    ['Biodiversidad y ecosistemas', 'Biodiversidad', 'Biodiversity'],
    ['Impactos en bosques', 'Bosques', 'Forests'],
    ['Impactos en océanos', 'Océanos', 'Oceans'],
    ['Vida marina', 'Vida marina', 'Marine life'],
    ['Impactos en personas', 'Personas', 'People'],
    ['Deshielo de glaciares y capas de hielo', 'Deshielo', 'Ice melt'],
    ['Impactos económicos', 'Economía', 'Economy']
  ]) {
    exact.set('Seleccionar tema ' + label, 'Select the ' + english.toLowerCase() + ' soundscape');
    exact.set(short.toUpperCase(), english.toUpperCase());
  }

  function translate(source, depth = 0) {
    const text = normalize(String(source));
    if (!text) return text;
    if (['PulsoTerra', 'Pulso', 'Terra'].includes(text)) return text;
    if (exact.has(text)) return exact.get(text);
    let output = text;
    for (const {expression, replacement} of patterns) {
      expression.lastIndex = 0;
      if (expression.test(output)) {
        expression.lastIndex = 0;
        output = output.replace(expression, replacement);
        break;
      }
    }
    if (depth < 2) {
      const parts = output.split(/(\s+·\s+|\s+\/\s+|\s+→\s+|\s+↔\s+)/);
      if (parts.length > 1) output = parts.map((part, index) => index % 2 ? part : translate(part, depth + 1)).join('');
    }
    return output.replace(/(\d+),(\d+)(?=\s*(?:°C|semitones|×))/g, '$1.$2').replace(/(\d)\s+%/g, '$1%');
  }
  let language = 'en';
  try { if (localStorage.getItem(key) === 'es') language = 'es'; } catch (_) {}
  const sources = new WeakMap();
  const attributes = new WeakMap();
  const names = ['title', 'alt', 'aria-label', 'aria-valuetext', 'placeholder'];
  const skip = element => element && element.closest('script,style,textarea,code,pre,[data-no-i18n]');
  function textNode(node) {
    if (!node.parentElement || skip(node.parentElement)) return;
    const current = node.nodeValue;
    const prior = sources.get(node);
    const source = prior && current === prior.rendered ? prior.source : current;
    let rendered = source;
    if (language === 'en' && source.trim()) {
      const leading = source.match(/^\s*/)[0], trailing = source.match(/\s*$/)[0];
      rendered = leading + translate(source) + trailing;
    }
    sources.set(node, {source, rendered});
    if (current !== rendered) node.nodeValue = rendered;
  }
  function attribute(element, name) {
    if (skip(element) || !element.hasAttribute(name)) return;
    const current = element.getAttribute(name);
    let record = attributes.get(element);
    if (!record) { record = new Map(); attributes.set(element, record); }
    const prior = record.get(name);
    const source = prior && current === prior.rendered ? prior.source : current;
    const rendered = language === 'en' ? translate(source) : source;
    record.set(name, {source, rendered});
    if (current !== rendered) element.setAttribute(name, rendered);
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { textNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || skip(root)) return;
    for (const name of names) attribute(root, name);
    for (const child of root.childNodes) walk(child);
  }
  function syncControls() {
    document.documentElement.lang = language;
    document.querySelectorAll('[data-language-select]').forEach(select => { select.value = language; });
  }
  function setLanguage(next) {
    language = next === 'es' ? 'es' : 'en';
    try { localStorage.setItem(key, language); } catch (_) {}
    syncControls();
    walk(document.documentElement);
    const description = document.querySelector('meta[name="description"]');
    if (description) attribute(description, 'content');
  }
  syncControls();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') textNode(record.target);
      else if (record.type === 'attributes') attribute(record.target, record.attributeName);
      else for (const child of record.addedNodes) walk(child);
    }
  });
  observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: names});
  function initialize() {
    setLanguage(language);
    document.querySelectorAll('[data-language-select]').forEach(select => select.addEventListener('change', () => setLanguage(select.value)));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { let next = 'en'; try { next = localStorage.getItem(key) || 'en'; } catch (_) {} setLanguage(next); } });
  window.PulsoI18n = {translate, setLanguage, get language() { return language; }};
})();
