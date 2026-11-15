const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(options={}) {
  const events = [], timers = new Map(), requests = [], decoded=[],contexts=[]; let timerId = 0;
  const instruments=['violin','strings','mutedstrings','cello','flute','clarinet','harp','horn','trombone','choir','heartbeat','snare','bassdrum','anvil','brakedrum'];
  const samples=instruments.filter(instrument=>instrument!=='violin').map(instrument=>({id:instrument,instrument,midi:60,url:'audio/'+instrument+'.mp3'}));
  for(const midi of [55,57,60,64,67,69,72,76])samples.push({id:'violin-'+midi,instrument:'violin',midi,url:'audio/violin-'+midi+'.mp3'});
  for(const id of ['sun-drop-1','sun-drop-2'])samples.push({id,instrument:'waterdrop',midi:null,url:'audio/'+id+'.mp3'});
  for(const id of ['sun-ice-crack-1','sun-ice-crack-2'])samples.push({id,instrument:'icecrack',midi:null,url:'audio/'+id+'.mp3'});
  for(const [id,midi] of [['sun-glock-g5',79],['sun-glock-c6',84],['sun-glock-g6',91]])samples.push({id,instrument:'glockenspiel',midi,url:'audio/'+id+'.mp3'});
  for(const animal of ['owl','frog','insect','blackbird'])samples.push({id:'animal-'+animal,instrument:'animal',url:'audio/animal-'+animal+'.mp3'});
  class Param {
    constructor(value=0) { this.value=value;this.history=[]; }
    setValueAtTime(v,t) { assert.ok(Number.isFinite(v)); assert.ok(Number.isFinite(t)); this.value=v;this.history.push(['set',v,t]); events.push(['param',v,t]); }
    linearRampToValueAtTime(v,t) { assert.ok(Number.isFinite(v)); assert.ok(Number.isFinite(t)); this.value=v;this.history.push(['ramp',v,t]); }
    exponentialRampToValueAtTime(v,t) { assert.ok(v>0); assert.ok(Number.isFinite(t)); this.value=v; }
    setTargetAtTime(v) { this.value=v; }
    cancelAndHoldAtTime() {}
    cancelScheduledValues() {}
  }
  class Node {
    constructor() { for(const p of ['frequency','gain','detune','pan','playbackRate','Q']) this[p]=new Param(); this.type='sine'; }
    connect() {} disconnect() { events.push(['disconnect']); }
    start(t) { assert.ok(Number.isFinite(t)&&t>=0);this.startedAt=t;events.push(['start',t,this.kind||this.type,this.sampleInstrument,this.sampleId,this.playbackRate.value]); }
    stop(t) { assert.ok(Number.isFinite(t)&&t>=0);this.stoppedAt=t;events.push(['stop',t,this.sampleId]); }
  }
  class Context {
    constructor() { this.currentTime=0; this.state='suspended'; this.destination=new Node();this.nodes=[];this.sources=[];contexts.push(this); }
    async resume() { this.state='running'; }
    createOscillator() { return new Node(); }
    createBufferSource() {const node=new Node();this.sources.push(node);return node;}
    async decodeAudioData(bytes) {decoded.push(bytes);return {duration:6};}
    createGain() { const node=new Node();this.nodes.push(node);return node; }
    createBiquadFilter() {return new Node();}
    createStereoPanner() { return new Node(); }
    createDynamicsCompressor() { const n=new Node(); for(const p of ['threshold','knee','ratio','attack','release']) n[p]=new Param(); return n; }
  }
  class Offline extends Context {
    constructor(channels,length,sampleRate) {super(); Object.assign(this,{channels,length,sampleRate});}
    async startRendering(){return {numberOfChannels:this.channels,length:this.length,sampleRate:this.sampleRate,getChannelData:()=>new Float32Array(this.length)};}
  }
  const window={AudioContext:Context,OfflineAudioContext:Offline,AtlasSoundBank:{samples:options.samples||samples},async fetch(url){requests.push(url);return {ok:!options.fail,status:options.fail?404:200,arrayBuffer:async()=>new ArrayBuffer(8)};}};
  const sandbox=vm.createContext({window,Blob,setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/atlas-audio.js'),'utf8'),sandbox);
  return {Engine:window.AtlasAudioEngine,events,timers,requests,decoded,window,contexts};
}

test('sixteen regional profiles remain synthetic while eight impact families use recordings',()=>{
  const {Engine}=setup();
  assert.equal(Engine.regionIds.length,16); assert.equal(Engine.impactIds.length,8);
  for(const id of Engine.regionIds) { assert.ok(Engine.profile(id).label); assert.equal(Engine.profile(id).synthetic,true); }
  for(const id of Engine.impactIds)assert.equal(Engine.profile(id).recorded,true);
  assert.equal(Engine.profile('unknown').id,'neutral');
});
test('major and minor preserve root and fifth and change only the third',()=>{
  const {Engine}=setup();
  assert.deepEqual(Array.from(Engine.notesFor(60,'major')),[60,64,67]);
  assert.deepEqual(Array.from(Engine.notesFor(60,'minor')),[60,63,67]);
  assert.ok(Math.abs(Engine.frequency(69)-440)<.00001);
});

test('heartbeat-only events never start regional notes alongside a MIDI performance',async()=>{
  const {Engine,contexts,events}=setup();const e=new Engine();await e.unlock();
  e.playZone({value:1.5,music:false,heartbeat:true,bpm:125,duration:.12,strength:.62});
  assert.ok(contexts[0].sources.length>0);
  assert.ok(contexts[0].sources.every(source=>source.sampleInstrument==='heartbeat'));
  assert.ok(events.filter(event=>event[0]==='start').every(event=>event[2]==='sample'&&event[3]==='heartbeat'));
});
test('heartbeat tempo uses BPM and irregular timing is reproducible',()=>{
  const {Engine}=setup();
  assert.deepEqual(Array.from(Engine.beatOffsets(3,60,false)),[0,1,2]);
  assert.deepEqual(Array.from(Engine.beatOffsets(2,120,false)),[0,.5,1,1.5]);
  const a=Array.from(Engine.beatOffsets(4,125,true));
  assert.deepEqual(a,Array.from(Engine.beatOffsets(4,125,true)));
  assert.notEqual(Math.round((a[1]-a[0])*1000),Math.round((a[2]-a[1])*1000));
});
test('extreme biodiversity uses one animal and moderate values allow variety',()=>{
  const {Engine}=setup();
  assert.equal(Engine.normalizeOptions({value:1.5,variety:4}).variety,1);
  assert.equal(Engine.normalizeOptions({value:-1.5,variety:4}).variety,1);
  assert.equal(Engine.normalizeOptions({value:1.49,variety:4}).variety,4);
});
test('regional and impact voices play with bounded volume and optional heartbeat',async()=>{
  const {Engine,events}=setup(); const e=new Engine();
  assert.equal(e.playZone({regionId:'europe'}),null);
  await e.unlock(); e.setVolume(9); assert.equal(e.volume,1); e.setVolume(-4); assert.equal(e.volume,0);
  e.setHeartbeat(false);
  for(const regionId of Engine.regionIds) { e.playZone({regionId,duration:.4,pitchMidi:60,replace:true}); }
  for(const impactId of Engine.impactIds) { e.playZone({impactId,value:0,duration:.4,pitchMidi:60,replace:true}); }
  assert.ok(events.some(v=>v[0]==='start'));
  assert.ok(e.voices.size<=48); assert.ok(e.groups.size<=6);
  e.stop(); assert.equal(e.voices.size,0); assert.equal(e.groups.size,0);
});
test('stop invalidates beat callbacks even when a queued callback still executes',async()=>{
  const {Engine,timers}=setup(); const e=new Engine(); await e.unlock(); let beats=0;
  const event=e.playZone({regionId:'caribbean',duration:3,bpm:60,onBeat:()=>beats++});
  assert.equal(event.beats.length,3); assert.equal(timers.size,3);
  const queued=Array.from(timers.values()); e.stop(); assert.equal(timers.size,0);
  queued.forEach(t=>t.fn()); assert.equal(beats,0);
});
test('per-zone heartbeat opt-out prevents duplicated beats across simultaneous map voices',async()=>{
  const a=setup(), b=setup(); const withHeart=new a.Engine(), withoutHeart=new b.Engine();
  await withHeart.unlock(); await withoutHeart.unlock();
  withHeart.playZone({regionId:'europe',duration:.4,bpm:60});
  withoutHeart.playZone({regionId:'europe',duration:.4,bpm:60,heartbeat:false});
  assert.equal(withHeart.voices.size,withoutHeart.voices.size+1);
  assert.equal(a.Engine.profile('biodiversity').id,'biodiversity');
});
test('offline export keeps every timeline event and produces stereo PCM WAV without activating playback',async()=>{
  const {Engine,events,timers}=setup(); const e=new Engine(); e.setVolume(.5);
  const timeline=Array.from({length:64},(_,i)=>({time:i*.13,options:{regionId:'mexico-central',duration:.13,pitchMidi:60,heartbeat:false}}));
  const blob=await e.exportWav(timeline,{duration:9});
  assert.equal(e.isReady,false); assert.equal(timers.size,0);
  const bytes=Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.toString('ascii',0,4),'RIFF'); assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(bytes.readUInt16LE(22),2); assert.equal(bytes.readUInt32LE(24),44100); assert.equal(bytes.readUInt16LE(34),16);
  assert.equal(bytes.length,44+9*44100*4);
  assert.equal(events.filter(v=>v[0]==='start').length,64*9);
  await assert.rejects(()=>e.exportWav([{time:-1,options:{}}]),/tiempo/);
  await assert.rejects(()=>e.exportWav(timeline,{duration:181}),/duración/);
});
test('offline normalization preserves the default heartbeat and silent strength stays silent',async()=>{
  const {Engine,events}=setup(); const e=new Engine();
  await e.exportWav([{time:0,options:{regionId:'mexico-central',duration:.4,pitchMidi:60}}],{duration:1});
  assert.equal(events.filter(v=>v[0]==='start').length,10);
  await e.unlock(); const before=events.length;
  e.playZone({strength:0,regionId:'europe',duration:.4});
  assert.equal(events.slice(before).filter(v=>v[0]==='start').length,0);
});

test('unlock downloads and decodes the bank once and reports a failed recording explicitly',async()=>{
  const a=setup(),e=new a.Engine();
  await Promise.all([e.unlock(),e.preloadSamples()]);
  const count=a.window.AtlasSoundBank.samples.length;
  assert.equal(e.sampleStatus,'ready');assert.equal(a.requests.length,count);assert.equal(a.decoded.length,count);
  await e.unlock();assert.equal(a.requests.length,count);
  const failure={fail:true},b=setup(failure),broken=new b.Engine();
  await assert.rejects(()=>broken.unlock(),/grabación.*HTTP 404/);
  assert.equal(broken.isReady,false);assert.equal(broken.sampleStatus,'error');
  assert.throws(()=>broken.playZone({impactId:'marine'}),/grabación/);
  failure.fail=false;await broken.unlock();assert.equal(broken.sampleStatus,'ready');
});

test('all eight impact themes start recordings exclusively with their requested instrument families',async()=>{
  const {Engine,events}=setup(),e=new Engine();await e.unlock();e.setHeartbeat(false);
  const families={water:['violin'],forests:['mutedstrings','flute'],oceans:['harp','strings','horn'],marine:['cello','flute'],humans:['choir'],ice:['waterdrop','glockenspiel'],economy:['bassdrum','snare','anvil','horn','trombone'],biodiversity:['animal']};
  for(const [impactId,expected] of Object.entries(families)) {
    const before=events.length;e.playZone({impactId,value:0,pitchMidi:60,duration:.6,sequenceIndex:0,replace:true});
    const starts=events.slice(before).filter(event=>event[0]==='start');
    assert.ok(starts.length);assert.ok(starts.every(event=>event[2]==='sample'),impactId+' must not synthesize');
    assert.deepEqual([...new Set(starts.map(event=>event[3]))].sort(),expected.slice().sort());
  }
  let before=events.length;e.playZone({impactId:'economy',sequenceIndex:3,duration:.6,replace:true});
  const march=events.slice(before).filter(event=>event[0]==='start');
  assert.ok(march.filter(event=>event[3]==='snare').length>=4);assert.ok(march.some(event=>event[3]==='brakedrum'));
  before=events.length;e.playZone({impactId:'forests',sequenceIndex:1,duration:.6,replace:true});
  assert.ok(events.slice(before).some(event=>event[0]==='start'&&event[3]==='clarinet'));
});

test('biodiversity calls retain natural pitch and an extreme cancels every previous animal except the new owl',async()=>{
  const {Engine,events}=setup(),e=new Engine();await e.unlock();e.setHeartbeat(false);
  e.playZone({impactId:'biodiversity',value:0,pitchMidi:84,duration:.6,variety:4});
  const calls=events.filter(event=>event[0]==='start');
  assert.equal(new Set(calls.map(event=>event[4])).size,4);assert.ok(calls.every(event=>event[5]===1));
  e.playZone({impactId:'biodiversity',value:-1.5,duration:.6,variety:4});
  assert.deepEqual(Array.from(e.voices).map(voice=>voice.sampleId),['animal-owl']);
  const voice=Array.from(e.voices)[0];voice.source.onended();voice.source.onended();
  assert.equal(e.voices.size,0);e.stop();assert.equal(e.groups.size,0);
});

test('heartbeat uses one real lub-dub recording and an independently controlled gain bus',async()=>{
  const {Engine}=setup(),e=new Engine();await e.unlock();assert.equal(e.heartbeatVolume,.8);
  e.setHeartbeatVolume(.35);assert.ok(Math.abs(e.heartbeatOutput.gain.value-.35*Math.pow(10,4/20))<1e-10);
  e.playZone({impactId:'marine',duration:.6});
  const hearts=Array.from(e.voices).filter(voice=>voice.sampleInstrument==='heartbeat');
  assert.equal(hearts.length,1);assert.equal(hearts[0].kind,'sample');
  e.setHeartbeat(false);assert.ok(!Array.from(e.voices).some(voice=>voice.sampleInstrument==='heartbeat'));
  assert.ok(Array.from(e.voices).some(voice=>voice.sampleInstrument==='cello'));
  e.setHeartbeatVolume(10);assert.equal(e.heartbeatVolume,1);e.setHeartbeatVolume(-1);assert.equal(e.heartbeatVolume,0);
});

test('missing ice samples fail before starting any voices and never fall back to a synthetic profile',async()=>{
  for(const missing of ['waterdrop','icecrack','glockenspiel']) {
    const a=setup(),samples=a.window.AtlasSoundBank.samples.filter(sample=>sample.instrument!==missing);
    const b=setup({samples}),e=new b.Engine();await e.unlock();
    assert.throws(()=>e.playZone({impactId:'ice'}),new RegExp('Falta una grabación real de '+missing));
    assert.equal(b.events.filter(event=>event[0]==='start').length,0);
  }
});

test('offline export reuses decoded recordings and retains impact motifs and real heartbeat',async()=>{
  const {Engine,events,requests,decoded}=setup(),e=new Engine();await e.unlock();e.setHeartbeatVolume(.27);
  const requestsBefore=requests.length,decodesBefore=decoded.length,before=events.length;
  await e.exportWav([{time:0,options:{impactId:'marine',duration:.6,sequenceIndex:2}}],{duration:2});
  assert.equal(requests.length,requestsBefore);assert.equal(decoded.length,decodesBefore);
  const starts=events.slice(before).filter(event=>event[0]==='start');
  assert.ok(starts.every(event=>event[2]==='sample'));
  assert.deepEqual(starts.map(event=>event[3]).sort(),['cello','flute','heartbeat']);
});

test('two-animal variety rotates only its two selected species across cells',async()=>{
  const {Engine,events}=setup(),e=new Engine();await e.unlock();e.setHeartbeat(false);
  for(let sequenceIndex=0;sequenceIndex<6;sequenceIndex++)e.playZone({impactId:'biodiversity',variety:2,value:0,duration:.6,sequenceIndex,replace:true});
  const ids=new Set(events.filter(event=>event[0]==='start').map(event=>event[4]));
  assert.deepEqual([...ids].sort(),['animal-frog','animal-owl']);
});

test('fast heartbeat preserves recorded lub and dub at original pitch without overlapping the next cycle',async()=>{
  for(const bpm of [125,130]) {
    const {Engine,events}=setup(),e=new Engine();await e.unlock();
    e.playZone({impactId:'marine',duration:1.4,bpm});
    const hearts=Array.from(e.voices).filter(voice=>voice.sampleInstrument==='heartbeat');
    assert.equal(hearts.length,6);
    const starts=events.filter(event=>event[0]==='start'&&event[3]==='heartbeat');
    assert.ok(starts.every(event=>event[5]===1));
    for(let cycle=0;cycle<3;cycle++) {
      const pair=hearts.slice(cycle*2,cycle*2+2);
      assert.equal(pair[0].sampleOffset,.035);assert.equal(pair[1].sampleOffset,.40);
      assert.ok(pair[1].end<pair[0].start+60/bpm);
    }
  }
});

test('tension is symmetric, bounded, monotonic and silent near the reference',()=>{
  const {Engine}=setup();let previous=0;
  for(let value=0;value<=3;value+=.025) {
    const tension=Engine.tensionFor(value);
    assert.ok(tension>=previous&&tension>=0&&tension<=1);
    assert.equal(tension,Engine.tensionFor(-value));
    if(value<=.5)assert.equal(tension,0);
    previous=tension;
  }
  assert.equal(Engine.tensionFor(.5),0);assert.equal(Engine.tensionFor(2),1);
  assert.equal(Engine.tensionFor(NaN),0);
  assert.equal(Engine.normalizeOptions({value:1.25}).tension,.5);
});

test('water lead gets lower as temperature rises and phase ornaments never alter its data pitch',async()=>{
  const {Engine}=setup(),e=new Engine();await e.unlock();e.setHeartbeat(false);
  let previous=Infinity;
  for(let value=-2;value<=2;value+=.1) {
    const pitch=Engine.waterPitchFor(value);
    assert.ok(pitch<=previous&&pitch>=55&&pitch<=76);previous=pitch;
  }
  for(let sequenceIndex=0;sequenceIndex<8;sequenceIndex++) {
    e.playZone({impactId:'water',value:.2,pitchMidi:72,sequenceIndex,replace:true});
    const lead=Array.from(e.voices).find(voice=>voice.role==='water-lead');
    assert.equal(lead.midi,Engine.waterPitchFor(.2));assert.equal(lead.detune,0);
  }
});

test('water keeps at most two real violin sources through fast live and offline cell transitions',async()=>{
  const {Engine}=setup();
  for(const offline of [false,true]) for(const spacing of [.18,.02]) {
    const e=new Engine();await e.unlock();e.setHeartbeat(false);e.offline=offline;
    const count=spacing===.02?200:48;
    for(let index=0;index<count;index++) {
      const at=index*spacing;
      if(!offline)e.context.currentTime=at;
      e._scheduleZone({impactId:'water',value:-2+4*(index%41)/40,pitchMidi:60+2*(index%12),duration:.12,bpm:130,sequenceIndex:index,heartbeat:false},at+.012);
      assert.ok(e.waterVoices.every(voice=>voice.sampleOffset===1));
    }
    const sources=e.context.sources.filter(source=>source.sampleInstrument==='violin');
    assert.equal(sources.length,count*2);
    const boundaries=[];
    for(const source of sources) {
      const transposition=12*Math.log2(source.playbackRate.value);
      assert.ok(Math.abs(transposition)<=2.00001);
      assert.ok(source.midi>=55&&source.midi<=76);
      if(source.stoppedAt>source.startedAt)boundaries.push([source.startedAt,1],[source.stoppedAt,-1]);
    }
    boundaries.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let simultaneous=0;
    for(const [at,delta] of boundaries){simultaneous+=delta;assert.ok(simultaneous<=2,'more than two violin sources at '+at);}
    assert.ok(e.waterVoices.length<=4);e.stop();assert.equal(e.voices.size,0);assert.equal(e.waterVoices.length,0);
  }
});

test('heartbeat has a real 4 dB boost and ducks only the music bus, with reset on stop or mute',async()=>{
  const {Engine}=setup(),e=new Engine();await e.unlock();
  const base=Math.pow(10,-2/20),floor=base*Math.pow(10,-2.5/20);
  assert.ok(Math.abs(e.heartbeatOutput.gain.value-.8*Math.pow(10,4/20))<1e-10);
  e.playZone({impactId:'marine',duration:.6,bpm:60});
  assert.equal(e.duckWindows.length,2);
  assert.ok(e.musicOutput.gain.history.some(event=>Math.abs(event[1]-floor)<1e-10));
  assert.ok(e.musicOutput.gain.history.every(event=>event[1]>=floor-1e-10&&event[1]<=base+1e-10));
  assert.ok(e.duckWindows.every(window=>window.end-window.start>=.12&&window.end-window.start<=.18));
  e.stop();assert.equal(e.duckWindows.length,0);assert.equal(e.musicOutput.gain.value,base);
  e.setHeartbeatVolume(0);e.playZone({impactId:'marine',duration:.6});assert.equal(e.duckWindows.length,0);
  e.setHeartbeatVolume(.8);e.setHeartbeat(false);e.playZone({impactId:'marine',duration:.6});assert.equal(e.duckWindows.length,0);
});

test('category tension changes texture without raising the summed voice peak and economy retains its pattern',async()=>{
  const {Engine}=setup();
  for(const impactId of ['water','forests','oceans','marine','humans','economy']) {
    const captures=[];
    for(const value of [0,2]) {
      const e=new Engine();await e.unlock();e.setHeartbeat(false);
      e.playZone({impactId,value,pitchMidi:72,mode:'major',duration:.6,sequenceIndex:0});
      captures.push(Array.from(e.voices));
    }
    const total=voices=>voices.reduce((sum,voice)=>sum+voice.peak,0);
    assert.ok(total(captures[1])<=total(captures[0])+1e-10,impactId+' should not merely get louder');
    if(impactId==='economy') {
      const pattern=voices=>voices.map(voice=>[voice.sampleInstrument,voice.midi,voice.start,voice.end,voice.peak]);
      assert.deepEqual(pattern(captures[0]),pattern(captures[1]));
    }
  }
});

test('offline music:false preserves the boosted real heartbeat and silences only music',async()=>{
  const {Engine,contexts}=setup(),e=new Engine();e.setHeartbeatVolume(.6);
  const blob=await e.exportWav([{time:0,options:{impactId:'marine',duration:.6}}],{duration:2,music:false});
  const render=contexts[contexts.length-1],music=render.nodes.find(node=>node.kind==='music-bus'),heart=render.nodes.find(node=>node.kind==='heartbeat-bus');
  assert.equal(music.gain.value,0);assert.ok(Math.abs(heart.gain.value-.6*Math.pow(10,4/20))<1e-10);
  assert.ok(render.sources.some(source=>source.sampleInstrument==='heartbeat'));
  const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.readUInt16LE(34),16);assert.equal(bytes.readUInt32LE(24),44100);
});

