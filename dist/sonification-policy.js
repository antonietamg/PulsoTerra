(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SonificationPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCALES = Object.freeze({ major: Object.freeze([0, 2, 4, 5, 7, 9, 11]), minor: Object.freeze([0, 2, 3, 5, 7, 8, 10]) });
  var bibliography = Object.freeze([
    Object.freeze({
      id: 'spence2020',
      title: 'Spence 2020 · Temperature-Based Crossmodal Correspondences',
      url: 'https://doi.org/10.1163/22134808-20191494',
      evidence: 'La sección 3.3 revisa asociaciones de frío con pitch más alto y de calor con pitch más bajo en experimentos con agua.',
      limitation: 'No establece una ley universal ni rangos de notas para anomalías climáticas.'
    }),
    Object.freeze({
      id: 'wang2017',
      title: 'Wang y Spence 2017 · The Role of Pitch and Tempo in Sound-Temperature Crossmodal Correspondences',
      url: 'https://doi.org/10.1163/22134808-00002564',
      evidence: 'En agua imaginada y real se observó frío asociado con pitch más alto. El agua caliente real se asoció con pitch más bajo que la de referencia.',
      limitation: 'La extrapolación a mapas y la conversión concreta de grados a notas son decisiones del proyecto.'
    }),
    Object.freeze({
      id: 'hamilton2018',
      title: 'Hamilton-Fletcher y colaboradores 2018 · Visual experience and cross-modal correspondences',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29502009/',
      evidence: 'Estudia cómo la experiencia visual participa de forma diferente en correspondencias de pitch con forma, tamaño, peso, textura y suavidad.',
      limitation: 'No estudia temperatura. No demuestra que esta sonificación resulte intuitiva para todas las personas ciegas.'
    }),
    Object.freeze({
      id: 'spence2011',
      title: 'Spence 2011 · Crossmodal correspondences A tutorial review',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21264748/',
      evidence: 'Ofrece el marco general de asociaciones entre atributos de diferentes modalidades sensoriales.',
      limitation: 'No prescribe los umbrales térmicos, la escala musical ni los BPM de este prototipo.'
    }),
    Object.freeze({
      id: 'aha-pulse',
      title: 'American Heart Association · All About Heart Rate',
      url: 'https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse',
      evidence: 'Describe 60–100 latidos por minuto como un rango normal frecuente para adultos en reposo.',
      limitation: '85–95 BPM está dentro de ese rango y no demuestra estrés. No relaciona anomalías climáticas con BPM.'
    }),
    Object.freeze({
      id: 'aha-tachycardia',
      title: 'American Heart Association · Tachycardia Fast Heart Rate',
      url: 'https://www.heart.org/en/health-topics/arrhythmia/about-arrhythmia/tachycardia--fast-heart-rate',
      evidence: 'Describe taquicardia como pulso en reposo superior a 100 BPM y distingue sus distintos orígenes.',
      limitation: 'Una velocidad no identifica por sí sola ritmo sinusal ni arritmia. Los latidos de la app son una metáfora expresiva.'
    }),
    Object.freeze({
      id: 'aha-guideline2017',
      title: '2017 AHA ACC HRS Guideline for Ventricular Arrhythmias and Prevention of Sudden Cardiac Death',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29084731/',
      evidence: 'Es la guía a la que corresponde el DOI 10.1161/CIR.0000000000000549, publicada en el volumen de 2018.',
      limitation: 'No establece una equivalencia entre temperatura global, homeostasis, taquicardia o arritmia clínica.'
    }),
    Object.freeze({
      id: 'vivaldi',
      title: 'Nashville Symphony · Vivaldi The Four Seasons',
      url: 'https://www.nashvillesymphony.org/classical-program-notes/antonio-vivaldi-the-four-seasons-for-violin-and-orchestra-op-8-nos-1-4/',
      evidence: 'Las tonalidades principales son Mi mayor en Primavera, Sol menor en Verano, Fa mayor en Otoño y Fa menor en Invierno.',
      limitation: 'El contraste mayor y menor inspira la expresión musical. Los límites de ±1,5 °C y su interpretación no proceden de Vivaldi ni son universales.'
    })
  ]);

  function quantize(rawMidi, mode, value) {
    var intervals = SCALES[mode];
    var best = 72, distance = Infinity;
    for (var note = 60; note <= 84; note++) {
      if (intervals.indexOf(note % 12) < 0) continue;
      var delta = Math.abs(note - rawMidi);
      if (delta < distance - 1e-9 || (Math.abs(delta - distance) < 1e-9 && (value < 0 ? note > best : note < best))) {
        best = note; distance = delta;
      }
    }
    return best;
  }

  function describe(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    var magnitude = Math.abs(value);
    var mode = magnitude >= 1.5 ? 'minor' : 'major';
    var irregular = magnitude > 1.5;
    var bpm = magnitude <= .5 ? 60 : magnitude < 1 ? 90 : magnitude <= 1.5 ? 125 : 130;
    var rawMidi = 72 - 6 * Math.max(-2, Math.min(2, value));
    var label = magnitude < .25 ? 'Cerca de la referencia' : value < 0 ? 'Anomalía negativa' : 'Anomalía positiva';
    if (magnitude >= 1.5) label += ' extrema';
    return {
      value: value,
      magnitude: magnitude,
      midi: quantize(rawMidi, mode, value),
      rawMidi: rawMidi,
      bpm: bpm,
      mode: mode,
      irregular: irregular,
      variety: magnitude >= 1.5 ? 1 : Math.max(2, Math.min(5, Math.round(5 - 2 * magnitude))),
      label: label,
      tempoLabel: irregular ? 'Pulso irregular expresivo' : bpm === 125 ? 'Pulso acelerado' : bpm === 90 ? 'Pulso activo' : 'Pulso estable'
    };
  }

  var explanation = 'El frío se representa con notas más agudas y el calor con notas más graves, como inspiración de experimentos de correspondencia térmica y sonora. La distancia a la referencia acelera un latido metafórico: 60, 90, 125 o 130 BPM nominales. Se usa modo menor en |ΔT| ≥ 1,5 °C y pulso irregular cuando |ΔT| > 1,5 °C. Los umbrales, las notas y los BPM son decisiones de diseño; no describen respuestas cardíacas reales, diagnósticos ni una asociación perceptiva universal.';

  return Object.freeze({ describe: describe, bibliography: bibliography, explanation: explanation, scales: SCALES });
});
