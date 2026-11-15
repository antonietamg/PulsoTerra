const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const audioSource=fs.readFileSync(path.join(__dirname,'vivaldi-player.test.cjs'),'utf8');
const audioSetup=new Function('require','__dirname','Blob',audioSource.slice(0,audioSource.indexOf("test('signed temperature"))+'\nreturn setup;')(require,__dirname,Blob);
const app=fs.readFileSync(path.join(__dirname,'../dist/atlas-app.js'),'utf8');
function between(start,end){const first=app.indexOf(start),last=app.indexOf(end,first);assert.ok(first>=0&&last>first);return app.slice(first,last);}
function listener(id){return app.split('\n').find(line=>line.startsWith("$('"+id+"').addEventListener"));}

function setup(){
  const audio=audioSetup({durationSeconds:20,tempos:[{time:0,bpm:100}],notes:[{time:0,duration:19,midi:60,velocity:.8,channel:0,instrument:'violin'}]});
  const state={collection:'geography',mode:'explore',selected:'2023',impact:'water',region:'auto',detail:12,playing:false,preparing:false,ready:true,token:0,geoRequest:0,geoSource:'scan',geoPlan:null,geoStep:-1,geoAudio:'map',geoNextBeat:0,geoBeat:0,selection:null,scan:-1,plan:null,index:0,duration:0};
  const elements=new Map(),selectors=new Map(),status=[],errors=[],exports=[],downloads=[];let starts=0,pulses=0;
  class Element {
    constructor(id){this.id=id;this.attrs={};this.style={};this.hidden=false;this.listeners={};this.textContent='';this.checked=false;this.value='auto';const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,yes){if(yes)classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)};}
    setAttribute(key,value){this.attrs[key]=String(value);}getAttribute(key){return this.attrs[key]??null;}
    addEventListener(name,fn){(this.listeners[name]||=[]).push(fn);}async dispatch(name){for(const fn of this.listeners[name]||[])await fn({target:this});}
    pause(){}append(){}replaceChildren(){}querySelector(){return new Element('nested');}focus(){}
    click(){if(this.download)downloads.push({name:this.download,href:this.href});return this.dispatch('click');}
  }
  function $(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);}
  $('heartbeat').checked=true;
  const document={getElementById:$,querySelector(selector){if(!selectors.has(selector))selectors.set(selector,new Element(selector));return selectors.get(selector);},createElement:tag=>new Element(tag)};
  const start=audio.player.start.bind(audio.player);audio.player.start=options=>{starts++;return start(options);};
  audio.player.exportWav=async(segments,options)=>{exports.push({segments:JSON.parse(JSON.stringify(segments)),options:JSON.parse(JSON.stringify(options))});return new Blob(['wav']);};
  const point=(value,x=.3)=>({frameId:'2023',x,y:.5,row:8,col:Math.floor(x*32),value,region:{id:'test',label:'Zona de prueba'},gridColumns:32});
  const context=vm.createContext({state,window:audio.window,vivaldi:audio.player,engine:audio.engine,document,$,performance:{now:()=>1000*(audio.engine.context?.currentTime||0)},
    policy:audio.window.SonificationPolicy,geo:{regions:[]},jitter:[1,.73,1.31,.86,1.12,.65,1.24,.94],
    time:value=>Number(value).toFixed(2),format:value=>(value>0?'+':'')+value.toFixed(2).replace('.',','),note:midi=>String(midi),
    el:(tag,text)=>{const n=new Element(tag);n.textContent=text||'';return n;},URL:{createObjectURL:()=> 'blob:reference-test',revokeObjectURL(){}},
    setTimeout:()=>1,clearTimeout(){},cancelAnimationFrame(){},clearMapMotion(){},drawOverlay(){},updateMapLabel(){},renderLegend(){},
    say:text=>status.push(text),fail:text=>errors.push(text),pulse(){pulses++;},progress(){},
    showFrame(id){state.selected=id;},impact:()=>({instrument:'Instrumentos del tema',reference:'Referencia del tema'}),
    async buildGeographicPlan(){return {mode:state.mode,steps:[{frameId:'2023',selection:point(-1.25),scan:.3},{frameId:'2023',selection:point(1.75,.7),scan:.7}]};}
  });
  vm.runInContext('let timer=0,animation=0,heartTimer=0;\n'+
    between('function syncRecordMotion(','function drawOverlay(')+
    between('function resetReadout(','async function selectFrame(')+
    between('function geographicOriginal(','function beatDuration(')+
    between('function applyGeographicStep(','async function play(){')+
    between('function updateMode(','function renderFrames(')+
    listener('vivaldiMap')+'\n'+listener('vivaldiOriginal')+'\n'+listener('resetButton')+'\n'+listener('heartbeat')+
    '\nthis.controller={updateButtons,setGeographicAudio,listenSelection,readSelection,geographicProgress,applyGeographicStep,startGeographic,playGeographic,exportGeographic,stop,setCollection};',context);
  context.controller.updateButtons();
  return {audio,state,elements,$,point,context,status,errors,exports,downloads,
    async start(value=1.75){state.geoSource='point';context.controller.readSelection(point(value));await context.controller.startGeographic(value);},
    async original(){await $('vivaldiOriginal').click();},async map(){await $('vivaldiMap').click();},
    async hover(value){await context.controller.listenSelection(point(value),{smooth:true});},
    get starts(){return starts;},get pulses(){return pulses;}};
}

