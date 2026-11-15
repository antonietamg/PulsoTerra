const test=require('node:test');
const assert=require('node:assert/strict');
const pixels=require('../dist/pixels.js');
const anomaly=require('../dist/anomaly-analysis.js');
const {palette}=require('../dist/assets/sources.json');

test('the public NASA palette gives exact zero to native reference white and near whites',()=>{
  pixels.configurePalette(palette);anomaly.configurePalette(palette);
  for(const rgb of [[234,234,235],[255,255,255],[254,254,254],[250,250,250],[236,235,234],[222,222,222]]){
    assert.equal(anomaly.estimatePixel(rgb),0,JSON.stringify(rgb));
    assert.equal(pixels.classifyPixel(rgb),2);
  }
  assert.ok(palette.some(point=>point.value===0&&point.rgb.every(channel=>channel===255)));
  assert.ok(palette.some(point=>point.value===-2));assert.ok(palette.some(point=>point.value===2));
});

test('visible dark basemap and coastlines remain absent data while transparent white is silent',()=>{
  anomaly.configurePalette(palette);
  for(const rgb of [[0,0,0],[55,55,55],[119,119,119],[199,199,199],[201,201,201]])assert.equal(anomaly.estimatePixel([...rgb,255]),null);
  assert.equal(anomaly.estimatePixel([255,255,255,0]),null);
  assert.equal(anomaly.estimatePixel([234,234,235,0]),null);
});

test('white and colored neighbors retain distinct anomalies without moving the reference',()=>{
  anomaly.configurePalette(palette);
  const cold=palette.find(point=>point.value<-.7&&point.value>-.9),warm=palette.find(point=>point.value>.7&&point.value<.9);
  const colors=[cold.rgb,[255,255,255],warm.rgb];
  const result=anomaly.analyze({width:3,height:1,data:Uint8ClampedArray.from(colors.flatMap(rgb=>[...rgb,255]))},{columns:3,rows:1});
  assert.equal(result.validCount,3);assert.ok(result.cells[0].value<0);assert.equal(result.cells[1].value,0);assert.ok(result.cells[2].value>0);
  assert.equal(result.cells[1].category,2);
});
