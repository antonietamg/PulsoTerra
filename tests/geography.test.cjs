const test=require('node:test');const assert=require('node:assert/strict');
const geo=require('../dist/geography.js');
test('Robinson inverse respects curved edges and poles',()=>{
  assert.deepEqual(geo.inverseRobinson(.5,.5),{lat:0,lon:0});
  assert.equal(geo.inverseRobinson(0,0),null);
  assert.equal(geo.inverseRobinson(.5,0).lat,90);
  assert.equal(geo.inverseRobinson(.5,1).lat,-90);
  assert.equal(geo.inverseRobinson(NaN,.5),null);
});
test('forward and inverse round trip multiple latitudes and longitudes',()=>{
  for(const lat of [-85,-64,-33.4,0,19.43,45,82])for(const lon of [-175,-99.13,0,85,179]){
    const p=geo.forwardRobinson(lat,lon),q=geo.inverseRobinson(p.x,p.y);
    assert.ok(Math.abs(q.lat-lat)<1e-8);assert.ok(Math.abs(q.lon-lon)<1e-8);
  }
});
test('country polygons classify selected places in all sixteen regions',()=>{
  const cases=[['north-america',40.71,-74],['mexico-central',19.43,-99.13],['caribbean',23.11,-82.37],['andes',-12.04,-77.03],['brazil',-15.79,-47.88],['south-cone',-34.6,-58.38],['europe',48.86,2.35],['middle-east',30.04,31.24],['west-africa',12.64,-8],['east-africa',-17.83,31.05],['central-asia',51.17,71.43],['south-asia',28.61,77.21],['east-asia',39.9,116.4],['southeast-asia',-6.2,106.85],['australasia',-33.86,151.21],['pacific',-18.14,178.44]];
  for(const [id,lat,lon]of cases)assert.equal(geo.regionAt(lat,lon).id,id,`${lat},${lon}`);
});
test('ocean pixels never receive a nearby land instrument',()=>{
  for(const [lat,lon]of [[0,-140],[0,-30],[-30,80],[30,-40]]){
    const r=geo.regionAt(lat,lon);assert.equal(r.id,'ocean');assert.equal(r.country,null);
  }
  assert.equal(geo.regionAt(-85,0).id,'polar');
  assert.equal(geo.regionAt(91,0),null);
});
test('regional edge cases and projected points retain named provenance',()=>{
  assert.equal(geo.regionAt(-23,-69).id,'andes');
  assert.equal(geo.regionAt(-41,-73).id,'south-cone');
  assert.equal(geo.regionAt(21.3,-157.8).id,'pacific');
  const p=geo.forwardRobinson(19.43,-99.13),r=geo.atPixel(p.x,p.y);
  assert.equal(r.id,'mexico-central');assert.ok(r.country);assert.ok(r.origin);assert.ok(r.source.startsWith('https:'));
  assert.equal(new Set(geo.regions.map(r=>r.id)).size,16);
  for(const region of geo.regions){
    assert.equal(geo.regionAt(region.center.lat,region.center.lon).id,region.id,'selected center '+region.id);
    const q=geo.forwardRobinson(region.center.lat,region.center.lon);
    assert.ok(q.x>=0&&q.x<=1&&q.y>=0&&q.y<=1);
  }
});
