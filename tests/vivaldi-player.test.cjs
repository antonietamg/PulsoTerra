const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function setup(score={durationSeconds:4,notes:[{time:0,duration:3,midi:60,velocity:.8,channel:0,program:40,instrument:'violin'},{time:.2,duration:.4,midi:64,velocity:.7,channel:0,program:40,instrument:'violin'},{time:2,duration:.5,midi:67,velocity:.6,channel:0,program:40,instrument:'violin'}]}) {
  const contexts=[],timers=new Map();let wall=0,serial=0,fetches=0;
  class Param {
    constructor(value=0){this.value=value;this.events=[];}
    setValueAtTime(value,time){assert.ok(Number.isFinite(value)&&Number.isFinite(time));this.value=value;this.events.push(['set',value,time]);}
    linearRampToValueAtTime(value,time){assert.ok(Number.isFinite(value)&&Number.isFinite(time));this.value=value;this.events.push(['ramp',value,time]);}
    exponentialRampToValueAtTime(value,time){assert.ok(value>0&&Number.isFinite(time));this.value=value;this.events.push(['exp',value,time]);}
    setTargetAtTime(value,time){this.setValueAtTime(value,time);}
    cancelScheduledValues(time){this.events=this.events.filter(event=>event[2]<time);}
    cancelAndHoldAtTime(time){this.cancelScheduledValues(time);}
  }
  class Node {
    constructor(){for(const name of ['gain','frequency','detune','pan','playbackRate','Q','threshold','knee','ratio','attack','release'])this[name]=new Param();}
    connect(node){this.connected=node;}disconnect(){this.disconnected=true;}
    start(time,offset=0){this.startedAt=time;this.offset=offset;}
    stop(time){assert.ok(Number.isFinite(time)&&time>=0);this.stoppedAt=time;}
  }
  class AudioBuffer {
    constructor(channels,length,sampleRate){Object.assign(this,{numberOfChannels:channels,length,sampleRate,duration:length/sampleRate});this.channels=Array.from({length:channels},()=>new Float32Array(length));}
    getChannelData(channel){return this.channels[channel];}
  }
  class Context {
    constructor(){this.currentTime=wall/1000;this.state='suspended';this.destination=new Node();this.sources=[];this.nodes=[];contexts.push(this);}
    async resume(){this.state='running';}
    createBufferSource(){const node=new Node();this.sources.push(node);return node;}
    createGain(){const node=new Node();this.nodes.push(node);return node;}
    createStereoPanner(){return new Node();}createBiquadFilter(){return new Node();}createDynamicsCompressor(){return new Node();}
    createBuffer(channels,length,sampleRate){return new AudioBuffer(channels,length,sampleRate);}
    createOscillator(){throw Error('Vivaldi must never synthesize an oscillator');}
    async decodeAudioData(){return new AudioBuffer(1,6000,1000);}
  }
  class Offline extends Context {
    constructor(channels,length,sampleRate){super();Object.assign(this,{offline:true,channels,length,sampleRate,currentTime:0});}
    async startRendering(){return new AudioBuffer(this.channels,this.length,this.sampleRate);}
  }
  const samples=[];
  for(const [instrument,notes] of Object.entries({violin:[55,60,64,76],strings:[55,57,62],cello:[36,43],harp:[48,55],flute:[60,69],clarinet:[50,58]}))for(const midi of notes)samples.push({id:instrument+'-'+midi,instrument,midi,url:instrument+'-'+midi+'.mp3'});
  samples.push({id:'heartbeat',instrument:'heartbeat',midi:null,url:'heartbeat.mp3'});
  const window={AudioContext:Context,OfflineAudioContext:Offline,AtlasSoundBank:{samples},VivaldiScore:score,fetch:async()=>{fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}};
  const sandbox=vm.createContext({window,Blob,setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,due:wall+ms});return id;},clearTimeout(id){timers.delete(id);}});
  for(const file of ['sonification-policy.js','atlas-audio.js','vivaldi-player.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),sandbox);
  window.SonificationPolicy=sandbox.SonificationPolicy;
  const engine=new window.AtlasAudioEngine(),player=new window.VivaldiPlayer(engine,score);
  function advance(seconds){
    const target=wall+seconds*1000;
    function move(time){wall=time;for(const context of contexts)if(!context.offline){context.currentTime=wall/1000;for(const source of context.sources)if(!source.ended&&source.stoppedAt<=context.currentTime){source.ended=true;if(source.onended)source.onended();}}}
    for(;;){const next=Array.from(timers.entries()).filter(([,timer])=>timer.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;timers.delete(next[0]);move(next[1].due);next[1].fn();}
    move(target);
  }
  return {Player:window.VivaldiPlayer,engine,player,contexts,timers,advance,window,get fetches(){return fetches;}};
}

test('signed temperature independently controls exact semitones and tempo ratio',()=>{
  const {Player}=setup();
  assert.equal(Player.describe(-2).rate,.5);assert.equal(Player.describe(-2).semitones,12);
  assert.equal(Player.describe(0).rate,1);assert.equal(Player.describe(0).semitones,0);
  assert.equal(Player.describe(2).rate,2);assert.equal(Player.describe(2).semitones,-12);
  let rate=0,pitch=Infinity;
  for(let value=-3;value<=3;value+=.05){const p=Player.describe(value);assert.ok(p.rate>=rate&&p.semitones<=pitch);rate=p.rate;pitch=p.semitones;assert.equal(p.bpmFactor,p.rate);}
  assert.equal(Player.describe(null).value,null);assert.equal(Player.describe(NaN).rate,0);
});

test('score programs use explicit recorded substitutes and preserve low MIDI notes without clamping',async()=>{
  const score={durationSeconds:2,notes:[['pizzicato_strings',45,33],['strings',48,30],['ocarina',79,90],['oboe',68,81],['violin',40,92]].map(([instrument,program,midi],i)=>({time:0,duration:1,midi,velocity:.8,channel:i,instrument,program}))};
  const {player,engine}=setup(score);await player.start({value:0});
  assert.deepEqual(engine.context.sources.map(source=>source.sampleInstrument),['harp','strings','flute','clarinet','violin']);
  for(const source of engine.context.sources){const sample=engine.sampleEntries.find(sample=>sample.id===source.sampleId);assert.ok(Math.abs(Number(sample.midi)+12*Math.log2(source.playbackRate.value)-source.midi)<1e-9);}
});

test('scheduler uses original score seconds divided by rate while samples transpose by pitch alone',async()=>{
  const score={durationSeconds:3,notes:[{time:.5,duration:1,midi:60,velocity:.8,instrument:'violin',channel:0},{time:1.5,duration:.5,midi:67,velocity:.7,instrument:'violin',channel:0}]};
  for(const [value,rate,semitones] of [[-2,.5,12],[2,2,-12]]){
    const {player,engine,advance}=setup(score);await player.start({value});advance(3);
    const sources=engine.context.sources;
    assert.equal(sources.length,2);
    for(const source of sources){const note=score.notes[source.scoreNote],sample=engine.sampleEntries.find(sample=>sample.id===source.sampleId);assert.ok(Math.abs(source.startedAt-note.time/rate)<.00001);assert.ok(Math.abs(Number(sample.midi)+12*Math.log2(source.playbackRate.value)-note.midi-semitones)<1e-8);}
  }
});

test('continuous retempo retains active onset and cancels/reschedules future notes only',async()=>{
  const {player,engine,advance}=setup();await player.start({value:0});
  const sustained=engine.context.sources.find(source=>source.scoreNote===0),future=engine.context.sources.find(source=>source.scoreNote===1);
  advance(.1);player.setTemperature(2);
  assert.equal(engine.context.sources.filter(source=>source.scoreNote===0).length,1);
  assert.equal(future.stoppedAt,.1);
  const replacement=engine.context.sources.filter(source=>source.scoreNote===1)[1];assert.ok(Math.abs(replacement.startedAt-.15)<1e-8);
  assert.ok(sustained.playbackRate.events.some(event=>Math.abs(event[1]-.5)<1e-8&&event[2]===.1));
  advance(.2);assert.ok(Math.abs(player.position-.5)<1e-8);assert.ok(Math.abs(sustained.stoppedAt-1.556)<1e-8);
});

test('retiming during the first attack recovers expression promptly on the same source',async()=>{
  const score={durationSeconds:2,notes:[{time:0,duration:1,midi:60,velocity:.8,instrument:'violin',channel:0}]};
  const {player,engine,advance}=setup(score);await player.start({value:0});const voice=Array.from(player._voices)[0];
  advance(.009);player.setTemperature(.5);
  assert.equal(engine.context.sources.length,1);
  assert.ok(voice.gain.gain.events.some(event=>event[0]==='ramp'&&Math.abs(event[1]-voice.peak)<1e-9&&event[2]>.009&&event[2]<=.022));
});

test('pause preserves score position, stop resets, and stale callbacks never restart playback',async()=>{
  const {player,advance,timers}=setup();await player.start({value:0});advance(.7);const position=player.pause();assert.ok(Math.abs(position-.7)<1e-8);
  assert.equal(player.playing,false);assert.equal(timers.size,0);advance(1);assert.equal(player.position,position);
  player.setTemperature(2);assert.equal(player.playing,false);
  await player.start({value:2});assert.ok(Math.abs(player.position-position)<1e-8);
  const queued=Array.from(timers.values());player.stop();queued.forEach(timer=>timer.fn());assert.equal(player.position,0);assert.equal(player.playing,false);assert.equal(timers.size,0);
});

test('missing data freezes position and silences until a valid value returns, unless explicitly paused',async()=>{
  const {player,advance}=setup();await player.start({value:0});advance(.4);player.setTemperature(null);
  assert.equal(player.playing,false);assert.equal(player.position,.4);advance(1);assert.equal(player.position,.4);
  player.setTemperature(-2);assert.equal(player.playing,true);advance(.2);assert.ok(Math.abs(player.position-.5)<1e-8);
  player.pause();player.setTemperature(null);player.setTemperature(0);assert.equal(player.playing,false);
});

test('updates during bank loading preserve start intent while explicit pause cancels it',async()=>{
  const f=setup();const original=f.engine.unlock.bind(f.engine);let release;f.engine.unlock=()=>new Promise(resolve=>release=async()=>{await original();resolve();});
  const waiting=f.player.start({value:0,offset:.3});f.player.setTemperature(null);await release();await waiting;assert.equal(f.player.playing,false);assert.equal(f.player.position,.3);
  f.player.setTemperature(2);assert.equal(f.player.playing,true);
  const g=setup();let done;const next=g.engine.unlock.bind(g.engine);g.engine.unlock=()=>new Promise(resolve=>done=async()=>{await next();resolve();});
  const cancelled=g.player.start({value:0});g.player.pause();await done();assert.equal(await cancelled,false);assert.equal(g.player.playing,false);
});

test('progress reports original seconds every tick and end fires once with bounded voices',async()=>{
  const score={durationSeconds:1,notes:Array.from({length:100},(_,i)=>({time:0,duration:.8,midi:60+i%12,velocity:.6,instrument:'violin',channel:0}))};
  const {player,advance,timers}=setup(score);let ends=0;const progress=[];await player.start({value:2,onProgress:event=>progress.push(event),onEnd:()=>ends++});
  assert.ok(player._voices.size<=48);advance(.7);assert.equal(ends,1);assert.equal(player.position,1);assert.equal(player.playing,false);assert.equal(timers.size,0);
  advance(1);assert.equal(ends,1);assert.ok(progress.some(event=>event.playing&&event.params.rate===2&&event.position>0));
});

test('progress callbacks may retime or pause synchronously without duplicate timers',async()=>{
  const {player,advance,timers}=setup();let changed=false;
  await player.start({value:0,onProgress:event=>{if(event.playing&&event.position>=.1&&!changed){changed=true;player.setTemperature(2);}}});
  advance(.15);assert.ok(changed);assert.equal(timers.size,1);
  player._onProgress=event=>{if(event.playing)player.pause();};advance(.05);
  assert.equal(player.playing,false);assert.equal(timers.size,0);
});

test('MIDI CC11 expression is retained and re-timed with the score clock',async()=>{
  const score={durationSeconds:3,notes:[{time:0,duration:2,midi:60,velocity:.8,instrument:'violin',channel:0}],controllers:[{time:0,channel:0,controller:11,value:100},{time:.5,channel:0,controller:11,value:64},{time:1,channel:0,controller:11,value:20}]};
  const {player,advance}=setup(score);await player.start({value:0});const voice=Array.from(player._voices)[0];
  assert.ok(voice.gain.gain.events.some(event=>event[2]===.508&&Math.abs(event[1]-voice.peak*64/127)<1e-9));
  advance(.1);player.setTemperature(2);
  assert.ok(voice.gain.gain.events.some(event=>Math.abs(event[2]-.3)<1e-9&&Math.abs(event[1]-voice.peak*64/127)<1e-9));
});

test('offline rate changes retain a single source for a crossing MIDI note',async()=>{
  const score={durationSeconds:4,notes:[{time:0,duration:3,midi:60,velocity:.8,instrument:'violin',channel:0}]};
  const {player,contexts,engine}=setup(score);
  const blob=await player.exportWav([{time:0,duration:1,value:0},{time:1,duration:1,value:2}],{duration:2,heartbeat:false});
  const offline=contexts[contexts.length-1];assert.equal(offline.sources.length,1);const source=offline.sources[0];
  assert.equal(source.scoreNote,0);assert.ok(Math.abs(source.stoppedAt-2.006)<1e-9);assert.ok(source.playbackRate.events.some(event=>event[2]===1&&event[1]===.5));
  assert.equal(engine.context.sources.length,0);
  const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),2);assert.equal(bytes.readUInt16LE(34),16);assert.equal(bytes.readUInt32LE(24),44100);
});

