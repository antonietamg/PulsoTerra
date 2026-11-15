const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Reuse the player's audio clock and Web Audio fixture. The map controller below
// is production code; only the DOM and the map's sampled temperatures are fake.
const audioTests=fs.readFileSync(path.join(__dirname,'vivaldi-player.test.cjs'),'utf8');
const audioSetup=new Function('require','__dirname','Blob',audioTests.slice(0,audioTests.indexOf("test('signed temperature"))+'\nreturn setup;')(require,__dirname,Blob);
const app=fs.readFileSync(path.join(__dirname,'../dist/atlas-app.js'),'utf8');
function between(start,end){const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a,'controller fixture anchors exist');return app.slice(a,b);}

function setup(){
  const audio=audioSetup({durationSeconds:20,notes:[{time:0,duration:19,midi:60,velocity:.8,channel:0,instrument:'violin'}]});
  const state={collection:'geography',mode:'explore',selected:'2023',region:'auto',ready:true,preparing:false,playing:false,token:0,geoRequest:0,geoSource:'scan',geoPlan:null,geoStep:-1,selection:null,scan:-1,plan:null,index:0,duration:0};
  const frames=new Map(),listeners=new Map(),captures=new Set(),reads=[],temperatures=[],status=[];let frameId=0,starts=0,unlocks=0,modeUpdates=0;
  const rect={left:10,top:20,width:320,height:160,right:330,bottom:180};
  const stage={getBoundingClientRect:()=>rect,addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(callback);},setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture(id){captures.delete(id);dispatch('lostpointercapture',{pointerId:id});}};
  const elements=new Map([['mapStage',stage],['regionSelect',{value:'auto'}],['impactPreview',{pause(){}}],['heartPreview',{pause(){}}]]);
  const originalSet=audio.player.setTemperature.bind(audio.player),originalStart=audio.player.start.bind(audio.player),originalUnlock=audio.player.unlock.bind(audio.player);
  audio.player.setTemperature=(value,options)=>{temperatures.push({value,smooth:options?.smooth});return originalSet(value,options);};
  audio.player.start=options=>{starts++;return originalStart(options);};
  audio.player.unlock=()=>{unlocks++;return originalUnlock();};
  function dispatch(name,options={}){const event=Object.assign({pointerId:1,pointerType:'mouse',button:0,buttons:0,clientX:90,clientY:100},options);for(const callback of listeners.get(name)||[])callback(event);}
  const context=vm.createContext({state,vivaldi:audio.player,engine:audio.engine,$:id=>elements.get(id),requestAnimationFrame(callback){const id=++frameId;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),clearTimeout(){},readSelection(selection){state.selection=selection;reads.push(selection);},selectionAt(id,x,y){return {frameId:id,x,y,value:x>=.45&&x<.55?null:x<.45?-1.25:1.75,region:{id:'test',label:'Zona de prueba'}};},updateMode(){modeUpdates++;},updateButtons(){},drawOverlay(){},progress(){},say:text=>status.push(text),fail:text=>assert.fail(text),async startGeographic(value){state.playing=true;state.preparing=false;await audio.player.start({value,offset:audio.player.position});}});
  vm.runInContext('let dragging=false,pendingPointer=null,pointerFrame=0,timer=0,animation=0;\n'+
    between('function stop(','function drawOverlay(')+
    between('function geographicOriginal(','function readGeographicMusic(')+
    between('async function listenSelection(','function beatDuration(')+
    between('function pointerSelection(','$(\'vivaldiMap\').addEventListener')+
    between("$('mapStage').addEventListener('pointerdown'","$('mapStage').addEventListener('keydown'")+
    '\nthis.controller={stop,clearMapMotion};',context);
  return {state,audio,reads,temperatures,frames,captures,status,dispatch,rect,context,
    flush(){const pending=[...frames.entries()];frames.clear();for(const [,callback]of pending)callback();},
    async start(){await audio.player.start({value:0});state.playing=true;},
    stop(){context.controller.stop(false);},
    get starts(){return starts;},get unlocks(){return unlocks;},get modeUpdates(){return modeUpdates;}};
}

test('mouse and pen hover preview before play and after pause without unlocking or starting audio',async()=>{
  for(const pointerType of ['mouse','pen']){
    const f=setup();f.dispatch('pointermove',{pointerType});f.flush();
    assert.equal(f.reads.length,1);assert.equal(f.starts,0);assert.equal(f.unlocks,0);assert.equal(f.temperatures.length,0);
    await f.start();f.audio.advance(.4);f.stop();const position=f.audio.player.position,starts=f.starts,unlocks=f.unlocks;
    f.dispatch('pointermove',{pointerType,clientX:270});f.flush();f.audio.advance(.3);
    assert.equal(f.starts,starts);assert.equal(f.unlocks,unlocks);assert.equal(f.temperatures.length,0);assert.equal(f.audio.player.playing,false);assert.equal(f.audio.player.position,position);
  }
});