test('long passive cell runs retain live voice, group and ducking budgets',async()=>{
  const {Engine}=setup(),e=new Engine();await e.unlock();
  for(let index=0;index<160;index++) {
    e.context.currentTime=index*.25;
    e.playZone({impactId:Engine.impactIds[index%8],value:index%2?2:0,duration:.4,bpm:130,sequenceIndex:index});
    assert.ok(e.voices.size<=48);assert.ok(e.groups.size<=6);assert.ok(e.duckWindows.length<=24);
  }
  e.stop();assert.equal(e.voices.size,0);assert.equal(e.groups.size,0);assert.equal(e.duckWindows.length,0);
});

test('ice replaces food in seventh position while all sixteen regional references remain available',()=>{
  const {Engine}=setup();
  assert.deepEqual(Array.from(Engine.impactIds),['water','biodiversity','forests','oceans','marine','humans','ice','economy']);
  assert.equal(Engine.normalizeOptions({impactId:'ice'}).impactId,'ice');
  assert.equal(Engine.normalizeOptions({impactId:'food'}).impactId,null);
  assert.equal(Engine.profile('ice').label,'Gotas, hielo crujiendo y campana');
  assert.equal(Engine.profile('ice').origin,'Grabaciones de agua y hielo; campana suave en mayor o menor');
  assert.equal(Engine.regionIds.length,16);
  assert.ok(Engine.regionIds.every(id=>Engine.profile(id).synthetic));
});