test('offline missing-data gaps freeze sample phase without creating another note onset',async()=>{
  const score={durationSeconds:3,notes:[{time:0,duration:2,midi:60,velocity:.8,instrument:'violin',channel:0}]};
  const {player,contexts}=setup(score);await player.exportWav([{time:0,duration:1,value:0},{time:1,duration:1,value:null},{time:2,duration:1,value:0}],{duration:3,heartbeat:false});
  const source=contexts[contexts.length-1].sources[0];assert.equal(contexts[contexts.length-1].sources.length,1);
  assert.ok(source.playbackRate.events.some(event=>event[2]===1&&event[1]===0));assert.ok(source.playbackRate.events.some(event=>event[2]===2&&event[1]===1));assert.ok(Math.abs(source.stoppedAt-3.006)<1e-9);
});

test('offline expression follows changed rate and original offset uses an existing note body',async()=>{
  const score={durationSeconds:4,notes:[{time:0,duration:3,midi:60,velocity:.8,instrument:'violin',channel:0}],controllers:[{time:1.5,channel:0,controller:11,value:50}]};
  const {player,contexts}=setup(score);await player.exportWav([{time:0,duration:1,value:2}],{duration:1,offset:1,heartbeat:false});
  const source=contexts[contexts.length-1].sources[0];assert.ok(source.offset>1);assert.equal(source.startedAt,0);
  assert.ok(source.connected.gain.events.some(event=>Math.abs(event[2]-.25)<1e-9&&Math.abs(event[1]-.42*.8*50/127)<1e-9));
});

