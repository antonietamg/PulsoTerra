(function () {
'use strict';
const $=id=>document.getElementById(id), policy=window.SonificationPolicy, geo=window.ClimateGeography, content=window.AtlasContent;
const frames=[...(window.EXTRA_NASA_FRAMES||[]),...window.NASA_DATA.frames.filter(f=>Number(f.year)!==1900)].sort((a,b)=>a.year-b.year);
const recordThumbnails={'1890':'assets/records/1890.png','1920':'assets/records/1920.png','1950':'assets/records/1950.png','1980':'assets/records/1980.png','2000':'assets/records/2000.png','2023':'assets/records/2023.png'};
const state={collection:'geography',mode:'explore',selected:'2023',impact:'water',region:'auto',detail:12,playing:false,preparing:false,ready:false,token:0,loadToken:0,selection:null,plan:null,index:0,progress:0,duration:0,start:0,scan:-1};
const imageCache=new Map(),rawCache=new Map(),models=new Map(),requests=new Map(),engine=new window.AtlasAudioEngine(),overlay=$('mapOverlay'),cx=overlay.getContext('2d');
const vivaldi=new window.VivaldiPlayer(engine,window.VivaldiScore);
Object.assign(state,{geoPlan:null,geoStep:-1,geoSource:'scan',geoRequest:0,geoNextBeat:0,geoBeat:0,geoAudio:'map'});
const jitter=[1,.73,1.31,.86,1.12,.65,1.24,.94],categories=window.PixelAnalysis.CATEGORIES;
let timer=0,animation=0,heartTimer=0,dragging=false,pointerFrame=0,pendingPointer=null;
engine.setVolume(.45);engine.setHeartbeat(true);
window.AnomalyAnalysis.configurePalette(window.NASA_DATA.palette);window.PixelAnalysis.configurePalette(window.NASA_DATA.palette);
const src=f=>f.imageDataUrl||f.image,frame=id=>frames.find(f=>f.id===id),impact=()=>content.impacts.find(i=>i.id===state.impact);
const time=s=>{s=Math.max(0,Math.round(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const format=v=>{if(typeof v!=='number'||!Number.isFinite(v))return '—';const nearBoundary=[.5,1,1.5].some(t=>Math.abs(Math.abs(v)-t)<.006);return(v>0?'+':'')+v.toFixed(nearBoundary?3:2).replace('.',',');};
const note=m=>['Do','Do♯','Re','Mi♭','Mi','Fa','Fa♯','Sol','La♭','La','Si♭','Si'][m%12]+(Math.floor(m/12)-1);
let lastStatusSource='';
const say=t=>{if(lastStatusSource===t)return;lastStatusSource=t;$('status').textContent=t;if(window.PulsoExplorer)notifyAccessible();},fail=t=>{$('errorMessage').textContent=t;$('errorMessage').hidden=false;};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;};
function p(parent,text){parent.append(el('p',text));}
async function getImage(id){if(imageCache.has(id))return imageCache.get(id);const im=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('No se pudo abrir el mapa de '+id));im.src=src(frame(id));});imageCache.set(id,im);return im;}
async function getRaw(id){if(rawCache.has(id))return rawCache.get(id);const im=await getImage(id),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const raw=x.getImageData(0,0,c.width,c.height);rawCache.set(id,raw);return raw;}
async function getModel(id,columns=32,rows=16){const key=id+'/'+columns+'/'+rows;if(models.has(key))return models.get(key);if(requests.has(key))return requests.get(key);const task=(async()=>{const raw=await getRaw(id);await new Promise(r=>setTimeout(r,0));const m=window.AnomalyAnalysis.analyze(raw,{columns,rows});models.set(key,m);requests.delete(key);return m;})();requests.set(key,task);return task;}
const currentModel=()=>models.get(state.selected+'/32/16');
function pulse(){clearTimeout(heartTimer);$('heartSymbol').classList.remove('beat');void $('heartSymbol').offsetWidth;$('heartSymbol').classList.add('beat');heartTimer=setTimeout(()=>$('heartSymbol').classList.remove('beat'),350);}
function progress(v){state.progress=Math.max(0,Math.min(1,v));$('progressBar').style.width=100*state.progress+'%';$('timeReadout').textContent=time(state.duration*state.progress)+' / '+time(state.duration);}
function syncRecordMotion(){$('timeline').classList.toggle('is-playing',state.playing&&(state.collection==='impacts'||vivaldi.playing));}
function updateButtons(){$('playButton').disabled=!state.ready||state.preparing;$('playButton').classList.toggle('playing',state.playing);$('playIcon').textContent=state.playing?'Ⅱ':'▶';$('playLabel').textContent=state.preparing?'Preparando…':state.playing?'Pausar':state.collection==='impacts'?'Escuchar por filas':geographicOriginal()?'Escuchar original':state.mode==='compare'?'Vivaldi entre fechas':'Escuchar Vivaldi';$('liveBadge').hidden=!state.playing;$('mapHint').hidden=state.playing||state.collection==='impacts';$('exportButton').disabled=!state.ready||state.preparing;$('exportButton').textContent=state.collection==='geography'?'↓ Descargar muestra de 30 s en WAV':'↓ Descargar recorrido en WAV';updateVivaldiComparison();syncRecordMotion();}
function stop(reset=false,keepPreview=null){state.token++;state.geoRequest++;clearMapMotion();clearTimeout(timer);cancelAnimationFrame(animation);state.playing=false;state.preparing=false;if(reset)vivaldi.stop();else vivaldi.pause();engine.stop();for(const id of ['impactPreview','heartPreview'])if($(id)!==keepPreview)$(id).pause();state.playing=false;state.preparing=false;state.scan=-1;if(reset){state.plan=null;state.geoPlan=null;state.geoStep=-1;state.index=0;state.duration=0;progress(0);}updateButtons();drawOverlay();}
function drawOverlay(){
 const w=overlay.width,h=overlay.height,s=state.selection;cx.clearRect(0,0,w,h);if(!state.ready)return;
 if(state.collection==='impacts'){const cols=state.detail,rows=cols/2;cx.strokeStyle='rgba(240,247,237,.20)';cx.lineWidth=1;for(let x=0;x<=cols;x++){cx.beginPath();cx.moveTo(x/cols*w,0);cx.lineTo(x/cols*w,h);cx.stroke();}for(let y=0;y<=rows;y++){cx.beginPath();cx.moveTo(0,y/rows*h);cx.lineTo(w,y/rows*h);cx.stroke();}if(s&&s.gridColumns===cols){const cw=w/cols,ch=h/rows;cx.fillStyle='rgba(238,246,222,.22)';cx.fillRect(s.col*cw,s.row*ch,cw,ch);cx.strokeStyle='#fff3bd';cx.lineWidth=w/330;cx.strokeRect(s.col*cw+1,s.row*ch+1,cw-2,ch-2);}}
 else if(state.scan>=0){const x=state.scan*w;cx.fillStyle='rgba(230,247,215,.12)';cx.fillRect(x-w*.025,0,w*.025,h);cx.strokeStyle='#eef8de';cx.lineWidth=w/450;cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,h);cx.stroke();}
 else if(s&&Number.isFinite(s.x)){cx.beginPath();cx.arc(s.x*w,s.y*h,w/90,0,Math.PI*2);cx.fillStyle='#162e3c99';cx.fill();cx.strokeStyle='#fff3be';cx.lineWidth=w/450;cx.stroke();cx.beginPath();cx.moveTo(s.x*w-w/55,s.y*h);cx.lineTo(s.x*w+w/55,s.y*h);cx.moveTo(s.x*w,s.y*h-w/55);cx.lineTo(s.x*w,s.y*h+w/55);cx.stroke();}
}
function distribution(m){$('distributionBar').replaceChildren(...m.histogram.map((v,i)=>{const s=el('span');s.style.width=v*100+'%';s.style.background=categories[i].color;s.title=categories[i].label+': '+Math.round(v*100)+' %';return s;}));$('pixelCount').textContent=Math.round(m.validCount/1000)+' mil píxeles';$('distributionText').textContent=Math.round((m.histogram[0]+m.histogram[1])*100)+' % fríos · '+Math.round(m.histogram[2]*100)+' % cerca de referencia · '+Math.round((m.histogram[3]+m.histogram[4])*100)+' % cálidos. Proporciones visuales, sin ponderación de superficie.';}
function updateMapLabel(){const thematic=state.collection==='impacts';$('mapStage').classList.toggle('impact-map',thematic);$('mapStage').tabIndex=thematic?-1:0;$('mapStage').setAttribute('aria-label',thematic?'Mapa temático de temperatura, no interactivo. Escuchar por filas inicia el recorrido.':'Mapa geográfico de '+state.selected+'. Tras iniciar, mueve el cursor sin presionar para transformar la música. Flechas para explorar y Enter para escuchar.');document.querySelector('.map-kicker').textContent=thematic?'MAPA TEMÁTICO · '+impact().short.toUpperCase():'ANOMALÍA DE TEMPERATURA';document.querySelector('.map-subtitle').textContent=thematic?'Temperatura como guía musical · no es un mapa de daños':'Respecto al promedio de 1951–1980 · 24 meses';document.querySelector('.map-caption p').textContent=thematic?'Por filas · izquierda a derecha':'Vivaldi · pitch y tempo según temperatura';}
function showFrame(id){state.selected=id;const f=frame(id),im=imageCache.get(id);$('mapImage').src=src(f);$('mapImage').alt='NASA '+f.label+', anomalías locales respecto a 1951–1980, promedio móvil de 24 meses';$('mapYear').textContent=f.label;if(im){overlay.width=im.naturalWidth;overlay.height=im.naturalHeight;$('mapStage').style.aspectRatio=im.naturalWidth+' / '+im.naturalHeight;}document.querySelectorAll('.frame-button').forEach(b=>{const yes=b.dataset.id===id;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));b.querySelector('.frame-state').textContent=yes?'Seleccionada':'Explorar';});const m=currentModel();if(m)distribution(m);updateMapLabel();drawOverlay();}
function resetReadout(){const thematic=state.collection==='impacts';$('cellReadout').textContent=thematic?'Recorrido por filas · de izquierda a derecha':'Selecciona una zona o una región';$('valueReadout').textContent='ΔT ≈ — °C';$('pitchReadout').textContent=thematic?'Nota guía —':'Transposición —';$('scaleReadout').textContent=thematic?'Modo según anomalía':'Armonía del MIDI';$('bpmReadout').textContent='—';$('pulseReadout').textContent='A la espera de una zona';$('instrumentReadout').textContent=thematic?impact().instrument:'Vivaldi · MIDI';$('instrumentOrigin').textContent=thematic?impact().reference:'Cuerdas y vientos muestreados · '+window.VivaldiScore.notes.length.toLocaleString('es')+' notas del archivo compartido.';$('musicReadout').hidden=thematic;$('musicReadout').textContent='Tempo musical de referencia: '+window.VivaldiScore.tempos[0].bpm+' BPM · 1,00×';if(geographicOriginal()){readGeographicMusic(window.VivaldiPlayer.describe(0));$('pulseReadout').textContent='Sin latido · comparación original';}}
async function selectFrame(id){const preserve=state.collection==='geography'&&(state.playing||vivaldi.position>0),resume=state.playing,previous=state.selection;stop(!preserve);state.geoPlan=null;state.selection=null;const load=++state.loadToken;state.ready=false;$('loading').hidden=false;say('Preparando mapa de '+id);updateButtons();try{await getModel(id);if(load!==state.loadToken)return;state.ready=true;$('loading').hidden=true;showFrame(id);resetReadout();updateButtons();say('Mapa listo para escuchar');if(preserve&&previous){const r=geo.regions.find(r=>r.id===state.region),s=r?regionSelection(id,r):selectionAt(id,previous.x,previous.y);state.geoSource='point';readSelection(s);vivaldi.setTemperature(geographicValue(s.value));if(resume)await listenSelection(s);}else if(preserve&&resume&&geographicOriginal())await startGeographic(0);}catch(e){if(load===state.loadToken){state.ready=false;updateButtons();fail(e.message);}}}
function selectionAt(id,x,y,forcedRegion){const col=Math.max(0,Math.min(31,Math.floor(x*32))),row=Math.max(0,Math.min(15,Math.floor(y*16))),raw=rawCache.get(id);let value=null;if(raw){const values=[],px=Math.floor(x*raw.width),py=Math.floor(y*raw.height);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=px+dx,yy=py+dy;if(xx<0||yy<0||xx>=raw.width||yy>=raw.height)continue;const i=(yy*raw.width+xx)*4;const v=window.AnomalyAnalysis.estimatePixel([raw.data[i],raw.data[i+1],raw.data[i+2],raw.data[i+3]]);if(v!==null)values.push(v);}if(values.length){values.sort((a,b)=>a-b);value=values[Math.floor(values.length/2)];}}const r=geo.atPixel(x,y)||{id:'ocean',label:'Fuera del mapa',instrument:'Silencio',origin:''};return {frameId:id,x,y,col,row,value,region:forcedRegion?Object.assign({},r,forcedRegion):r,gridColumns:32};}
function regionSelection(id,r){const pos=geo.forwardRobinson(r.center.lat,r.center.lon);return selectionAt(id,pos.x,pos.y,r);}
function geographicOriginal(){return state.collection==='geography'&&state.geoAudio==='original';}
function geographicValue(value){return geographicOriginal()?0:value;}
function syncGeographicHeartbeat(){
 engine.setHeartbeat(!geographicOriginal()&&$('heartbeat').checked);state.geoNextBeat=0;
 if(geographicOriginal()){engine.stop();clearTimeout(heartTimer);$('heartSymbol').classList.remove('beat');}
}
function updateVivaldiComparison(){
 $('vivaldiComparison').hidden=state.collection!=='geography';const original=geographicOriginal();
 for(const [id,selected]of [['vivaldiMap',!original],['vivaldiOriginal',original]]){$(id).setAttribute('aria-pressed',String(selected));$(id).disabled=!state.ready||state.preparing;}
 $('vivaldiComparisonNote').textContent=original?'Referencia original: altura del MIDI y 100 BPM, sin latido. El cursor sólo muestra la temperatura.':'La temperatura transforma la misma pieza. Compara con el original sin reiniciarla.';
}
async function setGeographicAudio(mode){
 if(state.collection!=='geography'||!state.ready||state.preparing)return;
 state.geoAudio=mode==='original'?'original':'map';
 if(!geographicOriginal()&&!state.playing&&state.selection){state.geoSource='point';state.geoPlan=null;state.geoStep=-1;state.scan=-1;state.mode='explore';state.region='auto';$('regionSelect').value='auto';}
 syncGeographicHeartbeat();updateMode();updateMapLabel();
 if(state.selection)readSelection(state.selection);else resetReadout();
 if(geographicOriginal()){
  if(state.playing){vivaldi.setTemperature(0);readGeographicMusic(vivaldi.params);say('Vivaldi original · misma posición, sin transformación ni latido');}
  else await playGeographic();
  return;
 }
 if(state.playing&&!state.selection&&!state.geoPlan){
  const token=state.token;state.preparing=true;updateButtons();
  try{const plan=await buildGeographicPlan();if(token!==state.token)return;state.geoPlan=plan;state.geoStep=-1;applyGeographicStep(vivaldi.position,{smooth:true});}
  catch(e){if(token===state.token){vivaldi.setTemperature(null);fail(e.message);}}
  finally{if(token===state.token){state.preparing=false;updateButtons();}}
 }else vivaldi.setTemperature(state.selection?.value??null,{smooth:state.playing});
 if(state.selection)readSelection(state.selection);
 say(state.playing?'Según el mapa · cambio suave desde la misma posición':'Según el mapa seleccionado · pulsa Escuchar Vivaldi para continuar');
}
function readGeographicMusic(m){
 if(!m||m.value===null)return;
 const rounded=Number(m.semitones.toFixed(1));$('pitchReadout').textContent=(rounded>0?'+':'')+rounded.toFixed(1).replace('.',',')+' semitonos';$('scaleReadout').textContent='Armonía del MIDI';
 const original=window.VivaldiScore.tempos.filter(t=>t.time<=vivaldi.position).at(-1)?.bpm||100;$('musicReadout').textContent=(geographicOriginal()?'Vivaldi original: ':'Tempo musical: ')+Math.round(original*m.rate)+' BPM · '+m.rate.toFixed(2).replace('.',',')+'×';
}
function readSelection(s){
 if(!s)return;state.selection=s;const d=policy.describe(s.value),r=s.region||{},thematic=state.collection==='impacts';
 $('instrumentReadout').textContent=thematic?impact().instrument:'Vivaldi · MIDI';$('instrumentOrigin').textContent=thematic?impact().reference:'La misma pieza en todas las regiones · interpretación con cuerdas y vientos muestreados.';
 if(!d){$('cellReadout').textContent=(r.label?r.label+' · ':'')+(geographicOriginal()?'Sin píxeles válidos · referencia original':'Sin píxeles válidos · silencio');$('valueReadout').textContent='ΔT ≈ sin dato';$('pitchReadout').textContent='Silencio';$('scaleReadout').textContent='Sin dato';$('bpmReadout').textContent='—';$('pulseReadout').textContent=geographicOriginal()?'Sin latido · comparación original':'Sin latido asignado';if(!thematic){if(geographicOriginal())readGeographicMusic(window.VivaldiPlayer.describe(0));else $('musicReadout').textContent='Sin datos · la pieza queda en silencio';}drawOverlay();return;}
 const where=r.label==='Ejemplo de la leyenda'?r.label:thematic?'Fila '+(s.row+1)+', columna '+(s.col+1):(r.label||'Zona del mapa');$('cellReadout').textContent=where+' · '+d.label;$('valueReadout').textContent='ΔT ≈ '+format(d.value)+' °C';$('bpmReadout').textContent=d.bpm;$('pulseReadout').textContent=d.tempoLabel;
 if(thematic){$('pitchReadout').textContent='Guía '+note(d.midi);$('scaleReadout').textContent=d.mode==='minor'?'Modo menor':'Modo mayor';}
 else{readGeographicMusic(geographicOriginal()?window.VivaldiPlayer.describe(0):state.playing&&vivaldi.params.value!==null?vivaldi.params:window.VivaldiPlayer.describe(d.value));if(geographicOriginal()){$('bpmReadout').textContent='—';$('pulseReadout').textContent='Sin latido · comparación original';}}
 if(thematic&&state.impact==='biodiversity')$('instrumentOrigin').textContent=Math.min(4,d.variety)+' '+(d.variety===1?'tipo de llamada animal':'tipos de llamadas animales')+' · grabaciones reales, no conteo de especies';drawOverlay();
}
function zone(s,duration,heartbeat=true){const d=policy.describe(s.value);if(!d)return null;return {value:d.value,regionId:s.region?.id||'neutral',impactId:state.collection==='impacts'?state.impact:null,pitchMidi:d.midi,mode:d.mode,bpm:d.bpm,irregular:d.irregular,variety:Math.min(4,d.variety),duration,pan:(s.x-.5)*1.4,heartbeat:heartbeat&&$('heartbeat').checked,strength:.62};}
async function listenSelection(s,{smooth=false}={}){
 if(!state.ready||state.collection!=='geography')return;
 state.geoSource='point';state.geoPlan=null;state.geoStep=-1;state.scan=-1;readSelection(s);const request=++state.geoRequest,token=state.token;
 if(!Number.isFinite(s.value)&&!geographicOriginal()){vivaldi.setTemperature(null);engine.stop();state.preparing=false;updateButtons();say('Sin datos · Vivaldi en silencio hasta elegir una zona válida');return;}
 if(state.playing){vivaldi.setTemperature(geographicValue(s.value),{smooth:!geographicOriginal()&&smooth});say(geographicOriginal()?'Vivaldi original · el cursor muestra la temperatura':'Vivaldi · '+s.region.label);return;}
 state.preparing=true;updateButtons();
 try{await vivaldi.unlock();if(request!==state.geoRequest||token!==state.token||state.collection!=='geography')return;if(state.playing)vivaldi.setTemperature(geographicValue(s.value),{smooth:!geographicOriginal()&&smooth});else await startGeographic(geographicValue(s.value));say(geographicOriginal()?'Vivaldi original · sin transformación ni latido':'Vivaldi · '+s.region.label);}
 catch(e){if(request===state.geoRequest){stop(false);fail('No se pudo activar Vivaldi: '+e.message);}}
 finally{if(request===state.geoRequest){state.preparing=false;updateButtons();}}
}
function beatDuration(v,i){const d=policy.describe(v);return d?60/d.bpm*(d.irregular?jitter[i%jitter.length]:1):.12;}
async function buildPlan(){
 const token=state.token,collection=state.collection,mode=state.mode,selected=state.selected,selectedRegion=state.region,detail=state.detail,wanted=collection==='geography'&&mode==='compare'?frames:[frame(selected)],steps=[];let cursor=0;
 function add(id,voices,selection,kind,scan){const valid=voices.filter(s=>typeof s.value==='number'&&Number.isFinite(s.value)),lead=valid.length?valid.reduce((a,b)=>Math.abs(a.value)>=Math.abs(b.value)?a:b):selection,duration=beatDuration(lead.value,steps.length),options=valid.map(s=>Object.assign(zone(s,collection==='impacts'?duration:Math.min(duration*.84,60/policy.describe(s.value).bpm*.88),false),{sequenceIndex:steps.length}));if(options.length)options[valid.indexOf(lead)].heartbeat=$('heartbeat').checked;steps.push({frameId:id,time:cursor,duration,selection:lead,options,kind,scan});cursor+=duration;}
 for(let i=0;i<wanted.length;i++){say('Preparando recorrido '+(i+1)+' de '+wanted.length);const id=wanted[i].id;await getModel(id);if(token!==state.token)return null;
  if(collection==='impacts'){const m=await getModel(id,detail,detail/2);if(token!==state.token)return null;m.cells.forEach(c=>{const s={frameId:id,x:(c.col+.5)/m.columns,y:(c.row+.5)/m.rows,col:c.col,row:c.row,value:c.value,region:{id:'neutral',label:impact().label},gridColumns:m.columns};add(id,[s],s,'raster',-1);});}
  else if(mode==='compare'){const regions=selectedRegion==='auto'?geo.regions:geo.regions.filter(r=>r.id===selectedRegion);regions.forEach(r=>{const s=regionSelection(id,r);add(id,[s],s,'region',-1);});}
  else {const m=models.get(id+'/32/16');for(let col=0;col<detail;col++){const x=(col+.5)/detail,voices=[3,6,9,12].map(row=>{const y=(row+.5)/16,c=m.cells[row*32+Math.min(31,Math.floor(x*32))];return {frameId:id,x,y,row,col:Math.floor(x*32),value:c.value,region:geo.atPixel(x,y)||{id:'ocean',label:'Fuera del mapa'},gridColumns:32};});add(id,voices,voices[0],'scan',x);}}
 }
 return {steps,duration:cursor,events:steps.flatMap(s=>s.options.map(options=>({time:s.time,options}))),collection,mode,impact:state.impact};
}
async function buildGeographicPlan(){
 const token=state.token,steps=[],wanted=state.mode==='compare'?frames:[frame(state.selected)];
 for(const f of wanted){await getModel(f.id);if(token!==state.token)return null;
  if(state.mode==='compare'){
   const regions=state.region==='auto'?geo.regions:geo.regions.filter(r=>r.id===state.region);
   for(const r of regions){const s=regionSelection(f.id,r);if(Number.isFinite(s.value))steps.push({frameId:f.id,selection:s,kind:'region',scan:-1});}
  }else{
   const m=models.get(f.id+'/32/16');
   for(let col=0;col<state.detail;col++){const x=(col+.5)/state.detail,points=[3,6,9,12].map(row=>{const y=(row+.5)/16,c=m.cells[row*32+Math.min(31,Math.floor(x*32))];return {frameId:f.id,x,y,row,col:Math.floor(x*32),value:c.value,region:geo.atPixel(x,y)||{id:'ocean',label:'Océano'},gridColumns:32};}).filter(s=>Number.isFinite(s.value));if(points.length)steps.push({frameId:f.id,selection:points.reduce((a,b)=>Math.abs(a.value)>=Math.abs(b.value)?a:b),kind:'scan',scan:x});}
  }
 }
 if(!steps.length)throw new Error('Este recorrido no contiene temperaturas válidas.');
 return {steps,collection:'geography',mode:state.mode};
}
function applyGeographicStep(position,{smooth=false}={}){
 const plan=state.geoPlan;if(!plan)return;
 const index=Math.min(plan.steps.length-1,Math.floor(position/vivaldi.duration*plan.steps.length));if(index===state.geoStep)return;
 state.geoStep=index;const step=plan.steps[index];if(step.frameId!==state.selected)showFrame(step.frameId);state.scan=step.scan;readSelection(step.selection);vivaldi.setTemperature(geographicValue(step.selection.value),{smooth:!geographicOriginal()&&smooth});
 say((plan.mode==='compare'?'Vivaldi · comparando '+step.frameId:'Vivaldi · explorando el mapa')+' · '+(index+1)+' de '+plan.steps.length);
}
function geographicProgress(event){
 syncRecordMotion();
 if(!state.playing||state.collection!=='geography')return;
 applyGeographicStep(event.position);state.duration=vivaldi.duration;progress(event.position/vivaldi.duration);$('timeReadout').textContent=time(event.position)+' / '+time(vivaldi.duration)+' · MIDI';
 if(geographicOriginal()||Number.isFinite(state.selection?.value))readGeographicMusic(vivaldi.params);
 const d=policy.describe(state.selection?.value),now=performance.now()/1000;
 if(!geographicOriginal()&&d&&$('heartbeat').checked&&now>=state.geoNextBeat){engine.playZone(Object.assign(zone(state.selection,.12,true),{music:false}));pulse();state.geoNextBeat=now+60/d.bpm*(d.irregular?jitter[state.geoBeat++%jitter.length]:1);}
}
function geographicEnded(){stop(false);vivaldi.stop();state.geoStep=-1;progress(1);say('Pieza MIDI terminada');}
async function startGeographic(value){
 if(vivaldi.position>=vivaldi.duration)vivaldi.stop();
 syncGeographicHeartbeat();
 state.preparing=false;state.playing=true;state.geoNextBeat=0;state.geoBeat=0;state.duration=vivaldi.duration;updateButtons();
 await vivaldi.start({value:geographicValue(value),offset:vivaldi.position,onProgress:geographicProgress,onEnd:geographicEnded});
}
function currentGeographicPoint(){if(state.mode==='compare')return null;if(state.selection&&(state.geoSource==='point'||!state.geoPlan))return state.selection;const r=geo.regions.find(r=>r.id===state.region);return r?regionSelection(state.selected,r):null;}
async function playGeographic(){
 if(!state.ready||state.preparing)return;if(state.playing){stop(false);say('Vivaldi en pausa · continúa desde la misma nota');return;}
 const token=state.token,request=++state.geoRequest;state.preparing=true;updateButtons();$('impactPreview').pause();$('heartPreview').pause();say('Preparando la pieza MIDI de Vivaldi…');
 try{await vivaldi.unlock();if(token!==state.token||request!==state.geoRequest)return;
  const point=currentGeographicPoint();if(point){state.geoSource='point';if(state.region!=='auto'&&point.region?.id!==state.region){state.region='auto';$('regionSelect').value='auto';}readSelection(point);}
  if(!point&&(!geographicOriginal()||state.geoPlan)){state.geoPlan=state.geoPlan||await buildGeographicPlan();if(!state.geoPlan||token!==state.token||request!==state.geoRequest)return;state.geoStep=-1;applyGeographicStep(vivaldi.position);}
  await startGeographic(state.selection?.value??null);if(geographicOriginal())say('Vivaldi original · sin transformación ni latido');else if(point)say('Vivaldi · '+(state.selection.region?.label||'zona seleccionada'));
 }catch(e){if(token===state.token){stop(false);fail('No se pudo reproducir Vivaldi: '+e.message);}}
 finally{if(token===state.token){state.preparing=false;updateButtons();}}
}
async function exportGeographic(){
 if(!state.ready||state.preparing)return;stop(true);const token=state.token;state.preparing=true;updateButtons();say('Generando una muestra WAV de 30 segundos de Vivaldi…');
 try{await vivaldi.unlock();if(token!==state.token)return;let segments;
  const point=currentGeographicPoint();if(geographicOriginal())segments=[{time:0,duration:30,value:0}];
  else if(point&&!Number.isFinite(point.value))throw new Error('La zona elegida no tiene datos; elige una zona válida para exportar.');else if(point)segments=[{time:0,duration:30,value:point.value}];
  else{const plan=await buildGeographicPlan();if(!plan||token!==state.token)return;let cursor=0;segments=[];const span=vivaldi.duration/plan.steps.length;for(const step of plan.steps){const duration=span/window.VivaldiPlayer.describe(step.selection.value).rate;segments.push({time:cursor,duration,value:step.selection.value});cursor+=duration;if(cursor>=30)break;}}
  const blob=await vivaldi.exportWav(segments,{duration:30,offset:0,heartbeat:!geographicOriginal()&&$('heartbeat').checked});if(token!==state.token)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='PulsoTerra-Vivaldi-'+(geographicOriginal()?'original-':'mapa-')+'30s-'+state.selected+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);say('Muestra de 30 segundos descargada · '+(geographicOriginal()?'original sin latido':'según el mapa')+' · la pieza completa se escucha en la app');
 }catch(e){if(token===state.token)fail('No se pudo exportar Vivaldi: '+e.message);}
 finally{if(token===state.token){state.preparing=false;updateButtons();}}
}
async function play(){
 if(state.collection==='geography')return playGeographic();
 if(!state.ready||state.preparing)return;if(state.playing){stop(false);say('En pausa · puedes continuar este recorrido');return;}const token=state.token;state.preparing=true;updateButtons();
 try{$('impactPreview').pause();$('heartPreview').pause();say('Cargando grabaciones y preparando recorrido…');await engine.unlock();if(token!==state.token)return;const plan=state.plan||await buildPlan();if(!plan||token!==state.token)return;state.plan=plan;state.duration=plan.duration;state.preparing=false;state.playing=true;updateButtons();const first=Math.min(state.index,plan.steps.length-1),offset=plan.steps[first]?.time||0;state.start=performance.now()-offset*1000;
  const tick=now=>{if(!state.playing||token!==state.token)return;progress((now-state.start)/(plan.duration*1000));animation=requestAnimationFrame(tick);};
  const next=index=>{if(!state.playing||token!==state.token)return;if(index>=plan.steps.length){stop(false);state.index=0;state.plan=null;progress(1);say('Recorrido terminado');return;}state.index=index;const step=plan.steps[index];if(step.frameId!==state.selected)showFrame(step.frameId);state.scan=step.kind==='scan'?step.scan:-1;readSelection(step.selection);step.options.forEach(o=>engine.playZone(o));if(step.options.some(o=>o.heartbeat))pulse();say((plan.collection==='impacts'?'Recorrido por filas':plan.mode==='compare'?'Comparando '+step.frameId:'Explorando el mapa')+' · '+(index+1)+' de '+plan.steps.length);const due=(step.time+step.duration)*1000-(performance.now()-state.start);timer=setTimeout(()=>next(index+1),Math.max(5,due));};
  animation=requestAnimationFrame(tick);next(first);
 }catch(e){stop(true);fail('No se pudo iniciar el recorrido: '+e.message);}
}
function updateMode(){const compare=state.mode==='compare',thematic=state.collection==='impacts';$('exploreMode').classList.toggle('active',!compare);$('exploreMode').setAttribute('aria-pressed',String(!compare));$('compareMode').classList.toggle('active',compare);$('compareMode').setAttribute('aria-pressed',String(compare));document.querySelector('.step-mark').textContent=thematic?'POR FILAS':compare?'02 / 02':'01 / 02';$('modeDescription').textContent=thematic?'Cada recuadro se escucha de izquierda a derecha y de arriba hacia abajo. La anomalía cambia la nota, el modo, el latido y la tensión musical.':geographicOriginal()?'Referencia original: altura del MIDI y 100 BPM, sin latido. Según el mapa vuelve a transformar la misma pieza sin reiniciarla.':compare?'La pieza continúa al recorrer las seis fechas. Una región elegida permite comparar el mismo lugar.':'Inicia Vivaldi y mueve el cursor sobre el mapa sin presionar: frío más agudo y lento; calor más grave y rápido. En pantalla táctil, toca o arrastra. Sin una zona elegida, el botón recorre el mapa.';$('timelineHelp').textContent=compare?'Comparación cronológica de las seis fechas.':'Selecciona la imagen que quieres escuchar.';$('geographicExportNote').hidden=thematic;updateButtons();}
function setMode(mode){stop(true);state.mode=mode;state.geoSource=mode==='compare'?'compare':'scan';state.selection=null;updateMode();resetReadout();drawOverlay();say(mode==='compare'?'Comparación entre fechas con Vivaldi':'Exploración geográfica con Vivaldi');}
function setCollection(collection){if(state.collection===collection)return;stop(true);state.collection=collection;state.geoAudio='map';syncGeographicHeartbeat();state.selection=null;state.mode='explore';const theme=collection==='impacts';$('impactSection').hidden=!theme;$('regionPicker').hidden=theme;$('regionLegendButton').hidden=theme;document.querySelector('.mode-switch').hidden=theme;$('geographyTab').classList.toggle('active',!theme);$('geographyTab').setAttribute('aria-selected',String(!theme));$('geographyTab').tabIndex=theme?-1:0;$('impactsTab').classList.toggle('active',theme);$('impactsTab').setAttribute('aria-selected',String(theme));$('impactsTab').tabIndex=theme?0:-1;$('mapCollection').setAttribute('aria-labelledby',theme?'impactsTab':'geographyTab');state.geoSource='scan';renderLegend();updateMode();updateMapLabel();resetReadout();drawOverlay();say(theme?'Paisajes sonoros de impactos · mapas temáticos':'Mapa geográfico interactivo');}
function renderFrames(){$('timeline').replaceChildren(...frames.map(f=>{const b=el('button',undefined,'frame-button');b.dataset.id=f.id;b.setAttribute('aria-label','Seleccionar mapa de '+f.label);b.setAttribute('aria-pressed','false');const im=el('img',undefined,'frame-thumb');im.src=recordThumbnails[f.id];im.alt='';im.width=500;im.height=500;const row=el('span',undefined,'frame-label-row');row.append(el('strong',f.label),el('span','Explorar','frame-state'));b.append(im,row);b.addEventListener('click',()=>selectFrame(f.id));return b;}));}
function renderImpacts(){const focusId=$('impactGrid').contains(document.activeElement)?document.activeElement.dataset.id:null;$('impactGrid').replaceChildren(...content.impacts.map(i=>{const b=el('button',undefined,'impact-button');b.dataset.id=i.id;b.setAttribute('aria-label','Seleccionar tema '+i.label);b.setAttribute('aria-pressed',String(i.id===state.impact));b.classList.toggle('selected',i.id===state.impact);const t=el('span');t.append(el('strong',i.short),el('small',i.instrument));b.append(el('span',i.icon,'impact-icon'),t);b.addEventListener('click',()=>{stop(true);state.impact=i.id;state.selection=null;renderImpacts();resetReadout();updateMapLabel();drawOverlay();say('Tema '+i.label+' seleccionado');});return b;}));$('impactDescription').textContent=impact().description;if($('impactWhy'))$('impactWhy').textContent=window.PulsoGuideContent?.impacts[state.impact]?.es||impact().description;$('impactPreview').src=window.AtlasSoundBank.previews[state.impact].url;$('previewTitle').textContent='Preescucha · '+impact().short;if(focusId)$('impactGrid').querySelector('[data-id="'+focusId+'"]')?.focus({preventScroll:true});}
function renderLegend(){$('legend').replaceChildren(...[-2,-.75,0,.75,2].map(value=>{const d=policy.describe(value),m=window.VivaldiPlayer.describe(value),entry=window.NASA_DATA.palette.reduce((a,b)=>Math.abs(a.value-value)<Math.abs(b.value-value)?a:b),b=el('button');b.title=format(value)+' °C aproximados · '+(state.collection==='geography'?'Vivaldi · '+m.semitones+' semitonos · '+Math.round(window.VivaldiScore.tempos[0].bpm*m.rate)+' BPM musicales':note(d.midi)+' · '+(d.mode==='minor'?'menor':'mayor')+' · '+d.bpm+' BPM de latido');b.setAttribute('aria-label','Escuchar anomalía '+format(value)+' grados');const sw=el('span',undefined,'legend-swatch');sw.style.background='rgb('+entry.rgb.join(',')+')';b.append(sw,el('span',format(value)+' °C'));b.addEventListener('click',async()=>{const s={value,x:.5,y:.5,row:0,col:0,region:{id:'neutral',label:'Ejemplo de la leyenda'}};if(state.collection==='geography'){state.region='auto';$('regionSelect').value='auto';await listenSelection(s);return;}stop(true);const token=state.token;readSelection(s);try{await engine.unlock();if(token!==state.token)return;engine.playZone(zone(s,Math.min(.9,60/d.bpm*.88)));if($('heartbeat').checked)pulse();say('Leyenda · '+format(value)+' °C aproximados');}catch(e){fail(e.message);}});return b;}));}
function renderRegions(){geo.regions.forEach(r=>{const o=el('option',r.label);o.value=r.id;$('regionSelect').append(o);});}
async function chooseRegion(id){state.region=id;const token=state.token,selected=state.selected;if(id==='auto'){stop(false);state.geoPlan=null;state.geoSource='scan';state.selection=null;resetReadout();drawOverlay();return;}const r=geo.regions.find(r=>r.id===id);if(!r)return;await getRaw(selected);if(token!==state.token||state.region!==id)return;const s=regionSelection(selected,r);if(state.mode==='compare'){stop(false);state.geoPlan=null;state.geoSource='compare';readSelection(s);vivaldi.setTemperature(geographicValue(s.value));say('Región elegida · pulsa Vivaldi entre fechas');}else{state.geoSource='point';state.geoPlan=null;state.geoStep=-1;state.scan=-1;readSelection(s);if(state.playing)vivaldi.setTemperature(geographicValue(s.value),{smooth:true});say('Región elegida · pulsa Escuchar Vivaldi para escuchar');}}
function showInfo(regionsOnly=false){
 stop(false);const box=$('dialogContent');box.replaceChildren();$('dialogTitle').textContent=regionsOnly?'Dieciséis regiones para explorar':'Cómo escuchar estos mapas';
 if(regionsOnly){p(box,'Estas regiones permiten elegir un punto representativo del mapa. Todas reproducen el mismo MIDI de Vivaldi: la anomalía modifica la transposición y el tempo. Las fronteras actuales sólo facilitan explorar las imágenes históricas; no indican dónde se compuso ni a qué cultura pertenece la música.');geo.regions.forEach(r=>{const item=el('section',undefined,'region-reference');item.append(el('h3',r.label));p(item,'Punto de referencia: '+r.center.lat+'° de latitud, '+r.center.lon+'° de longitud.');const b=el('button','Explorar esta región');b.setAttribute('aria-label','Explorar '+r.label);b.addEventListener('click',async()=>{$('infoDialog').close();$('regionSelect').value=r.id;$('regionSelect').focus();await chooseRegion(r.id);});item.append(b);box.append(item);});}
 else{
  p(box,'Las seis imágenes de NASA SVS 5207 corresponden a 1890, 1920, 1950, 1980, 2000 y 2023. Muestran anomalías locales respecto a 1951–1980, suavizadas con una ventana móvil de 24 meses. Se verificaron el rótulo y el archivo time.txt de cada fotograma.');
  box.append(el('h3','Vivaldi en el mapa geográfico'));p(box,'Se reproduce el MIDI The-Four-Seasons.mid compartido por el equipo: '+window.VivaldiScore.notes.length+' notas y '+time(window.VivaldiScore.durationSeconds)+' de tiempo original. El archivo no tiene marcadores que permitan asegurar que contiene los cuatro conciertos completos. Las notas y la armonía del arreglo se conservan: no se fuerzan a mayor o menor. La transposición es −6 × ΔT semitonos y el factor de tempo es 2^(ΔT/2), con la anomalía limitada al rango visual de −2 a +2 °C. A −2 °C sube una octava y va a la mitad de velocidad; a cero conserva la altura y el tempo original (100 BPM); a +2 °C baja una octava y va al doble. Son decisiones expresivas del proyecto.');p(box,'La interpretación usa muestras de violín, cuerdas, arpa, flauta y clarinete. Los programas de ocarina, oboe y pizzicato del MIDI se aproximan con flauta, clarinete y arpa del banco disponible. Se conserva cada nota y su duración relativa; no es una grabación de una orquesta interpretando la obra.');p(box,'Según el mapa transforma la música con la anomalía de la zona. Escuchar original conserva la misma posición del MIDI, su altura y su tempo de 100 BPM, sin latido. El original equivale sólo al ajuste musical de referencia ΔT = 0: la lectura del píxel sigue visible y no se sustituye por cero. Puedes alternar sin reiniciar la obra. Volver al mapa usa el último dato del cursor o del recorrido y una transición de 200 ms; si no hay datos, vuelve el silencio. Elegir Según el mapa durante una pausa no inicia música; Escuchar original sí inicia o reanuda. El WAV guarda 30 segundos del modo elegido, con el original sin latido.');box.append(el('h3','Modalidad en los paisajes de impactos'));p(box,'En impactos, el frío se expresa con una nota guía más aguda y el calor con una más grave. La dirección se inspira en los experimentos revisados por Spence; el rango y las notas son decisiones musicales. Se usa un motivo mayor para −1,5 < ΔT < +1,5 °C y uno menor para ΔT ≤ −1,5 o ΔT ≥ +1,5 °C. Los motivos afinados adaptan sus notas al modo mayor o menor; las llamadas de animales y la percusión conservan su altura natural. En los paisajes de impactos, el contraste se inspira en las tonalidades principales de Las cuatro estaciones; sus motivos originales no reproducen las partituras. El registro puede variar con el timbre de cada instrumento.');
  box.append(el('h3','Un latido expresivo'));const table=el('table',undefined,'method-table');const heading=el('tr');['Magnitud de la anomalía','Pulso musical'].forEach(t=>heading.append(el('th',t)));table.append(heading);[['|ΔT| ≤ 0,5 °C','60 BPM · estable'],['0,5 < |ΔT| < 1 °C','90 BPM · activo'],['1 ≤ |ΔT| ≤ 1,5 °C','125 BPM · acelerado'],['|ΔT| > 1,5 °C','130 BPM nominales · intervalos irregulares']].forEach(row=>{const tr=el('tr');row.forEach(t=>tr.append(el('td',t)));table.append(tr);});box.append(table);
  p(box,'Un lub-dub completo cuenta como un latido. Los umbrales y los BPM son una metáfora del proyecto. La AHA describe 60–100 BPM como un rango frecuente en adultos en reposo y más de 100 como taquicardia, pero no establece equivalencias con anomalías climáticas. 90 BPM no diagnostica estrés, 125 no identifica por sí solo un ritmo sinusal y la irregularidad de la app no es una arritmia clínica.');
  box.append(el('h3','Recorridos y mapas temáticos'));p(box,'El mapa geográfico admite clic, arrastre, flechas y Enter. Tras iniciar la música, mover el cursor de mouse o lápiz sobre el mapa la transforma sin mantener presionado el clic. En pantalla táctil se conserva tocar y arrastrar. Los cambios de altura y tempo se interpolan durante unos 200 ms sin reiniciar la pieza; la temperatura mostrada es siempre la lectura del píxel y los indicadores musicales reflejan el valor en transición. Antes de iniciar o durante una pausa, mover el cursor sólo previsualiza datos y no activa el audio. Al salir del mapa se conserva el último ajuste válido; las áreas sin datos silencian y congelan la posición hasta volver a una zona válida. El barrido toma la anomalía más alejada de la referencia entre cuatro puntos de cada columna; una sola interpretación de Vivaldi atraviesa el recorrido. La comparación recorre los centros representativos en las seis fechas sin reiniciar la música. Pausar conserva la posición y Reiniciar vuelve al comienzo. El progreso indica segundos originales del MIDI; el tiempo real depende del tempo térmico. El WAV geográfico exporta explícitamente una muestra de los primeros 30 segundos del recorrido. La sección de impactos no responde al puntero: avanza por todos los recuadros, fila a fila, de izquierda a derecha. Los recuadros sin datos permanecen en silencio.');
  p(box,'Los ocho paisajes son interpretaciones expresivas de temperatura, no mapas de impactos medidos. Usan grabaciones de instrumentos, voces humanas y animales. Cerca de la referencia predomina la consonancia; desde |ΔT| = 0,5 °C la tensión aumenta gradualmente hasta |ΔT| = 2 °C mediante fricciones, articulación y textura. Esta tensión es una interpretación expresiva y no una medición de daños. Biodiversidad alterna varios tipos de animales en anomalías moderadas y sólo cárabo en los extremos. No es un conteo de especies. Sus llamadas y la percusión industrial conservan su altura natural: el modo mayor o menor se aplica a los instrumentos musicales afinados.');
  p(box,'En los paisajes de impactos, las referencias a Vivaldi, Wagner, Debussy, Crumb, Pärt y Chaikovski orientan la instrumentación y el carácter. Sus motivos son originales y no interpretan sus partituras. Bosques usa violín auténtico con sordina, interpretado por Rena Ishii y publicado por Ivica Bukvic. Personas usa un grupo vocal real no profesional. Deshielo incorpora de Sun gotas grabadas, hielo crujiendo y campana suave como interpretación artística de fragilidad, sin medir fusión de hielo. En el mapa geográfico, esas antiguas referencias regionales se sustituyeron por la pieza MIDI compartida, con la misma instrumentación en cualquier región.');
  const audioCredits=el('p');audioCredits.append(link('Descargar el MIDI compartido','assets/music/The-Four-Seasons.mid'),' · ',link('Escuchar las muestras y consultar sus fuentes','sonidos.html'),' · ',link('Créditos y licencias de audio','assets/audio/CREDITOS.txt'));box.append(audioCredits);
  box.append(el('h3','Referencias climáticas y límites'));p(box,'Los escenarios de 1,5 y 2 °C de NASA, IPCC y WRI se refieren a calentamiento global respecto a niveles preindustriales. Los píxeles de esta app son anomalías locales respecto a 1951–1980. El umbral musical ±1,5 °C no equivale al límite del Acuerdo de París.');
  p(box,'La paleta se invierte píxel a píxel antes de agruparla. El valor aproximado de cada recuadro es la mediana de sus píxeles válidos; la exploración puntual toma una pequeña vecindad del cursor. La escala puede saturarse cerca de ±2 °C. Las proporciones corresponden a píxeles Robinson sin ponderación de área: no son una media global científica.');
  const science=el('details',undefined,'source-group');science.append(el('summary','Estudios de percepción y justificación musical'));policy.bibliography.forEach(s=>{const item=el('div',undefined,'source-entry');item.append(link(s.title,s.url));p(item,s.evidence);p(item,s.limitation);science.append(item);});box.append(science);
  const climate=el('details',undefined,'source-group');climate.append(el('summary','Datos y referencias de impactos'));content.climateSources.forEach(s=>{const row=el('p');row.append(link(s.title,s.url));climate.append(row);});content.impacts.forEach(i=>{const row=el('p');row.append(link(i.reference,i.source));climate.append(row);});box.append(climate);
  const map=el('p');map.append(link('Natural Earth · geografía y licencia de dominio público','https://www.naturalearthdata.com/about/terms-of-use/'));box.append(map);p(box,'Imágenes: NASA Scientific Visualization Studio. Datos: NASA GISS. Geografía: Natural Earth. Diseño musical e interpretación: PulsoTerra.');
 }
 $('infoDialog').showModal();
}
function pointerSelection(event){const r=$('mapStage').getBoundingClientRect();return selectionAt(state.selected,Math.max(0,Math.min(.999,(event.clientX-r.left)/r.width)),Math.max(0,Math.min(.999,(event.clientY-r.top)/r.height)));}
function insideMap(event){const r=$('mapStage').getBoundingClientRect();return r.width>0&&r.height>0&&event.clientX>=r.left&&event.clientX<r.right&&event.clientY>=r.top&&event.clientY<r.bottom;}
function clearMapMotion(){if(pointerFrame)cancelAnimationFrame(pointerFrame);pointerFrame=0;pendingPointer=null;}
function mapGesture(s,smooth=true){
 state.region='auto';$('regionSelect').value='auto';
 if(state.mode==='compare'){state.mode='explore';updateMode();}
 listenSelection(s,{smooth});
}
function queueMapMotion(event){
 if(!insideMap(event)){clearMapMotion();return;}
 pendingPointer={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType,token:state.token,frameId:state.selected,live:dragging||(state.playing&&event.pointerType!=='touch')};
 if(pointerFrame)return;
 pointerFrame=requestAnimationFrame(()=>{
  pointerFrame=0;const pending=pendingPointer;pendingPointer=null;
  if(!pending||pending.token!==state.token||pending.frameId!==state.selected||!state.ready||state.preparing||state.collection!=='geography'||!insideMap(pending))return;
  const s=pointerSelection(pending);
  if(pending.live&&(state.playing||dragging))mapGesture(s,true);else readSelection(s);
 });
}
$('vivaldiMap').addEventListener('click',()=>setGeographicAudio('map'));
$('vivaldiOriginal').addEventListener('click',()=>setGeographicAudio('original'));
$('playButton').addEventListener('click',play);
$('resetButton').addEventListener('click',()=>{stop(true);state.selection=null;resetReadout();drawOverlay();say('Recorrido reiniciado');});
$('geographyTab').addEventListener('click',()=>setCollection('geography'));$('impactsTab').addEventListener('click',()=>setCollection('impacts'));
[$('geographyTab'),$('impactsTab')].forEach((b,i)=>b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;setCollection(next?'impacts':'geography');(next?$('impactsTab'):$('geographyTab')).focus();}}));
$('exploreMode').addEventListener('click',()=>setMode('explore'));$('compareMode').addEventListener('click',()=>setMode('compare'));
$('regionSelect').addEventListener('change',()=>chooseRegion($('regionSelect').value));
$('detail').addEventListener('change',()=>{stop(true);state.detail=Number($('detail').value);state.selection=null;drawOverlay();say('Detalle actualizado');});
$('volume').addEventListener('input',()=>{$('volumeOutput').textContent=$('volume').value+' %';engine.setVolume(Number($('volume').value)/100);});
$('heartbeatVolume').addEventListener('input',()=>{$('heartbeatVolumeOutput').textContent=$('heartbeatVolume').value+' %';engine.setHeartbeatVolume(Number($('heartbeatVolume').value)/100);});
for(const id of ['impactPreview','heartPreview'])$(id).addEventListener('play',()=>{stop(true,$(id));say(id==='heartPreview'?'Preescucha del latido humano · 60 BPM':'Preescucha musical · '+impact().short);});
$('heartPreview').src=window.AtlasSoundBank.previews.heartbeat.url;
$('heartbeat').addEventListener('change',()=>{if(state.collection==='impacts')stop(true);syncGeographicHeartbeat();say(geographicOriginal()?'Preferencia de latido guardada · el original se escucha sin latido':$('heartbeat').checked?'Latido activado':'Latido silenciado');});
$('mapStage').addEventListener('pointerdown',event=>{if(!state.ready||state.preparing||state.collection!=='geography'||event.button>0||!insideMap(event))return;clearMapMotion();dragging=true;$('mapStage').setPointerCapture(event.pointerId);mapGesture(pointerSelection(event),true);});
$('mapStage').addEventListener('pointermove',event=>{if(!state.ready||state.preparing||state.collection!=='geography')return;queueMapMotion(event);});
$('mapStage').addEventListener('pointerleave',clearMapMotion);
['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('mapStage').addEventListener(name,event=>{dragging=false;if(name!=='pointerup')clearMapMotion();if($('mapStage').hasPointerCapture(event.pointerId))$('mapStage').releasePointerCapture(event.pointerId);}));
$('mapStage').addEventListener('keydown',event=>{if(!state.ready||state.collection!=='geography'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))return;event.preventDefault();const prev=state.selection||{x:.5,y:.5};let x=prev.x,y=prev.y;if(event.key==='ArrowLeft')x-=1/32;if(event.key==='ArrowRight')x+=1/32;if(event.key==='ArrowUp')y-=1/16;if(event.key==='ArrowDown')y+=1/16;const s=selectionAt(state.selected,Math.max(.001,Math.min(.999,x)),Math.max(.001,Math.min(.999,y)));readSelection(s);if(state.playing||event.key==='Enter'||event.key===' ')listenSelection(s);});
$('exportButton').addEventListener('click',async()=>{if(state.collection==='geography')return exportGeographic();if(!state.ready||state.preparing)return;stop(true);const token=state.token,collection=state.collection,theme=state.impact;state.preparing=true;updateButtons();try{const plan=await buildPlan();if(!plan||token!==state.token)return;state.duration=plan.duration;progress(0);say('Generando WAV con timbres y latidos');if(plan.duration+.3>180)throw new Error('Elige un recorrido más breve para exportar menos de tres minutos.');const blob=await engine.exportWav(plan.events,{duration:plan.duration+.3});if(token!==state.token)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='PulsoTerra-'+(collection==='impacts'?theme:'geografico')+'-'+state.selected+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);say('WAV descargado con la escala y los timbres actuales');}catch(e){fail('No se pudo exportar: '+e.message);}finally{if(token===state.token){state.preparing=false;updateButtons();}}});
$('aboutButton').addEventListener('click',()=>showInfo());$('sourcesButton').addEventListener('click',()=>showInfo());$('regionLegendButton').addEventListener('click',()=>showInfo(true));$('closeDialog').addEventListener('click',()=>$('infoDialog').close());$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog'))$('infoDialog').close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state.playing||state.preparing)){stop(false);say('En pausa al salir de la ventana');}});window.addEventListener('pagehide',()=>stop());
const accessibleObservers=new Set();
const accessiblePlaces=[...geo.regions.map(r=>({id:r.id,label:r.label,lat:r.center.lat,lon:r.center.lon})),
 {id:'arctic',label:'Océano Ártico',lat:82,lon:0},{id:'antarctica',label:'Antártida',lat:-80,lon:0},
 {id:'north-atlantic',label:'Atlántico norte',lat:30,lon:-35},{id:'south-atlantic',label:'Atlántico sur',lat:-30,lon:-15},
 {id:'north-pacific',label:'Pacífico norte',lat:30,lon:-150},{id:'south-pacific',label:'Pacífico sur',lat:-30,lon:-120},
 {id:'indian-ocean',label:'Océano Índico',lat:-20,lon:80},{id:'southern-ocean',label:'Océano Austral',lat:-60,lon:50}];