test('calm ice uses real drops with finite echoes and a soft major-third bell',async()=>{
  const {Engine}=setup(),e=new Engine();await e.unlock();e.setHeartbeat(false);
  e.playZone({impactId:'ice',value:0,mode:'major',pitchMidi:72,bpm:60,duration:.3,sequenceIndex:0});
  const voices=Array.from(e.voices),drops=voices.filter(voice=>voice.sampleInstrument==='waterdrop');
  assert.equal(drops.length,3);assert.equal(drops.filter(voice=>voice.role==='ice-echo').length,2);
  assert.ok(drops.every(voice=>voice.sampleId==='sun-drop-1'&&voice.playbackRate===1&&voice.detune===0));
  assert.ok(!voices.some(voice=>voice.sampleInstrument==='icecrack'));
  const root=voices.find(voice=>voice.role==='ice-bell-root'),third=voices.find(voice=>voice.role==='ice-bell-third');
  assert.equal(third.midi-root.midi,4);assert.ok(root.end-root.start>1);
  assert.ok(voices.every(voice=>voice.kind==='sample'));
  e.stop();e.playZone({impactId:'ice',value:0,sequenceIndex:1,duration:.3});
  assert.ok(Array.from(e.voices).every(voice=>voice.sampleId==='sun-drop-2'));
});