test('offline zero-expression ending stays silent and cross-segment expression uses the piecewise clock',async()=>{
  const score={durationSeconds:4,notes:[{time:0,duration:3,midi:60,velocity:.8,instrument:'violin',channel:0}],controllers:[{time:1.5,channel:0,controller:11,value:50},{time:2.5,channel:0,controller:11,value:0}]};
  const {player,contexts}=setup(score);await player.exportWav([{time:0,duration:1,value:0},{time:1,duration:1,value:2}],{duration:2,heartbeat:false});
  const events=contexts[contexts.length-1].sources[0].connected.gain.events;
  assert.ok(events.some(event=>Math.abs(event[2]-1.25)<1e-9&&Math.abs(event[1]-.42*.8*50/127)<1e-9));
  assert.ok(events.filter(event=>event[2]>=1.75).every(event=>event[1]===0));
});

test('expression set exactly at note-off does not mute the previous release early',async()=>{
  const score={durationSeconds:3,notes:[{time:0,duration:2,midi:60,velocity:.8,instrument:'violin',channel:0}],controllers:[{time:0,channel:0,controller:11,value:127},{time:2,channel:0,controller:11,value:0}]};
  const {player,contexts}=setup(score);await player.exportWav([{time:0,duration:2,value:0}],{duration:2,heartbeat:false});
  const events=contexts[contexts.length-1].sources[0].connected.gain.events;
  assert.ok(events.some(event=>Math.abs(event[2]-1.94)<1e-9&&Math.abs(event[1]-.42*.8)<1e-9));
});

