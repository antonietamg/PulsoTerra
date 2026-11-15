(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PixelAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CATEGORIES = Object.freeze([
    Object.freeze({ index: 0, label: 'Mucho más frío', shortLabel: 'Frío intenso', color: '#263c98', range: 'Menos de −1 °C' }),
    Object.freeze({ index: 1, label: 'Más frío', shortLabel: 'Frío', color: '#80aed5', range: 'De −1 a −0,25 °C' }),
    Object.freeze({ index: 2, label: 'Cerca de la referencia', shortLabel: 'Referencia', color: '#f5f5f0', range: 'De −0,25 a +0,25 °C' }),
    Object.freeze({ index: 3, label: 'Más cálido', shortLabel: 'Cálido', color: '#f6ba61', range: 'De +0,25 a +1 °C' }),
    Object.freeze({ index: 4, label: 'Mucho más cálido', shortLabel: 'Calor intenso', color: '#cd3438', range: 'Más de +1 °C' })
  ]);

  // Used only when the official image palette has not been configured.
  // A configured NASA palette always replaces these reference anchors.
  var FALLBACK_PALETTE = [
    { rgb: [20, 28, 100], value: -2 },
    { rgb: [46, 65, 158], value: -1.25 },
    { rgb: [93, 141, 199], value: -0.75 },
    { rgb: [169, 199, 225], value: -0.4 },
    { rgb: [246, 246, 244], value: 0 },
    { rgb: [255, 227, 153], value: 0.4 },
    { rgb: [250, 168, 81], value: 0.75 },
    { rgb: [230, 85, 54], value: 1.25 },
    { rgb: [167, 25, 35], value: 2 }
  ];
  var compiledPalettes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function categoryForValue(value) {
    if (!Number.isFinite(value)) return -1;
    if (value < -1) return 0;
    if (value < -0.25) return 1;
    if (value < 0.25) return 2;
    if (value <= 1) return 3;
    return 4;
  }

  function readRGB(rgb) {
    if (!rgb) return null;
    var r = Number(rgb[0] === undefined ? rgb.r : rgb[0]);
    var g = Number(rgb[1] === undefined ? rgb.g : rgb[1]);
    var b = Number(rgb[2] === undefined ? rgb.b : rgb[2]);
    var alpha = rgb[3] === undefined ? (rgb.a === undefined ? 255 : Number(rgb.a)) : Number(rgb[3]);
    if (![r, g, b, alpha].every(Number.isFinite)) return null;
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 || alpha < 128) return null;
    return [Math.round(r), Math.round(g), Math.round(b)];
  }

  // CIE Lab is used for nearest-palette matching. It does not estimate a
  // temperature independently of the supplied image legend.
  function toLab(rgb) {
    var v = rgb.map(function (channel) {
      var n = channel / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });
    var xyz = [
      (v[0] * 0.4124564 + v[1] * 0.3575761 + v[2] * 0.1804375) / 0.95047,
      v[0] * 0.2126729 + v[1] * 0.7151522 + v[2] * 0.0721750,
      (v[0] * 0.0193339 + v[1] * 0.1191920 + v[2] * 0.9503041) / 1.08883
    ].map(function (n) { return n > 0.008856 ? Math.cbrt(n) : 7.787 * n + 16 / 116; });
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
  }

  function compilePalette(palette) {
    if (compiledPalettes && compiledPalettes.has(palette)) return compiledPalettes.get(palette);
    if (!Array.isArray(palette)) throw new TypeError('La paleta debe ser un arreglo de colores con un valor de anomalía.');
    var points = palette.map(function (entry) {
      var rgb = readRGB(entry && (entry.rgb || entry.color));
      var value = Number(entry && (entry.value === undefined ? entry.anomaly : entry.value));
      if (!rgb || !Number.isFinite(value)) return null;
      return { rgb: rgb, lab: toLab(rgb), category: categoryForValue(value) };
    }).filter(Boolean);
    if (!points.length) throw new TypeError('La paleta no contiene colores válidos.');
    var result = { points: points, cache: new Map(), official: palette !== FALLBACK_PALETTE };
    if (compiledPalettes) compiledPalettes.set(palette, result);
    return result;
  }

  var active = compilePalette(FALLBACK_PALETTE);

  function configurePalette(palette) {
    active = compilePalette(palette || FALLBACK_PALETTE);
    return { entries: active.points.length, configured: active.official };
  }

  function classify(rgb, palette) {
    var color = readRGB(rgb);
    if (!color) return -1;
    var high = Math.max(color[0], color[1], color[2]);
    var low = Math.min(color[0], color[1], color[2]);
    // The maps use black for the exterior and dark, low-chroma coastlines.
    // Dark saturated blues and reds remain valid scientific colors.
    if (high < 18 || (high < 95 && high - low < 18) || (high < 222 && high - low <= 5)) return -1;
    var key = (color[0] << 16) | (color[1] << 8) | color[2];
    if (palette.cache.has(key)) return palette.cache.get(key);
    var lab = toLab(color);
    var nearestDistance = Infinity;
    var category = -1;
    for (var i = 0; i < palette.points.length; i++) {
      var point = palette.points[i];
      var dl = lab[0] - point.lab[0];
      var da = lab[1] - point.lab[1];
      var db = lab[2] - point.lab[2];
      var distance = dl * dl + da * da + db * db;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        category = point.category;
      }
    }
    // Reject annotations or unrelated colors rather than forcing them into
    // a temperature class. This limit is deliberately independent of frame.
    if (nearestDistance > 32 * 32) category = -1;
    if (palette.cache.size > 65536) palette.cache.clear();
    palette.cache.set(key, category);
    return category;
  }

  function classifyPixel(rgb, palette) {
    return classify(rgb, palette ? compilePalette(palette) : active);
  }

  function normalized(counts, total) {
    return counts.map(function (count) { return total ? count / total : 0; });
  }

  function dominant(counts, validCount) {
    if (!validCount) return -1;
    var category = 0;
    for (var i = 1; i < counts.length; i++) if (counts[i] > counts[category]) category = i;
    return category;
  }

  function processImageData(imageData, options) {
    options = options || {};
    if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) ||
        imageData.width < 1 || imageData.height < 1 || !imageData.data ||
        imageData.data.length < imageData.width * imageData.height * 4) {
      throw new TypeError('Se necesitan píxeles RGBA con ancho y alto válidos.');
    }
    var columns = Number.isFinite(options.columns) ? Math.max(1, Math.min(128, Math.floor(options.columns))) : 32;
    var rows = Number.isFinite(options.rows) ? Math.max(1, Math.min(128, Math.floor(options.rows))) : 16;
    var width = imageData.width;
    var height = imageData.height;
    var data = imageData.data;
    var palette = options.palette ? compilePalette(options.palette) : active;
    var mask = typeof options.mask === 'function' ? options.mask : null;
    var cells = Array.from({ length: columns * rows }, function (_, index) {
      return { col: index % columns, row: Math.floor(index / columns), category: -1,
        histogram: [0, 0, 0, 0, 0], counts: [0, 0, 0, 0, 0], coverage: 0,
        validCount: 0, pixelCount: 0 };
    });
    var counts = [0, 0, 0, 0, 0];
    var validCount = 0;
    for (var y = 0; y < height; y++) {
      var cellRow = Math.min(rows - 1, Math.floor(y * rows / height));
      var yn = (y + 0.5) / height;
      for (var x = 0; x < width; x++) {
        var cell = cells[cellRow * columns + Math.min(columns - 1, Math.floor(x * columns / width))];
        cell.pixelCount++;
        if (mask && !mask((x + 0.5) / width, yn)) continue;
        var offset = (y * width + x) * 4;
        var category = classify([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]], palette);
        if (category < 0) continue;
        cell.counts[category]++;
        cell.validCount++;
        counts[category]++;
        validCount++;
      }
    }
    cells.forEach(function (cell) {
      cell.histogram = normalized(cell.counts, cell.validCount);
      cell.category = dominant(cell.counts, cell.validCount);
      cell.coverage = cell.pixelCount ? cell.validCount / cell.pixelCount : 0;
    });
    return { columns: columns, rows: rows, cells: cells, histogram: normalized(counts, validCount),
      counts: counts, validCount: validCount, pixelCount: width * height,
      coverage: validCount / (width * height), paletteConfigured: palette.official };
  }

  return Object.freeze({ CATEGORIES: CATEGORIES, categoryForValue: categoryForValue,
    configurePalette: configurePalette, classifyPixel: classifyPixel, processImageData: processImageData });
});