test('both ice extremes start cracks and rushing subdivisions exactly at magnitude 1.5',async()=>{
  const {Engine}=setup();
  for(const value of [-2,-1.5,-1.499,1.499,1.5,2]) {
    const e=new Engine();await e.unlock();e.setHeartbeat(false);
    e.playZone({impactId:'ice',value,mode:Math.abs(value)>=1.5?'minor':'major',pitchMidi:72,bpm:125,duration:.3,sequenceIndex:0,irregular:Math.abs(value)>1.5});
    const voices=Array.from(e.voices),cracks=voices.filter(voice=>voice.sampleInstrument==='icecrack'),rush=voices.filter(voice=>voice.role==='ice-rush');
    if(Math.abs(value)<1.5) {assert.equal(cracks.length,0);assert.equal(rush.length,0);}
    else {
      assert.equal(cracks.length,1);assert.equal(rush.length,Math.abs(value)===2?3:2);
      const root=voices.find(voice=>voice.role==='ice-bell-root'),third=voices.find(voice=>voice.role==='ice-bell-third');
      assert.equal(third.midi-root.midi,3);assert.ok(root.end-root.start<.4);
      assert.equal(voices.filter(voice=>voice.role==='ice-echo').length,1);
    }
    assert.ok(voices.filter(voice=>['waterdrop','icecrack'].includes(voice.sampleInstrument)).every(voice=>voice.playbackRate===1&&voice.detune===0));
  }
});