test('WAV sample has explicit duration guards and includes shared real heartbeat beyond twelve seconds',async()=>{
  const {player,contexts}=setup();
  await assert.rejects(()=>player.exportWav([{time:0,duration:1,value:0}],{duration:181}),/180/);
  await assert.rejects(()=>player.exportWav([{time:0,duration:2,value:0},{time:1,duration:2,value:0}]),/solapamientos/);
  await player.exportWav([{time:0,duration:30,value:0}],{duration:30,heartbeat:true});
  const hearts=contexts[contexts.length-1].sources.filter(source=>source.sampleInstrument==='heartbeat');assert.equal(hearts.length,30);assert.ok(hearts.some(source=>source.startedAt>=29));
});

function valueAt(param,time) {
  let previous={time:0,value:1};
  for(const [kind,value,at] of param.events.slice().sort((a,b)=>a[2]-b[2])) {
    if(at>time)return kind==='exp'&&previous.time<time?previous.value*Math.pow(value/previous.value,(time-previous.time)/(at-previous.time)):previous.value;
    previous={time:at,value};
  }
  return previous.value;
}
const heldScore=()=>({durationSeconds:12,notes:[{time:0,duration:10,midi:60,velocity:.8,instrument:'violin',channel:0}]});

test('smooth temperature interpolates pitch and integrates exponential tempo continuously',async()=>{
  const {player,engine,advance,timers}=setup(heldScore());await player.start({value:0});advance(.1);
  const source=engine.context.sources[0],before=player.position;player.setTemperature(2,{smooth:true});
  assert.equal(player.params.value,0);assert.ok(timers.size<=2);
  advance(.1);assert.ok(Math.abs(player.params.value-1)<1e-9);assert.ok(Math.abs(player.params.rate-Math.SQRT2)<1e-9);assert.ok(Math.abs(player.params.semitones+6)<1e-9);
  const integrated=.2/Math.LN2*(Math.SQRT2-1);assert.ok(Math.abs(player.position-before-integrated)<1e-9);
  advance(.0125);assert.ok(Math.abs(player.params.value-1.125)<1e-8);
  assert.ok(Math.abs(valueAt(source.playbackRate,engine.context.currentTime)-Math.pow(2,-1.125/2))<1e-8);
  advance(.0875);assert.ok(Math.abs(player.params.value-2)<1e-8);assert.ok(Math.abs(player.position-before-.2/Math.LN2)<1e-8);
  assert.equal(engine.context.sources.length,1);assert.equal(player._glide,null);assert.equal(timers.size,1);
});

