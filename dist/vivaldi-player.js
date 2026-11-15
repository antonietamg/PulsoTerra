/* MIDI score playback through the app's licensed recorded sample bank. */
(function (root, factory) {
  'use strict';
  const Player = factory(root);
  root.VivaldiPlayer = Player;
  if (typeof module === 'object' && module.exports) module.exports = Player;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const MAX_VOICES = 48, LOOKAHEAD = .24, TICK_MS = 50, GLIDE_MS = 200, GLIDE_TICK_MS = 25;
  const RATE_K = Math.LN2/2;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const ALIASES = Object.freeze({pizzicato_strings:'harp',ocarina:'flute',oboe:'clarinet'});
  const PROGRAMS = Object.freeze({40:'violin',41:'strings',42:'cello',43:'cello',44:'strings',45:'harp',46:'harp',48:'strings',49:'strings',68:'clarinet',71:'clarinet',73:'flute',79:'flute'});
  const SUSTAIN = new Set(['violin','strings','mutedstrings','cello','flute','clarinet','horn','trombone','choir']);
  const BOWED = new Set(['violin','strings','mutedstrings','cello']);
  const timer = (fn,ms) => typeof root.setTimeout==='function' ? root.setTimeout(fn,ms) : setTimeout(fn,ms);
  const clearTimer = id => { if(id!==null) {if(typeof root.clearTimeout==='function')root.clearTimeout(id);else clearTimeout(id);} };

  function describe(value) {
    if(value===null||value===undefined||!Number.isFinite(Number(value)))return {value:null,semitones:0,rate:0,bpmFactor:0,label:'Sin dato · silencio y posición detenida'};
    value=clamp(Number(value),-2,2);
    const rate=Math.pow(2,value/2);
    return {value,semitones:value===0?0:-6*value,rate,bpmFactor:rate,label:value===0?'Altura y tempo originales':value<0?'Más agudo y más lento':'Más grave y más rápido'};
  }

  function lowerBound(notes,time) {
    let low=0,high=notes.length;
    while(low<high){const mid=(low+high)>>>1;if(notes[mid].time<time)low=mid+1;else high=mid;}
    return low;
  }

  function encodeWav(buffer) {
    const channels=buffer.numberOfChannels,length=buffer.length;
    const data=new ArrayBuffer(44+length*channels*2),view=new DataView(data);
    const text=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,data.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);
    view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,data.byteLength-44,true);
    const samples=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let at=44;
    for(let i=0;i<length;i++)for(let c=0;c<channels;c++){const n=clamp(samples[c][i],-1,1);view.setInt16(at,n<0?n*32768:n*32767,true);at+=2;}
    return new Blob([data],{type:'audio/wav'});
  }

  class VivaldiPlayer {
    constructor(engine,score=root.VivaldiScore) {
      if(!engine||typeof engine.unlock!=='function')throw new TypeError('Vivaldi necesita el motor de audio de la app.');
      if(!score||!Array.isArray(score.notes)||!score.notes.length)throw new TypeError('No se cargó la partitura MIDI de Vivaldi.');
      this.engine=engine;this.score=score;
      this.notes=score.notes.map((note,index)=>{
        if(!note||!Number.isFinite(note.time)||note.time<0||!Number.isFinite(note.duration)||note.duration<=0||!Number.isInteger(note.midi)||note.midi<0||note.midi>127)throw new TypeError('La partitura contiene una nota MIDI inválida.');
        const instrument=ALIASES[note.instrument]||note.instrument||PROGRAMS[note.program];
        if(!instrument)throw new TypeError('No hay instrumento grabado asignado al programa MIDI '+note.program+'.');
        return Object.assign({},note,{index,instrument,velocity:clamp(Number.isFinite(note.velocity)?note.velocity:.7,0,1),end:note.time+note.duration});
      }).sort((a,b)=>a.time-b.time||a.index-b.index);
      const finalNote=Math.max(...this.notes.map(note=>note.end));
      this._duration=Number.isFinite(score.durationSeconds)&&score.durationSeconds>=finalNote?score.durationSeconds:finalNote;
      this._expressions=new Map();
      for(const event of score.controllers||[])if((event.controller===11||event.controller===121)&&Number.isFinite(event.time)) {
        if(!this._expressions.has(event.channel))this._expressions.set(event.channel,[]);
        this._expressions.get(event.channel).push({time:event.time,value:event.controller===121?1:clamp(Number(event.value)/127,0,1)});
      }
      this._expressions.forEach(events=>events.sort((a,b)=>a.time-b.time));
      this.params=describe(0);this._base=0;this._anchor=0;this._playing=false;this._intent=false;this._ready=false;
      this._timer=null;this._token=0;this._startToken=0;this._cursor=0;this._voices=new Set();this._seen=new Set();this._loops=new Map();
      this._glide=null;this._glideTimer=null;this._glideEpoch=0;
      this._onProgress=null;this._onEnd=null;
    }
    static describe(value) {return describe(value);}
    static get instrumentSubstitutions() {return ALIASES;}
    get params() {return this._glide&&this.engine.context?describe(this._valueAt(this.engine.context.currentTime)):this._params;}
    set params(value) {this._params=value;}
    get duration() {return this._duration;}
    get playing() {return this._playing;}
    get position() {
      return this._playing?clamp(this._base+this._integral(this._anchor,this.engine.context.currentTime),0,this.duration):this._base;
    }
    _valueAt(time) {
      const glide=this._glide;
      return glide?glide.from+(glide.to-glide.from)*clamp((time-glide.start)/(glide.end-glide.start),0,1):this._params.value;
    }
    _integral(start,end) {
      if(end<=start)return 0;
      const glide=this._glide;
      if(!glide)return (end-start)*this._params.rate;
      let total=0;
      if(start<glide.start){const stop=Math.min(end,glide.start);total+=(stop-start)*Math.exp(RATE_K*glide.from);start=stop;}
      if(start<end&&start<glide.end) {
        const stop=Math.min(end,glide.end),slope=RATE_K*(glide.to-glide.from)/(glide.end-glide.start),rate=Math.exp(RATE_K*this._valueAt(start));
        total+=Math.abs(slope)<1e-10?rate*(stop-start):rate*Math.expm1(slope*(stop-start))/slope;start=stop;
      }
      if(start<end)total+=(end-start)*Math.exp(RATE_K*glide.to);
      return total;
    }
    _wallForScore(position) {
      const distance=position-this._base,glide=this._glide;
      if(!glide||glide.end<=this._anchor)return this._anchor+distance/this.params.rate;
      const rate=Math.exp(RATE_K*this._valueAt(this._anchor));
      if(distance<=0)return this._anchor+distance/rate;
      const available=this._integral(this._anchor,glide.end);
      if(distance>available)return glide.end+(distance-available)/Math.exp(RATE_K*glide.to);
      const slope=RATE_K*(glide.to-glide.from)/(glide.end-glide.start);
      return this._anchor+(Math.abs(slope)<1e-10?distance/rate:Math.log1p(distance*slope/rate)/slope);
    }
    _cancelGlide() {
      const now=this.engine.context?this.engine.context.currentTime:0;
      const position=this.position,current=this.params;
      clearTimer(this._glideTimer);this._glideTimer=null;this._glideEpoch++;
      this._glide=null;this._params=current;this._base=position;this._anchor=now;
    }
    _ensureGlideTick() {
      if(!this._glide||!this._playing||this._glideTimer!==null)return;
      const epoch=this._glideEpoch;
      const id=timer(()=>{
        if(epoch!==this._glideEpoch||this._glideTimer!==id)return;
        this._glideTimer=null;
        if(!this._glide||!this._playing)return;
        const now=this.engine.context.currentTime,position=this.position,next=this.params;
        const finished=now>=this._glide.end-.0000001;
        this._base=position;this._anchor=now;this._params=next;
        if(finished)this._glide=null;
        this._retimePlaying(position);
        this._ensureGlideTick();
      },GLIDE_TICK_MS);
      this._glideTimer=id;
    }
    async unlock() {
      await this.engine.unlock();
      if(!this.engine.context||!Array.isArray(this.engine.sampleEntries)||!this.engine.sampleBuffers||typeof this.engine._musicBus!=='function')throw new Error('El banco instrumental de Vivaldi no está listo.');
      for(const instrument of new Set(this.notes.map(note=>note.instrument)))this._sample(instrument,60);
      this._ready=true;return true;
    }
    _sample(instrument,midi) {
      const samples=this.engine.sampleEntries.filter(sample=>sample.instrument===instrument&&sample.midi!==null&&Number.isFinite(Number(sample.midi))&&this.engine.sampleBuffers.has(sample.id));
      if(!samples.length)throw new Error('Falta una grabación real de '+instrument+' para reproducir el MIDI.');
      return samples.reduce((best,sample)=>Math.abs(Number(sample.midi)-midi)<Math.abs(Number(best.midi)-midi)?sample:best,samples[0]);
    }
    _material(sample,context) {
      const original=this.engine.sampleBuffers.get(sample.id);
      if(!SUSTAIN.has(sample.instrument)||original.duration<1.8||typeof context.createBuffer!=='function')return {buffer:original,loop:false,offset:0};
      if(this._loops.has(sample.id))return this._loops.get(sample.id);
      // Sustain the recorded middle of a held instrument. The short crossfade
      // joins actual recorded waveforms; no oscillator or extra melody is added.
      const rate=original.sampleRate,base=Math.min(1,original.duration*.25),end=Math.min(3.5,original.duration-.3),fade=Math.min(.04,(end-base)/8);
      const buffer=context.createBuffer(original.numberOfChannels,original.length,rate);
      const first=Math.round(base*rate),last=Math.round(end*rate),count=Math.max(2,Math.round(fade*rate));
      for(let c=0;c<original.numberOfChannels;c++) {
        const input=original.getChannelData(c),output=buffer.getChannelData(c);output.set(input);
        for(let i=0;i<count;i++){const weight=i/(count-1);output[last-count+i]=input[last-count+i]*(1-weight)+input[first+i]*weight;}
      }
      const result={buffer,loop:true,loopStart:base+fade,loopEnd:end,offset:BOWED.has(sample.instrument)?base:0};
      this._loops.set(sample.id,result);return result;
    }
    _expression(note,position) {
      let value=1;
      for(const event of this._expressions.get(note.channel)||[]){if(event.time>position)break;value=event.value;}
      return value;
    }
    _envelope(voice,start,position,end,toWall,attack=.018,hold=false) {
      const gain=voice.gain.gain,release=Math.min(.065,(end-start)*.35);
      const expression=this._expression(voice.note,position);let finalExpression=expression;
      if(hold&&typeof gain.cancelAndHoldAtTime==='function')gain.cancelAndHoldAtTime(start);
      else{gain.cancelScheduledValues(start);gain.setValueAtTime(hold?voice.peak*expression:0,start);}
      attack=Math.min(attack,(end-start)*.2);
      const changes=[];
      for(const event of this._expressions.get(voice.note.channel)||[])if(event.time>position&&event.time<voice.note.end) {
        const time=toWall(event.time);
        if(Number.isFinite(time)&&time>start&&time<end-release)changes.push({time,value:event.value});
      }
      for(const event of changes)if(event.time<=start+attack)finalExpression=event.value;
      if(attack>0)gain.linearRampToValueAtTime(voice.peak*finalExpression,start+attack);
      for(const event of changes)if(event.time>start+attack){gain.setValueAtTime(voice.peak*event.value,event.time);finalExpression=event.value;}
      gain.setValueAtTime(voice.peak*finalExpression,Math.max(start+attack,end-release));
      gain.linearRampToValueAtTime(0,end);
    }
    _newVoice(note,start,end,params,age=0,environment=null) {
      if(note.velocity<=0||end<=start+.003)return null;
      const context=environment?environment.context:this.engine.context,out=environment?environment.out:this.engine._musicBus();
      const sample=this._sample(note.instrument,note.midi+params.semitones),material=this._material(sample,context);
      const pitchRate=Math.pow(2,(note.midi+params.semitones-Number(sample.midi))/12);
      let offset=material.offset+Math.max(0,age)/Math.max(params.rate,.001)*pitchRate;
      if(material.loop&&offset>=material.loopEnd)offset=material.loopStart+(offset-material.loopStart)%(material.loopEnd-material.loopStart);
      if(!material.loop&&offset>=material.buffer.duration-.005)return null;
      if(!environment)while(this._voices.size>=MAX_VOICES)this._cancelVoice(this._voices.values().next().value,context.currentTime,.005);
      const source=context.createBufferSource(),gain=context.createGain(),peak=.42*note.velocity;
      source.buffer=material.buffer;source.loop=material.loop;
      if(material.loop){source.loopStart=material.loopStart;source.loopEnd=material.loopEnd;}
      source.kind='vivaldi-sample';source.sampleId=sample.id;source.sampleInstrument=sample.instrument;source.scoreNote=note.index;source.midi=note.midi;
      source.playbackRate.setValueAtTime(pitchRate,start);source.connect(gain);gain.connect(out);
      const voice={note,sample,source,gain,peak,start,end,pitchRate,disposed:false};
      const position=note.time+age;
      this._envelope(voice,start,position,end,time=>start+(time-position)/params.rate,age>0?.012:.018);
      voice.dispose=()=>{if(voice.disposed)return;voice.disposed=true;try{source.disconnect();gain.disconnect();}catch(_){}this._voices.delete(voice);};
      source.onended=voice.dispose;
      if(!environment)this._voices.add(voice);
      try{source.start(start,offset);source.stop(end+.006);}catch(error){voice.dispose();throw error;}
      return voice;
    }
    _cancelVoice(voice,at=this.engine.context.currentTime,fade=.012) {
      if(!voice||voice.disposed)return;
      if(voice.start>at+.001){try{voice.source.stop(at);}catch(_){}voice.dispose();return;}
      try {
        const gain=voice.gain.gain;
        if(typeof gain.cancelAndHoldAtTime==='function')gain.cancelAndHoldAtTime(at);
        else{gain.cancelScheduledValues(at);gain.setValueAtTime(voice.peak,at);}
        gain.linearRampToValueAtTime(0,at+fade);voice.source.stop(at+fade+.003);
      }catch(_){voice.dispose();}
      this._voices.delete(voice);
    }
    _clearVoices() {for(const voice of Array.from(this._voices))this._cancelVoice(voice);}
    _emit() {
      if(this._onProgress)try{this._onProgress({position:this.position,duration:this.duration,params:Object.assign({},this.params),playing:this.playing});}catch(_){}
    }
    _begin(position) {
      this._base=position;this._anchor=this.engine.context.currentTime;this._playing=true;
      this._cursor=lowerBound(this.notes,position);
      for(let i=0;i<this._cursor;i++)if(this.notes[i].end>position&&!this._seen.has(this.notes[i].index))this._schedule(this.notes[i],position);
      this._pump();
    }
    _schedule(note,position) {
      this._seen.add(note.index);
      const now=this.engine.context.currentTime,due=this._wallForScore(note.time),start=Math.max(now+.008,due);
      const age=Math.max(0,position-note.time),end=this._glide?start+Math.max(0,this._wallForScore(note.end)-Math.max(now,due)):start+(note.end-Math.max(position,note.time))/this.params.rate;
      const params=this._glide?describe(this._valueAt(start)):this.params;
      const voice=this._newVoice(note,start,end,params,age);
      if(voice&&this._glide) {
        this._rampVoicePitch(voice,start,params);
        this._envelope(voice,start,Math.max(position,note.time),end,time=>this._wallForScore(time),age>0?.012:.018);
      }
    }
    _rampVoicePitch(voice,time,params=this.params) {
      const pitchRate=Math.pow(2,(voice.note.midi+params.semitones-Number(voice.sample.midi))/12),param=voice.source.playbackRate;
      if(this._glide&&this._glide.end>time) {
        if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(time);else param.cancelScheduledValues(time);
        param.setValueAtTime(pitchRate,time);
        const target=Math.pow(2,(voice.note.midi-6*this._glide.to-Number(voice.sample.midi))/12);
        param.exponentialRampToValueAtTime(target,this._glide.end);
      } else {
        if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(time);else param.cancelScheduledValues(time);
        param.setTargetAtTime(pitchRate,time,.025);
      }
      voice.pitchRate=pitchRate;
    }
    _retimePlaying(position,emit=true) {
      if(!this._playing)return;
      const now=this.engine.context.currentTime;
      for(const voice of Array.from(this._voices)) {
        if(voice.start>now+.001){this._seen.delete(voice.note.index);this._cancelVoice(voice,now);continue;}
        if(voice.note.end<=position){this._cancelVoice(voice,now);continue;}
        const end=this._wallForScore(voice.note.end);
        this._rampVoicePitch(voice,now);voice.end=end;
        this._envelope(voice,now,position,end,time=>this._wallForScore(time),.012,true);
        try{voice.source.stop(end+.006);}catch(_){voice.dispose();}
      }
      this._cursor=lowerBound(this.notes,position);this._pump(emit);
    }
    _pump(emit=true) {
      clearTimer(this._timer);this._timer=null;
      if(!this._playing)return;
      const position=this.position;
      if(position>=this.duration-.0001) {
        this._cancelGlide();
        this._base=this.duration;this._playing=false;this._intent=false;this._clearVoices();this._emit();
        if(this._onEnd)try{this._onEnd();}catch(_){}
        return;
      }
      const horizon=this._glide?this._base+this._integral(this._anchor,this.engine.context.currentTime+LOOKAHEAD):position+LOOKAHEAD*this.params.rate;
      while(this._cursor<this.notes.length&&this.notes[this._cursor].time<=horizon) {
        const note=this.notes[this._cursor++];
        if(note.end>position&&!this._seen.has(note.index))this._schedule(note,position);
      }
      const token=this._token,id=timer(()=>{if(token!==this._token||this._timer!==id)return;this._timer=null;this._pump();},TICK_MS);
      this._timer=id;
      // UI progress may synchronously change temperature or pause playback.
      // Install this timer first so that re-entrant updates cancel it normally.
      if(emit)this._emit();
    }
    async start(options={}) {
      const position=options.offset===undefined?this.position:Number(options.offset);
      if(!Number.isFinite(position)||position<0||position>this.duration)throw new RangeError('La posición MIDI debe estar dentro de la obra.');
      this.pause();const token=++this._startToken;this._intent=true;this._base=position;
      if(typeof options.onProgress==='function')this._onProgress=options.onProgress;
      if(typeof options.onEnd==='function')this._onEnd=options.onEnd;
      this.params=describe(options.value===undefined?0:options.value);
      try{await this.unlock();}catch(error){if(token===this._startToken)this._intent=false;throw error;}
      if(token!==this._startToken||!this._intent)return false;
      this._seen.clear();
      if(this.params.value!==null)this._begin(position);else this._emit();
      return true;
    }
    setTemperature(value,options={}) {
      const next=describe(value),now=this.engine.context?this.engine.context.currentTime:0;
      if(options.smooth&&next.value!==null&&this._playing&&this.params.value!==null) {
        if(this._glide&&next.value===this._glide.to)return;
        const position=this.position,current=this.params.value;
        if(next.value===current) {
          if(this._glide){this._cancelGlide();this._retimePlaying(position,false);}
          return;
        }
        this._base=position;this._anchor=now;this._params=describe(current);
        this._glide={from:current,to:next.value,start:now,end:now+GLIDE_MS/1000};
        // Retargeting never postpones an already-running 25 ms tick.
        this._retimePlaying(position,false);this._ensureGlideTick();return;
      }
      const hadGlide=Boolean(this._glide);this._cancelGlide();
      if(hadGlide&&next.value!==null&&next.value===this.params.value&&this._playing){this._retimePlaying(this.position);return;}
      this._setTemperatureImmediate(value);
    }
    _setTemperatureImmediate(value) {
      const position=this.position,wasPlaying=this._playing,next=describe(value);
      if(next.value===this.params.value)return;
      this._base=position;this._anchor=this.engine.context?this.engine.context.currentTime:0;this.params=next;
      if(next.value===null) {
        this._playing=false;clearTimer(this._timer);this._timer=null;this._token++;
        if(this.engine.context)this._clearVoices();this._seen.clear();this._emit();return;
      }
      if(wasPlaying) {
        this._retimePlaying(position);
      } else if(this._intent&&this._ready){this._seen.clear();this._begin(position);}
      else this._emit();
    }
    pause() {
      this._cancelGlide();
      this._base=this.position;this._playing=false;this._intent=false;this._token++;this._startToken++;
      clearTimer(this._timer);this._timer=null;
      if(this.engine.context)this._clearVoices();this._seen.clear();this._emit();return this._base;
    }
    stop() {this.pause();this._base=0;this._emit();}

    async exportWav(segments,options={}) {
      const Offline=root.OfflineAudioContext||root.webkitOfflineAudioContext;
      if(!Offline)throw new Error('Este navegador no admite exportación WAV.');
      if(!Array.isArray(segments)||!segments.length||segments.length>2048)throw new RangeError('La muestra necesita de 1 a 2048 segmentos.');
      const duration=Number(options.duration===undefined?30:options.duration),offset=Number(options.offset===undefined?0:options.offset);
      if(!Number.isFinite(duration)||duration<=0||duration>180)throw new RangeError('La muestra WAV admite hasta 180 segundos.');
      if(!Number.isFinite(offset)||offset<0||offset>this.duration)throw new RangeError('La posición MIDI debe estar dentro de la obra.');
      let prior=0,position=offset;const clock=[];
      for(const segment of segments) {
        if(!segment||!Number.isFinite(segment.time)||segment.time<prior-.000001||!Number.isFinite(segment.duration)||segment.duration<=0)throw new RangeError('Los segmentos deben estar ordenados, sin solapamientos y con duración positiva.');
        if(segment.time>prior&&prior<duration)clock.push({time:prior,end:Math.min(segment.time,duration),position,final:position,params:describe(null)});
        const end=Math.min(duration,segment.time+segment.duration),params=describe(segment.value);
        if(segment.time<duration) {
          const final=params.value===null?position:Math.min(this.duration,position+(end-segment.time)*params.rate);
          clock.push({time:segment.time,end,position,final,params});position=final;
        }
        prior=segment.time+segment.duration;
      }
      if(prior<duration)clock.push({time:prior,end:duration,position,final:position,params:describe(null)});
      await this.unlock();
      const context=new Offline(2,Math.ceil(duration*44100),44100),render=new this.engine.constructor();
      render.context=context;render.offline=true;render.volume=this.engine.volume;render.heartbeat=this.engine.heartbeat;render.heartbeatVolume=this.engine.heartbeatVolume;
      render.sampleEntries=this.engine.sampleEntries;render.sampleBuffers=this.engine.sampleBuffers;render.sampleStatus='ready';
      const master=context.createGain(),limiter=context.createDynamicsCompressor();master.gain.value=render.volume*.5;
      limiter.threshold.value=-17;limiter.knee.value=14;limiter.ratio.value=16;limiter.attack.value=.003;limiter.release.value=.17;
      master.connect(limiter);limiter.connect(context.destination);render.output={gain:master,limiter};
      const environment={context,out:render._musicBus()};
      for(const note of this.notes) {
        const first=clock.findIndex(s=>s.params.value!==null&&s.final>s.position&&note.end>s.position&&note.time<s.final);
        if(first<0)continue;
        const section=clock[first],scoreStart=Math.max(note.time,section.position),start=section.time+(scoreStart-section.position)/section.params.rate;
        let end=duration,lastActive=section;
        for(let i=first;i<clock.length;i++) {
          const s=clock[i];
          if(s.params.value!==null&&note.time<s.final&&note.end>s.position)lastActive=s;
          if(s.params.value!==null&&note.end<=s.final){end=s.time+Math.max(0,note.end-s.position)/s.params.rate;break;}
        }
        end=Math.min(end,lastActive.end);
        const voice=this._newVoice(note,start,Math.min(end,duration),section.params,scoreStart-note.time,environment);
        if(!voice)continue;
        this._envelope(voice,start,scoreStart,voice.end,time=>{
          const s=clock.find(s=>s.params.value!==null&&time>=s.position&&time<=s.final);
          return s?s.time+(time-s.position)/s.params.rate:Infinity;
        },scoreStart>note.time?.012:.018);
        for(let i=first+1;i<clock.length&&clock[i].time<end;i++) {
          const s=clock[i],at=s.time;
          if(at<=start)continue;
          if(s.params.value===null) {
            const before=Math.max(start,at-.012);voice.gain.gain.setValueAtTime(voice.peak*this._expression(note,s.position),before);voice.gain.gain.linearRampToValueAtTime(0,at);voice.source.playbackRate.setValueAtTime(0,at);
          } else {
            const pitchRate=Math.pow(2,(note.midi+s.params.semitones-Number(voice.sample.midi))/12);
            voice.source.playbackRate.setTargetAtTime(pitchRate,at,.025);
            if(clock[i-1].params.value===null){voice.gain.gain.setValueAtTime(0,at);voice.gain.gain.linearRampToValueAtTime(voice.peak*this._expression(note,s.position),Math.min(at+.012,end));}
          }
        }
        // The final release takes precedence over all segment gain changes.
        const tail=Math.min(.06,(voice.end-voice.start)*.3);
        // A controller exactly at note-off belongs to the following instant,
        // not to the release of the note which is already ending.
        const lastPosition=Math.max(note.time,Math.min(note.end,lastActive.final)-.0000001);
        voice.gain.gain.setValueAtTime(voice.peak*this._expression(note,lastPosition),Math.max(voice.start,voice.end-tail));voice.gain.gain.linearRampToValueAtTime(0,voice.end);
      }
      if(options.heartbeat!==false&&render.heartbeat) {
        if(!root.SonificationPolicy||typeof render._scheduleZone!=='function')throw new Error('No se cargó la política del latido para exportar.');
        let sequenceIndex=0;
        for(const s of clock)if(s.params.value!==null&&s.end>s.time) {
          const d=root.SonificationPolicy.describe(s.params.value);
          // The shared engine limits one zone to twelve seconds. Keep the
          // complete requested extract audible without changing that engine.
          for(let at=s.time;at<s.end;at+=12)render._scheduleZone({value:d.value,pitchMidi:d.midi,mode:d.mode,bpm:d.bpm,irregular:d.irregular,duration:Math.min(12,s.end-at),music:false,heartbeat:true,strength:.62,sequenceIndex:sequenceIndex++},at);
        }
      }
      return encodeWav(await context.startRendering());
    }
  }
  return VivaldiPlayer;
});