test('map comparison is the default and original can start before any point is selected',async()=>{
  const f=setup();assert.equal(f.$('vivaldiMap').getAttribute('aria-pressed'),'true');assert.equal(f.$('vivaldiOriginal').getAttribute('aria-pressed'),'false');
  await f.original();assert.equal(f.starts,1);assert.equal(f.state.playing,true);assert.equal(f.audio.player.params.value,0);assert.equal(f.audio.player.params.rate,1);assert.equal(f.audio.player.params.semitones,0);
  assert.equal(f.$('vivaldiOriginal').getAttribute('aria-pressed'),'true');assert.equal(f.audio.engine.heartbeat,false);assert.equal(f.$('heartbeat').checked,true);assert.equal(f.$('bpmReadout').textContent,'—');
  assert.equal(f.status.at(-1),'Vivaldi original · sin transformación ni latido');
});

test('A/B retains the same MIDI source and position while original ignores hot, cold and missing pixels',async()=>{
  const f=setup();await f.start(1.75);f.audio.advance(.4);const source=f.audio.engine.context.sources.find(source=>source.kind==='vivaldi-sample'),position=f.audio.player.position,starts=f.starts;
  await f.original();assert.equal(f.starts,starts);assert.equal(f.audio.player.position,position);
  for(const value of [-1.25,1.75,null]){await f.hover(value);assert.equal(f.state.selection.value,value);assert.equal(f.audio.player.params.value,0);assert.equal(f.audio.player.params.rate,1);assert.equal(f.audio.player.playing,true);}
  assert.match(f.$('valueReadout').textContent,/sin dato/);assert.match(f.$('musicReadout').textContent,/100 BPM/);assert.match(f.$('pitchReadout').textContent,/0,0 semitonos/);
  await f.hover(1.75);assert.match(f.$('valueReadout').textContent,/\+1,75/);f.audio.advance(.3);
  assert.ok(f.audio.player.position>position);assert.equal(f.audio.engine.context.sources.filter(source=>source.kind==='vivaldi-sample').length,1);assert.equal(f.audio.engine.context.sources.find(source=>source.kind==='vivaldi-sample'),source);
});

test('original suppresses existing and future heartbeat and returning to map restores the saved preference',async()=>{
  const f=setup();await f.start(1.75);f.audio.advance(.1);await f.original();const beats=f.pulses;
  assert.equal(f.audio.engine.heartbeat,false);assert.ok(!Array.from(f.audio.engine.voices).some(voice=>voice.sampleInstrument==='heartbeat'));
  f.audio.advance(.6);assert.equal(f.pulses,beats);await f.hover(-1.25);const starts=f.starts;await f.map();
  assert.equal(f.$('heartbeat').checked,true);assert.equal(f.audio.engine.heartbeat,true);assert.equal(f.starts,starts);assert.ok(f.audio.player._glide);
  f.audio.advance(.25);assert.ok(Math.abs(f.audio.player.params.value+1.25)<1e-8);assert.ok(f.pulses>beats);
  await f.original();f.$('heartbeat').checked=false;await f.$('heartbeat').dispatch('change');await f.map();assert.equal(f.audio.engine.heartbeat,false);assert.equal(f.$('heartbeat').checked,false);
});