test('retargeting starts at the instantaneous value and targeting that value cancels the old destination',async()=>{
  const {player,engine,advance}=setup(heldScore());await player.start({value:0});advance(.05);player.setTemperature(2,{smooth:true});advance(.1);
  const current=player.params.value,position=player.position;player.setTemperature(-2,{smooth:true});
  assert.ok(Math.abs(player.params.value-current)<1e-9);assert.ok(Math.abs(player.position-position)<1e-9);
  advance(.1);assert.ok(Math.abs(player.params.value+.5)<1e-8);
  const held=player.params.value;player.setTemperature(held,{smooth:true});assert.equal(player._glide,null);
  const time=engine.context.currentTime;
  assert.ok(engine.context.sources[0].playbackRate.events.every(event=>event[0]!=='exp'||event[2]<=time));
  advance(.4);assert.equal(player.params.value,held);assert.equal(engine.context.sources.length,1);
});

test('floods every ten milliseconds progress smoothly without postponing ticks or accumulating timers',async()=>{
  const {player,advance,timers}=setup(heldScore());const progress=[];await player.start({value:0,onProgress:event=>progress.push(event)});advance(.05);
  let previous=player.position,firstTimer=null;
  for(let index=0;index<100;index++) {
    const current=player.params.value,position=player.position;
    player.setTemperature(.8+(index%20)/20,{smooth:true});
    assert.ok(Math.abs(player.params.value-current)<1e-8);assert.ok(Math.abs(player.position-position)<1e-8);
    if(index===0)firstTimer=player._glideTimer;
    if(index===1||index===2)assert.equal(player._glideTimer,firstTimer);
    advance(.01);assert.ok(player.position>previous);previous=player.position;assert.ok(timers.size<=2);
  }
  assert.ok(player.params.value>.5);assert.ok(progress.length<=50,'progress should follow bounded ticks, not duplicate hover callbacks');
  advance(.21);assert.ok(Math.abs(player.params.value-1.75)<1e-8);assert.equal(player._glideTimer,null);assert.equal(timers.size,1);
});