test('ice alternates its two actual crack recordings without transposing them',async()=>{
  const {Engine}=setup(),e=new Engine();await e.unlock();e.setHeartbeat(false);
  const ids=[];
  for(const sequenceIndex of [0,2]) {
    e.playZone({impactId:'ice',value:2,mode:'minor',duration:.3,sequenceIndex,replace:true});
    ids.push(Array.from(e.voices).find(voice=>voice.role==='ice-crack').sampleId);
  }
  assert.deepEqual(ids,['sun-ice-crack-1','sun-ice-crack-2']);
});

test('ice stop cancels finite echoes and WAV export reuses the exact same decoded recordings',async()=>{
  const {Engine,contexts,requests,decoded}=setup(),e=new Engine();await e.unlock();e.setHeartbeat(false);
  const options={impactId:'ice',value:2,mode:'minor',pitchMidi:72,bpm:125,duration:.3,sequenceIndex:0};
  e.playZone(options);
  const live=Array.from(e.voices).map(voice=>({id:voice.sampleId,buffer:voice.source.buffer,role:voice.role}));
  e.stop();assert.equal(e.voices.size,0);assert.equal(e.groups.size,0);
  assert.ok(e.context.sources.every(source=>source.stoppedAt<=e.context.currentTime));
  const fetches=requests.length,decodes=decoded.length;
  const blob=await e.exportWav([{time:0,options}],{duration:2});
  const sources=contexts[contexts.length-1].sources;
  assert.deepEqual(sources.map(source=>[source.sampleId,source.sampleRole]),live.map(voice=>[voice.id,voice.role]));
  for(const source of sources)assert.equal(source.buffer,live.find(voice=>voice.id===source.sampleId).buffer);
  assert.equal(requests.length,fetches);assert.equal(decoded.length,decodes);
  const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),2);assert.equal(bytes.readUInt16LE(34),16);assert.equal(bytes.readUInt32LE(24),44100);
});
