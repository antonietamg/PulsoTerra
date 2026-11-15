'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../dist/sonification-policy.js');
const analysis = require('../dist/anomaly-analysis.js');

const palette = [
  {rgb:[20,20,140],value:-2},
  {rgb:[100,150,220],value:-.7},
  {rgb:[255,255,255],value:0},
  {rgb:[250,180,80],value:.7},
  {rgb:[200,30,35],value:2}
];
function image(colors, width = colors.length) { return {width,height:colors.length/width,data:new Uint8ClampedArray(colors.flatMap(c=>c.length===4?c:[...c,255]))}; }
analysis.configurePalette(palette);

test('policy rejects absent and nonnumeric values instead of creating a neutral note', () => {
  for (const value of [null,undefined,NaN,Infinity,-Infinity,'0',false]) assert.equal(policy.describe(value),null);
});

test('pitch descends from cold to warm and stays in requested musical bounds', () => {
  assert.equal(policy.describe(-2).midi,84);
  assert.equal(policy.describe(0).midi,72);
  assert.equal(policy.describe(2).midi,60);
  const notes = [];
  for(let i=-200;i<=200;i++) {
    const result = policy.describe(i/100);
    assert.ok(result.midi>=60 && result.midi<=84);
    assert.ok(policy.scales[result.mode].includes(result.midi%12));
    notes.push(result.midi);
  }
  for(let i=1;i<notes.length;i++) assert.ok(notes[i]<=notes[i-1], `${i}: pitch reverses direction`);
  assert.equal(policy.describe(-20).midi,84);
  assert.equal(policy.describe(20).midi,60);
});

test('mode, BPM and irregularity use exact separate inclusive thresholds', () => {
  for(const sign of [-1,1]) {
    assert.equal(policy.describe(.5*sign).bpm,60);
    assert.equal(policy.describe(.5001*sign).bpm,90);
    assert.equal(policy.describe(.9999*sign).bpm,90);
    assert.equal(policy.describe(1*sign).bpm,125);
    assert.equal(policy.describe(1.4999*sign).mode,'major');
    assert.equal(policy.describe(1.5*sign).mode,'minor');
    assert.equal(policy.describe(1.5*sign).bpm,125);
    assert.equal(policy.describe(1.5*sign).irregular,false);
    assert.equal(policy.describe(1.5001*sign).bpm,130);
    assert.equal(policy.describe(1.5001*sign).irregular,true);
  }
});

test('animal variety is progressive and extremes have exactly one voice', () => {
  assert.deepEqual([0,.5,1,1.4,1.5,2].map(v=>policy.describe(v).variety),[5,4,3,2,1,1]);
  for(const value of [-1.5,-2,1.5,2]) assert.equal(policy.describe(value).variety,1);
});

test('source text distinguishes evidence from clinical and musical interpretation', () => {
  const hamilton=policy.bibliography.find(s=>s.id==='hamilton2018');
  assert.match(hamilton.limitation,/No estudia temperatura/);
  assert.match(policy.explanation,/decisiones de diseño/);
  assert.match(policy.explanation,/diagnósticos/);
});

test('palette inversion recovers anchor values and excludes background and alpha', () => {
  for(const point of palette) assert.equal(analysis.estimatePixel([...point.rgb,255]),point.value);
  assert.equal(analysis.estimatePixel(new Uint8ClampedArray([...palette[1].rgb,255])),-.7);
  assert.equal(analysis.estimatePixel([0,0,0,255]),null);
  assert.equal(analysis.estimatePixel([...palette[0].rgb,0]),null);
  assert.equal(analysis.estimatePixel([201,200,199,255]),null);
});

test('median is computed after inversion and mixed extremes retain their histogram', () => {
  const result=analysis.analyze(image([palette[0].rgb,palette[0].rgb,palette[4].rgb]),{columns:1,rows:1});
  assert.equal(result.cells[0].value,-2);
  assert.equal(result.value,-2);
  assert.deepEqual(result.histogram,[2/3,0,0,0,1/3]);
  const even=analysis.analyze(image([palette[0].rgb,palette[4].rgb]),{columns:1,rows:1});
  assert.equal(even.cells[0].value,0); // Numerical median of two inverted values, not RGB averaging.
  assert.equal(even.histogram[2],0);
  assert.deepEqual(even.histogram,[.5,0,0,0,.5]);
});

test('row-major layout, mask, coverage and missing cells remain explicit', () => {
  const result=analysis.analyze(image(palette.slice(0,4).map(p=>p.rgb),2),{columns:2,rows:2,mask:(x,y)=>x<.5});
  assert.deepEqual(result.cells.map(c=>[c.col,c.row,c.value]),[[0,0,-2],[1,0,null],[0,1,0],[1,1,null]]);
  assert.equal(result.validCount,2);
  assert.equal(result.coverage,.5);
  assert.equal(result.cells[1].category,-1);
  const absent=analysis.analyze(image([[0,0,0,0]]),{columns:1,rows:1});
  assert.equal(absent.value,null);
  assert.deepEqual(absent.histogram,[0,0,0,0,0]);
});

test('image and palette validation reject malformed input', () => {
  assert.throws(()=>analysis.analyze({width:2,height:2,data:new Uint8Array(2)}),/RGBA/);
  assert.throws(()=>analysis.configurePalette([]),/válidos/);
  assert.throws(()=>analysis.configurePalette([{rgb:[NaN,4,5],value:0}]),/válidos/);
});
