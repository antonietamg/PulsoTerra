const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const content=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/audio-guide-scripts.json'),'utf8'));
function setup(){
 class Element{
  constructor(){this.attrs={};this.listeners={};this.children=[];this.textContent='';this.hidden=false;}
  addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
  emit(event,payload={}){for(const fn of this.listeners[event]||[])fn(payload);}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
  append(p){this.children.push(p);}
 }
 const ids=['welcomeInstructionAudio','welcomeAudioPause','welcomeAudioStop','welcomeAudioStatus','welcomeAudioEnglish','welcomeAudioSpanish','welcomeTranscriptEnglish','welcomeTranscriptSpanish','welcomeStart','welcomeScreen'];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()])),audio=elements.welcomeInstructionAudio,observers=[],windowEvents={},docEvents={};
 let deferred=null,rejectNext=false;
 Object.assign(audio,{src:'',currentTime:0,paused:true,playCalls:0,pauseCalls:0,play(){this.playCalls++;this.paused=false;this.emit('play');if(rejectNext){rejectNext=false;return Promise.reject(new Error('blocked'));}return deferred?deferred.promise:Promise.resolve();},pause(){this.paused=true;this.pauseCalls++;}});
 const document={documentElement:{lang:'en'},getElementById:id=>elements[id],createElement:()=>new Element(),addEventListener:(event,fn)=>{(docEvents[event]??=[]).push(fn);}};
 const window={PulsoWelcomeAudioContent:Object.fromEntries(['en','es'].map(l=>[l,{...content[l],src:'assets/instructions/nvda-'+l+'.mp3'}])),addEventListener:(event,fn)=>{windowEvents[event]=fn;}};
 const context={window,document,MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/welcome-audio.js'),'utf8'),context);
 const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 return {elements,audio,document,window,observers,settle,click:id=>elements[id].emit('click'),defer(){let resolve;const promise=new Promise(r=>{resolve=r;});deferred={promise,resolve};return deferred;},reject(){rejectNext=true;}};
}
test('welcome stays silent and both full transcripts are available',()=>{const f=setup();assert.equal(f.audio.playCalls,0);assert.equal(f.audio.src,'');for(const l of ['English','Spanish'])assert.equal(f.elements['welcomeTranscript'+l].children.length,8);assert.equal(f.elements.welcomeAudioPause.getAttribute('aria-disabled'),'true');});
test('language buttons use one player and restart the selected recording',async()=>{const f=setup();f.click('welcomeAudioEnglish');await f.settle();assert.match(f.audio.src,/nvda-en/);f.audio.currentTime=20;f.click('welcomeAudioSpanish');await f.settle();assert.match(f.audio.src,/nvda-es/);assert.equal(f.audio.currentTime,0);assert.equal(f.elements.welcomeAudioEnglish.getAttribute('aria-pressed'),'false');assert.equal(f.elements.welcomeAudioSpanish.getAttribute('aria-pressed'),'true');assert.equal(f.audio.lang,'es-MX');});
test('pause and resume retain position and remain keyboard-focusable',async()=>{const f=setup();f.click('welcomeAudioEnglish');await f.settle();f.audio.currentTime=23;f.click('welcomeAudioPause');assert.equal(f.audio.paused,true);assert.equal(f.audio.currentTime,23);assert.equal(f.elements.welcomeAudioPause.textContent,'Resume guide');assert.notEqual(f.elements.welcomeAudioPause.disabled,true);f.click('welcomeAudioPause');await f.settle();assert.equal(f.audio.paused,false);assert.equal(f.audio.currentTime,23);assert.equal(f.elements.welcomeAudioPause.textContent,'Pause guide');});
test('stop cancels pending playback without a stale completion message',async()=>{const f=setup(),pending=f.defer();f.click('welcomeAudioEnglish');f.audio.currentTime=8;f.click('welcomeAudioStop');pending.resolve();await f.settle();assert.equal(f.audio.paused,true);assert.equal(f.audio.currentTime,0);assert.equal(f.elements.welcomeAudioStatus.textContent,'Guide stopped.');assert.equal(f.elements.welcomeAudioEnglish.getAttribute('aria-pressed'),'false');});
test('entering the app stops and resets the guide',async()=>{const f=setup();f.click('welcomeAudioSpanish');await f.settle();f.audio.currentTime=42;f.click('welcomeStart');assert.equal(f.audio.paused,true);assert.equal(f.audio.currentTime,0);assert.equal(f.elements.welcomeAudioPause.getAttribute('aria-disabled'),'true');});
test('changing interface language changes labels without playing or repeating narration',async()=>{const f=setup();f.click('welcomeAudioEnglish');await f.settle();f.click('welcomeAudioPause');const calls=f.audio.playCalls,status=f.elements.welcomeAudioStatus.textContent;f.document.documentElement.lang='es';f.observers[0]();assert.equal(f.audio.playCalls,calls);assert.equal(f.elements.welcomeAudioStatus.textContent,status);assert.equal(f.elements.welcomeAudioPause.textContent,'Continuar guía');});
test('playback failure provides text and download alternatives',async()=>{const f=setup();f.reject();f.click('welcomeAudioEnglish');await f.settle();assert.match(f.elements.welcomeAudioStatus.textContent,/transcript or download/);assert.equal(f.elements.welcomeAudioPause.getAttribute('aria-disabled'),'true');});
test('an old playback promise cannot overwrite a newer language selection',async()=>{const f=setup(),pending=f.defer();f.click('welcomeAudioEnglish');f.click('welcomeAudioSpanish');pending.resolve();await f.settle();assert.match(f.audio.src,/nvda-es/);assert.equal(f.audio.paused,false);assert.equal(f.elements.welcomeAudioStatus.textContent,'Guide in Spanish.');});