function accessibleGridSize(){return state.collection==='impacts'?{columns:state.detail,rows:state.detail/2}:{columns:32,rows:16};}
function accessibleSnapshot(){const m=currentModel(),s=state.selection;return {collection:state.collection,selected:state.selected,impact:{id:impact().id,label:impact().label},ready:state.ready,preparing:state.preparing,playing:state.playing,original:geographicOriginal(),detail:state.detail,status:lastStatusSource,selection:s?Object.assign({},s,{coordinates:geo.inverseRobinson(s.x,s.y)}):null,music:window.VivaldiPlayer.describe(geographicOriginal()?0:s?.value),pulse:policy.describe(s?.value),histogram:m?m.histogram.slice():[0,0,0,0,0],validCount:m?.validCount||0};}
function notifyAccessible(){const snapshot=accessibleSnapshot();for(const observer of accessibleObservers)observer(snapshot);}
async function inspectAccessible(point){
 if(!state.ready||state.preparing)return accessibleSnapshot();
 const token=state.token,selected=state.selected,size=accessibleGridSize();let s;
 if(point.placeId){const place=accessiblePlaces.find(p=>p.id===point.placeId);if(!place)return accessibleSnapshot();const pos=geo.forwardRobinson(place.lat,place.lon);s=selectionAt(selected,pos.x,pos.y,{id:place.id,label:place.label});if(state.collection==='impacts'){const m=await getModel(selected,size.columns,size.rows);if(token!==state.token||selected!==state.selected)return accessibleSnapshot();const col=Math.min(size.columns-1,Math.floor(pos.x*size.columns)),row=Math.min(size.rows-1,Math.floor(pos.y*size.rows));s=Object.assign(s,{row,col,gridColumns:size.columns,value:m.cells[row*size.columns+col].value});}}
 else{const row=Math.max(0,Math.min(size.rows-1,Math.trunc(point.row)||0)),col=Math.max(0,Math.min(size.columns-1,Math.trunc(point.col)||0)),x=(col+.5)/size.columns,y=(row+.5)/size.rows;s=selectionAt(selected,x,y);if(state.collection==='impacts'){const m=await getModel(selected,size.columns,size.rows);if(token!==state.token||selected!==state.selected)return accessibleSnapshot();s=Object.assign(s,{row,col,gridColumns:size.columns,value:m.cells[row*size.columns+col].value});}}
 if(state.collection==='impacts'&&state.playing)stop(false);
 state.region='auto';$('regionSelect').value='auto';state.geoSource='point';state.geoPlan=null;state.geoStep=-1;state.scan=-1;
 if(state.mode!=='explore'){state.mode='explore';updateMode();}
 readSelection(s);if(state.collection==='geography'&&state.playing)await listenSelection(s,{smooth:true});return accessibleSnapshot();
}
async function listenAccessible(){
 const s=state.selection;if(!s||!state.ready||state.preparing)return;
 if(state.collection==='geography'){state.mode='explore';updateMode();return listenSelection(s,{smooth:true});}
 stop(true);const options=zone(s,4,true);readSelection(s);if(!options){say('Sin datos · esta zona permanece en silencio');return;}
 const token=state.token;state.preparing=true;updateButtons();
 try{await engine.unlock();if(token!==state.token)return;state.preparing=false;state.playing=true;state.duration=4;state.start=performance.now();progress(0);updateButtons();engine.playZone(options);if(options.heartbeat)pulse();say('Escuchando la zona elegida');const tick=now=>{if(!state.playing||token!==state.token)return;progress((now-state.start)/4000);animation=requestAnimationFrame(tick);};animation=requestAnimationFrame(tick);timer=setTimeout(()=>{stop(false);progress(1);say('Escucha de la zona terminada');},4000);}
 catch(e){stop(false);fail('No se pudo escuchar la zona: '+e.message);}
 finally{if(token===state.token){state.preparing=false;updateButtons();}}
}
// Preserve the existing map and audio paths; expose their state to native controls.
for(const name of ['selection','frame','readout','buttons']){
 if(name==='selection'){const original=readSelection;readSelection=function(s){original(s);notifyAccessible();};}
 if(name==='frame'){const original=showFrame;showFrame=function(id){original(id);notifyAccessible();};}
 if(name==='readout'){const original=resetReadout;resetReadout=function(){original();notifyAccessible();};}
 if(name==='buttons'){const original=updateButtons;updateButtons=function(){original();notifyAccessible();};}
}
function selectAccessibleSoundscape(id){
 if(id==='geography'){setCollection('geography');return;}
 const selected=content.impacts.find(i=>i.id===id);if(!selected)return;
 setCollection('impacts');
 if(state.impact!==id){stop(true);state.impact=id;state.selection=null;renderImpacts();resetReadout();updateMapLabel();drawOverlay();say('Tema '+selected.label+' seleccionado');}
}
window.PulsoExplorer={soundscapes:[{id:'geography',label:'Mapa geográfico · Vivaldi'},...content.impacts.map(i=>({id:i.id,label:i.label}))],selectSoundscape:selectAccessibleSoundscape,frames:frames.map(f=>({id:f.id,label:f.label})),places:accessiblePlaces,snapshot:accessibleSnapshot,gridSize:accessibleGridSize,inspect:inspectAccessible,listen:listenAccessible,subscribe(fn){accessibleObservers.add(fn);return()=>accessibleObservers.delete(fn);},selectYear:selectFrame,pause(){stop(false);say('Todo el audio en pausa');},tour(){stop(true);state.selection=null;state.geoSource='scan';state.mode='explore';updateMode();return play();}};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('infoDialog').open){window.PulsoExplorer.pause();}});
$('geographyTab').tabIndex=0;$('impactsTab').tabIndex=-1;
renderFrames();renderImpacts();renderLegend();renderRegions();updateMode();selectFrame('2023');
})();