test('button-free live hover coalesces to the latest point and keeps the same performance',async()=>{
  const f=setup();await f.start();f.audio.advance(.4);const position=f.audio.player.position,source=f.audio.engine.context.sources[0],starts=f.starts;
  for(const clientX of [60,100,220,270])f.dispatch('pointermove',{clientX,buttons:0});
  assert.equal(f.frames.size,1);assert.equal(f.temperatures.length,0);f.flush();
  assert.equal(f.temperatures.length,1);assert.equal(f.temperatures[0].value,1.75);assert.equal(f.temperatures[0].smooth,true);assert.equal(f.starts,starts);assert.equal(f.audio.player.position,position);
  assert.equal(f.audio.engine.context.sources[0],source);assert.equal(f.audio.engine.context.sources.filter(s=>s.scoreNote===0).length,1);
});

test('live hover takes over an automatic scan or comparison before the next tick',async()=>{
  const f=setup();await f.start();f.state.mode='compare';f.state.region='europe';f.state.geoPlan={steps:[{}]};f.state.geoStep=3;f.state.geoSource='compare';f.state.scan=.4;
  f.dispatch('pointermove');f.flush();
  assert.equal(f.state.mode,'explore');assert.equal(f.modeUpdates,1);assert.equal(f.state.region,'auto');assert.equal(f.state.geoPlan,null);assert.equal(f.state.geoStep,-1);assert.equal(f.state.geoSource,'point');assert.equal(f.state.scan,-1);
});

test('pointer leave and cancellation discard queued points and retain the last applied temperature',async()=>{
  for(const eventName of ['pointerleave','pointercancel']){
    const f=setup();await f.start();f.dispatch('pointermove');f.flush();const selection=f.state.selection;
    f.dispatch('pointermove',{clientX:270});assert.equal(f.frames.size,1);f.dispatch(eventName);f.flush();
    assert.equal(f.frames.size,0);assert.equal(f.temperatures.length,1);assert.equal(f.state.selection,selection);
  }
});

test('a captured drag outside the map never fabricates an edge temperature',async()=>{
  const f=setup();await f.start();f.dispatch('pointerdown',{pointerType:'touch',buttons:1});assert.equal(f.captures.has(1),true);const selection=f.state.selection,calls=f.temperatures.length;
  f.dispatch('pointermove',{pointerType:'touch',buttons:1,clientX:270});
  f.dispatch('pointermove',{pointerType:'touch',buttons:1,clientX:350});f.flush();
  assert.equal(f.temperatures.length,calls);assert.equal(f.state.selection,selection);assert.equal(f.frames.size,0);
  f.dispatch('pointerup',{pointerType:'touch'});assert.equal(f.captures.size,0);
});

test('touch movement previews until dragging, then updates live music',async()=>{
  const f=setup();await f.start();f.dispatch('pointermove',{pointerType:'touch',clientX:270});f.flush();assert.equal(f.temperatures.length,0);
  f.dispatch('pointerdown',{pointerType:'touch',buttons:1});const calls=f.temperatures.length;
  f.dispatch('pointermove',{pointerType:'touch',buttons:1,clientX:270});f.flush();assert.equal(f.temperatures.length,calls+1);assert.equal(f.temperatures.at(-1).value,1.75);
});

test('queued movement is invalidated by pause, a new map, a token or a blocked surface',async()=>{
  const changes=[f=>f.stop(),f=>{f.state.selected='2000';},f=>{f.state.token++;},f=>{f.state.ready=false;},f=>{f.state.preparing=true;},f=>{f.state.collection='impacts';}];
  for(const change of changes){
    const f=setup();await f.start();f.dispatch('pointermove');const stale=[...f.frames.values()][0];change(f);f.flush();stale();assert.equal(f.temperatures.length,0);assert.equal(f.reads.length,0);
  }
});

test('missing pixels silence and freeze the score; a valid hover resumes at that position',async()=>{
  const f=setup();await f.start();f.audio.advance(.4);const position=f.audio.player.position,starts=f.starts;
  f.dispatch('pointermove',{clientX:170});f.flush();assert.equal(f.state.selection.value,null);assert.equal(f.state.playing,true);assert.equal(f.audio.player.playing,false);f.audio.advance(.6);assert.equal(f.audio.player.position,position);
  f.dispatch('pointermove',{clientX:270});f.flush();assert.equal(f.audio.player.playing,true);assert.equal(f.audio.player.position,position);assert.equal(f.starts,starts);f.audio.advance(.3);assert.ok(f.audio.player.position>position);
});
