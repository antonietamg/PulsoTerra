(function (root, factory) {
  'use strict';
  var pixels = typeof module === 'object' && module.exports ? require('./pixels.js') : root.PixelAnalysis;
  var api = factory(pixels);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AnomalyAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (pixels) {
  'use strict';
  if (!pixels) throw new Error('AnomalyAnalysis requiere PixelAnalysis antes de cargarse.');
  var points = null;
  var palette = null;
  var cache = new Map();

  function toLab(rgb) {
    var linear = Array.prototype.map.call(rgb, function (channel) {
      var n = channel / 255;
      return n <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4);
    });
    var xyz = [
      (linear[0] * .4124564 + linear[1] * .3575761 + linear[2] * .1804375) / .95047,
      linear[0] * .2126729 + linear[1] * .7151522 + linear[2] * .0721750,
      (linear[0] * .0193339 + linear[1] * .1191920 + linear[2] * .9503041) / 1.08883
    ].map(function (n) { return n > .008856 ? Math.cbrt(n) : 7.787 * n + 16 / 116; });
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
  }

  function configurePalette(input) {
    if (!Array.isArray(input)) throw new TypeError('Se requiere una paleta calibrada de RGB y anomalía.');
    var compiled = input.map(function (entry) {
      var rgb = entry && (entry.rgb || entry.color);
      var value = entry && (entry.value === undefined ? entry.anomaly : entry.value);
      if (!Array.isArray(rgb) || rgb.length < 3 || !rgb.slice(0, 3).every(function (n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255; }) || typeof value !== 'number' || !Number.isFinite(value)) return null;
      return { rgb: rgb.slice(0, 3), value: value, lab: toLab(rgb.slice(0, 3)) };
    }).filter(Boolean).sort(function (a, b) { return a.value - b.value; });
    if (!compiled.length) throw new TypeError('La paleta no contiene valores RGB válidos.');
    // Keep a separate palette reference so another caller cannot change validation silently.
    points = compiled;
    palette = points.map(function (point) { return { rgb: point.rgb, value: point.value }; });
    cache.clear();
    return { entries: points.length, min: points[0].value, max: points[points.length - 1].value };
  }

  function estimateIndex(rgba) {
    if (!points) throw new Error('Configura la paleta NASA antes de analizar una imagen.');
    if (pixels.classifyPixel(rgba, palette) < 0) return -1;
    var key = (rgba[0] << 16) | (rgba[1] << 8) | rgba[2];
    if (cache.has(key)) return cache.get(key);
    var lab = toLab(rgba.slice(0, 3));
    var nearest = 0, distance = Infinity;
    for (var i = 0; i < points.length; i++) {
      var point = points[i].lab;
      var delta = Math.pow(point[0] - lab[0], 2) + Math.pow(point[1] - lab[1], 2) + Math.pow(point[2] - lab[2], 2);
      if (delta < distance) { nearest = i; distance = delta; }
    }
    if (cache.size > 131072) cache.clear();
    cache.set(key, nearest);
    return nearest;
  }

  function estimatePixel(rgba) {
    var index = estimateIndex(rgba);
    return index < 0 ? null : points[index].value;
  }

  function median(bins, total) {
    if (!total) return null;
    var lowTarget = Math.floor((total - 1) / 2);
    var highTarget = Math.floor(total / 2);
    var cumulative = 0, low = null, high = null;
    for (var i = 0; i < bins.length; i++) {
      cumulative += bins[i];
      if (low === null && cumulative > lowTarget) low = points[i].value;
      if (cumulative > highTarget) { high = points[i].value; break; }
    }
    return (low + high) / 2;
  }

  function dominant(counts, total) {
    if (!total) return -1;
    var winner = 0;
    for (var i = 1; i < counts.length; i++) if (counts[i] > counts[winner]) winner = i;
    return winner;
  }

  function normalized(counts, total) { return counts.map(function (count) { return total ? count / total : 0; }); }

  function analyze(imageData, options) {
    options = options || {};
    if (!points) throw new Error('Configura la paleta NASA antes de analizar una imagen.');
    if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) || imageData.width < 1 || imageData.height < 1 || !imageData.data || imageData.data.length < imageData.width * imageData.height * 4) throw new TypeError('Se necesitan píxeles RGBA con ancho y alto válidos.');
    var columns = Number.isFinite(options.columns) ? Math.max(1, Math.min(128, Math.floor(options.columns))) : 32;
    var rows = Number.isFinite(options.rows) ? Math.max(1, Math.min(128, Math.floor(options.rows))) : 16;
    var mask = typeof options.mask === 'function' ? options.mask : null;
    var cells = Array.from({ length: columns * rows }, function (_, index) {
      return { col: index % columns, row: Math.floor(index / columns), value: null, category: -1, histogram: [0, 0, 0, 0, 0], counts: [0, 0, 0, 0, 0], validCount: 0, pixelCount: 0, coverage: 0 };
    });
    var cellBins = cells.map(function () { return new Uint32Array(points.length); });
    var globalBins = new Uint32Array(points.length);
    var counts = [0, 0, 0, 0, 0];
    var validCount = 0, width = imageData.width, height = imageData.height, data = imageData.data;
    for (var y = 0; y < height; y++) {
      var row = Math.min(rows - 1, Math.floor(y * rows / height));
      for (var x = 0; x < width; x++) {
        var cellIndex = row * columns + Math.min(columns - 1, Math.floor(x * columns / width));
        var cell = cells[cellIndex]; cell.pixelCount++;
        if (mask && !mask((x + .5) / width, (y + .5) / height)) continue;
        var offset = (y * width + x) * 4;
        var rgba = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
        var index = estimateIndex(rgba);
        if (index < 0) continue;
        var category = pixels.categoryForValue(points[index].value);
        cellBins[cellIndex][index]++; globalBins[index]++;
        cell.counts[category]++; cell.validCount++;
        counts[category]++; validCount++;
      }
    }
    cells.forEach(function (cell, index) {
      cell.value = median(cellBins[index], cell.validCount);
      cell.histogram = normalized(cell.counts, cell.validCount);
      cell.category = dominant(cell.counts, cell.validCount);
      cell.coverage = cell.pixelCount ? cell.validCount / cell.pixelCount : 0;
    });
    var globalMedian = median(globalBins, validCount);
    return { columns: columns, rows: rows, cells: cells, value: globalMedian, median: globalMedian, histogram: normalized(counts, validCount), counts: counts, validCount: validCount, pixelCount: width * height, coverage: validCount / (width * height), category: dominant(counts, validCount), paletteConfigured: true, valueMethod: 'Mediana de anomalías aproximadas tras invertir cada píxel con la paleta NASA' };
  }

  return Object.freeze({ configurePalette: configurePalette, analyze: analyze, estimatePixel: estimatePixel });
});