test('original remains available outside the data map while returning to map freezes missing data',async()=>{
  const f=setup();await f.start(0);f.audio.advance(.3);await f.hover(null);const position=f.audio.player.position;assert.equal(f.audio.player.playing,false);
  await f.original();assert.equal(f.audio.player.playing,true);assert.equal(f.audio.player.position,position);f.audio.advance(.2);assert.ok(f.audio.player.position>position);
  await f.map();assert.equal(f.audio.player.playing,false);assert.equal(f.state.playing,true);const frozen=f.audio.player.position;f.audio.advance(.3);assert.equal(f.audio.player.position,frozen);
});

test('paused mode selection does not restart and original explicitly resumes from that same position',async()=>{
  const f=setup();await f.start(1.75);f.audio.advance(.4);await f.original();f.context.controller.stop(false);const position=f.audio.player.position,starts=f.starts;
  await f.map();assert.equal(f.state.playing,false);assert.equal(f.audio.player.playing,false);assert.equal(f.starts,starts);assert.equal(f.audio.player.position,position);
  await f.original();assert.equal(f.starts,starts+1);assert.equal(f.audio.player.position,position);assert.equal(f.audio.player.params.value,0);
});

test('reset preserves reference choice, tabs restore normal heartbeat and hide the comparison in impacts',async()=>{
  const f=setup();await f.original();f.audio.advance(.4);await f.$('resetButton').click();assert.equal(f.audio.player.position,0);assert.equal(f.audio.player.playing,false);assert.equal(f.state.geoAudio,'original');
  f.context.controller.setCollection('impacts');assert.equal(f.state.geoAudio,'map');assert.equal(f.audio.engine.heartbeat,true);assert.equal(f.$('vivaldiComparison').hidden,true);
  f.context.controller.setCollection('geography');assert.equal(f.$('vivaldiComparison').hidden,false);assert.equal(f.$('vivaldiMap').getAttribute('aria-pressed'),'true');assert.equal(f.audio.player.playing,false);
});

test('automatic tour still updates raw map cells while original playback stays at its reference',async()=>{
  const f=setup();await f.original();f.state.geoPlan={mode:'compare',steps:[{frameId:'2023',selection:f.point(-1.25),scan:.3},{frameId:'2023',selection:f.point(1.75),scan:.7}]};
  f.context.controller.applyGeographicStep(15);assert.equal(f.state.selection.value,1.75);assert.equal(f.audio.player.params.value,0);assert.match(f.$('valueReadout').textContent,/\+1,75/);
});

test('WAV selection exports reference at zero without heartbeat and map at the actual selected anomaly',async()=>{
  const f=setup();await f.original();await f.hover(null);await f.context.controller.exportGeographic();
  assert.equal(f.exports.length,1);assert.deepEqual(f.exports[0].segments,[{time:0,duration:30,value:0}]);assert.equal(f.exports[0].options.heartbeat,false);assert.match(f.downloads[0].name,/^PulsoTerra-Vivaldi-original-/);
  await f.map();await f.hover(-1.25);await f.context.controller.exportGeographic();assert.equal(f.exports.length,2);assert.deepEqual(f.exports[1].segments,[{time:0,duration:30,value:-1.25}]);assert.equal(f.exports[1].options.heartbeat,true);assert.match(f.downloads[1].name,/^PulsoTerra-Vivaldi-mapa-/);
  f.state.selection=f.point(null);await f.context.controller.exportGeographic();assert.equal(f.exports.length,2);assert.match(f.errors.at(-1),/no tiene datos/);
});

test('reset then passive preview becomes the actual map point on the next play',async()=>{
  const f=setup();f.state.geoSource='scan';await f.$('resetButton').click();f.context.controller.readSelection(f.point(-1.25));
  assert.equal(f.starts,0);await f.map();assert.equal(f.starts,0);assert.equal(f.state.geoSource,'point');
  await f.context.controller.playGeographic();assert.equal(f.audio.player.params.value,-1.25);assert.equal(f.state.geoPlan,null);assert.equal(f.state.selection.value,-1.25);
});

test('original after reset honors the previewed point when switching back to the map',async()=>{
  const f=setup();f.state.geoSource='scan';await f.$('resetButton').click();f.context.controller.readSelection(f.point(1.75));
  await f.original();assert.equal(f.state.selection.value,1.75);assert.equal(f.state.geoSource,'point');assert.equal(f.audio.player.params.value,0);
  const starts=f.starts;await f.map();f.audio.advance(.25);assert.equal(f.starts,starts);assert.ok(Math.abs(f.audio.player.params.value-1.75)<1e-8);assert.equal(f.state.geoPlan,null);
});
