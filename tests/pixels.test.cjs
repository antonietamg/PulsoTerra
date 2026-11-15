'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pixels = require('../dist/pixels.js');

const palette = [
  { rgb: [20, 20, 140], value: -2 },
  { rgb: [100, 150, 220], value: -0.7 },
  { rgb: [255, 255, 255], value: 0 },
  { rgb: [250, 180, 80], value: 0.7 },
  { rgb: [200, 30, 35], value: 2 }
];
function image(colors, width = colors.length) {
  return { width, height: colors.length / width, data: new Uint8ClampedArray(colors.flatMap(c => [...c, 255])) };
}
pixels.configurePalette(palette);

test('official palette anchors map to fixed anomaly categories', () => {
  palette.forEach((point, index) => assert.equal(pixels.classifyPixel(point.rgb), index));
  assert.deepEqual([-2, -1, -0.25, 0.25, 1, 1.01].map(pixels.categoryForValue), [0, 1, 2, 3, 3, 4]);
  assert.equal(pixels.categoryForValue(NaN), -1);
});

test('mixed cold and warm pixels stay separate instead of becoming neutral', () => {
  const result = pixels.processImageData(image([palette[0].rgb, palette[4].rgb]), { columns: 1, rows: 1 });
  assert.deepEqual(result.histogram, [0.5, 0, 0, 0, 0.5]);
  assert.equal(result.cells[0].histogram[2], 0);
  assert.notEqual(result.cells[0].category, 2);
});

test('black background and transparent pixels do not become cold data', () => {
  const frame = image([[0, 0, 0], [255, 255, 255], palette[0].rgb]);
  frame.data[11] = 0;
  const result = pixels.processImageData(frame, { columns: 1, rows: 1 });
  assert.equal(result.validCount, 1);
  assert.deepEqual(result.histogram, [0, 0, 1, 0, 0]);
  assert.equal(result.cells[0].category, 2);
  assert.equal(pixels.classifyPixel([0, 0, 0]), -1);
  assert.equal(pixels.classifyPixel([55, 55, 55]), -1);
  assert.equal(pixels.classifyPixel([201, 200, 199]), -1);
  assert.equal(pixels.classifyPixel([199, 199, 200]), -1);
  assert.equal(pixels.classifyPixel([234, 234, 235]), 2);
});

test('empty and masked cells remain explicit absence rather than category zero', () => {
  const result = pixels.processImageData(image([palette[0].rgb, palette[4].rgb]), {
    columns: 2, rows: 1, mask: (x, y) => x < 0.5 && y === 0.5
  });
  assert.equal(result.cells[0].category, 0);
  assert.equal(result.cells[1].category, -1);
  assert.equal(result.cells[1].coverage, 0);
  assert.deepEqual(result.cells[1].histogram, [0, 0, 0, 0, 0]);
  assert.equal(result.validCount, 1);
});

test('classification scale does not change between a cold and a warm frame', () => {
  const cold = pixels.processImageData(image([palette[0].rgb]), { columns: 1, rows: 1 });
  const warm = pixels.processImageData(image([palette[4].rgb]), { columns: 1, rows: 1 });
  assert.equal(cold.cells[0].category, 0);
  assert.equal(warm.cells[0].category, 4);
  assert.equal(pixels.classifyPixel(palette[0].rgb), 0);
});

test('row-major cells and histogram totals respect spatial positions', () => {
  const frame = image(palette.slice(0, 4).map(p => p.rgb), 2);
  const result = pixels.processImageData(frame, { columns: 2, rows: 2 });
  assert.deepEqual(result.cells.map(c => [c.col, c.row, c.category]), [[0, 0, 0], [1, 0, 1], [0, 1, 2], [1, 1, 3]]);
  assert.equal(result.histogram.reduce((a, b) => a + b), 1);
  assert.equal(result.cells.reduce((n, cell) => n + cell.validCount, 0), result.validCount);
});

test('invalid pixels and invalid image dimensions are rejected explicitly', () => {
  assert.equal(pixels.classifyPixel([NaN, 2, 3]), -1);
  assert.equal(pixels.classifyPixel([256, 0, 0]), -1);
  assert.throws(() => pixels.processImageData({ width: 1, height: 1, data: [] }), /RGBA/);
  assert.throws(() => pixels.configurePalette([]), /válidos/);
});