test('hover repeatedly over an unchanged value does not postpone normal progress ticks',async()=>{
  const {player,advance,timers}=setup(heldScore());const progress=[];await player.start({value:0,onProgress:event=>progress.push(event)});
  for(let index=0;index<100;index++){player.setTemperature(0,{smooth:true});advance(.01);assert.equal(timers.size,1);}
  assert.ok(progress.length>=19&&progress.length<=22);assert.ok(Math.abs(player.position-1)<1e-8);
});

test('null, pause, stop and start cancel smooth transitions without stale callbacks reviving them',async()=>{
  const {player,advance,timers}=setup(heldScore());await player.start({value:0});advance(.05);player.setTemperature(2,{smooth:true});advance(.07);
  const position=player.position;player.setTemperature(null,{smooth:true});assert.equal(player.params.value,null);assert.equal(player.playing,false);assert.equal(timers.size,0);
  advance(.3);assert.equal(player.position,position);player.setTemperature(-1,{smooth:true});assert.equal(player.params.value,-1);assert.equal(player._glide,null);assert.equal(player.playing,true);
  player.setTemperature(2,{smooth:true});advance(.03);const queued=Array.from(timers.values());player.pause();assert.equal(timers.size,0);
  await player.start({value:0});player.setTemperature(-2,{smooth:true});const fresh=player._glideTimer;
  queued.forEach(entry=>entry.fn());assert.equal(player._glideTimer,fresh);assert.equal(timers.size,2);
  advance(.25);assert.ok(Math.abs(player.params.value+2)<1e-8);
  player.setTemperature(2,{smooth:true});player.stop();advance(.5);assert.equal(player.position,0);assert.equal(player.playing,false);assert.equal(player._glide,null);assert.equal(timers.size,0);
});

test('smooth retuning keeps forty-eight active sample voices without retriggering MIDI onsets',async()=>{
  const score={durationSeconds:12,notes:Array.from({length:48},(_,index)=>({time:0,duration:10,midi:60+index%12,velocity:.7,instrument:'violin',channel:0}))};
  const {player,engine,advance,timers}=setup(score);await player.start({value:0});advance(.05);const sources=engine.context.sources.slice();
  for(let index=0;index<20;index++){player.setTemperature(index%2?2:-2,{smooth:true});advance(.025);assert.equal(player._voices.size,48);assert.ok(timers.size<=2);}
  assert.equal(engine.context.sources.length,48);assert.ok(sources.every((source,index)=>engine.context.sources[index]===source));
  for(const voice of player._voices)assert.ok(Math.abs(Number(voice.sample.midi)+12*Math.log2(voice.pitchRate)-voice.note.midi-player.params.semitones)<1e-8);
});

test('new notes during a glide follow the integrated score clock',async()=>{
  const score={durationSeconds:3,notes:[{time:0,duration:2,midi:60,velocity:.8,instrument:'violin',channel:0},{time:.15,duration:.3,midi:64,velocity:.7,instrument:'violin',channel:0}]};
  const {player,engine,advance}=setup(score);await player.start({value:0});advance(.02);player.setTemperature(2,{smooth:true});advance(.3);
  const audible=engine.context.sources.filter(source=>source.scoreNote===1&&source.stoppedAt>source.startedAt);
  assert.equal(audible.length,1);
  const expected=.02+Math.log1p(.13*Math.LN2/.2)/(Math.LN2/.2);
  assert.ok(Math.abs(audible[0].startedAt-expected)<=.0081);
});
