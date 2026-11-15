/* Pulso Tierra. Impact themes and heartbeat use licensed audio recordings.
   Regional references remain explicitly synthesized. */
(function (root, factory) {
  'use strict';
  var Engine = factory(root);
  root.AtlasAudioEngine = Engine;
  if (typeof module === 'object' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const clamp = (v, low, high) => Math.max(low, Math.min(high, Number(v) || 0));
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const MAJOR = Object.freeze([0, 4, 7]);
  const MINOR = Object.freeze([0, 3, 7]);
  const JITTER = Object.freeze([1, .73, 1.31, .86, 1.12, .65, 1.24, .94]);
  const MAX_VOICES = 48;
  const MAX_GROUPS = 6;
  const HEART_GAIN = Math.pow(10,4/20);
  const MUSIC_GAIN = Math.pow(10,-2/20);
  const DUCK_GAIN = Math.pow(10,-2.5/20);
  const WATER_NOTES = Object.freeze([55,57,60,62,64,67,69,72,74,76]);
  const tensionFor = value => Number.isFinite(Number(value)) ? clamp((Math.abs(Number(value))-.5)/1.5,0,1) : 0;
  const nearest = (value,notes) => notes.reduce((best,note)=>Math.abs(note-value)<Math.abs(best-value)?note:best,notes[0]);
  const keyNote = (raw,minor) => {
    const scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11],notes=[];
    for(let note=24;note<=96;note++)if(scale.includes(note%12))notes.push(note);
    return nearest(raw,notes);
  };
  const waterPitchFor = (value,pitchMidi=72) => nearest(Number.isFinite(Number(value)) ? 65.5-5.25*clamp(value,-2,2) : 65.5+(clamp(pitchMidi,60,84)-72)*.875,WATER_NOTES);
  const IMPACTS = {
    water:{label:'Violín real con arco suave',origin:'Muestras de cuerdas grabadas; motivo original de agua corriente'},
    biodiversity:{label:'Grabaciones reales de animales',origin:'Búho, rana, insecto y mirlo; diversidad según anomalía'},
    forests:{label:'Violín con sordina, flauta y clarinete reales',origin:'Grabación de violín con sordina y vientos; motivo original inspirado en Murmullos del bosque'},
    oceans:{label:'Arpa, cuerdas y metales reales',origin:'Motivo original de ondulaciones y amplitud, inspirado en La mer'},
    marine:{label:'Flauta y violonchelo reales',origin:'Inflexiones originales inspiradas en el gesto de Vox Balaenae'},
    humans:{label:'Coro humano grabado',origin:'Voces humanas reales sostenidas'},
    food:{label:'Piano acústico grabado',origin:'Motivo original de cosecha para piano solo'},
    economy:{label:'Marcha industrial con percusión real',origin:'Bombo, caja con redobles, yunque y tambor de freno grabados'}
  };

  // Each partial is [frequency ratio, relative amplitude, wave type, cents].
  // They are deliberately distinctive approximations rather than authenticity claims.
  const PROFILES = {
    'north-america': { label:'Banjo sintetizado', origin:'Referencia bluegrass de los Apalaches', kind:'pluck', attack:.003, release:.10, partials:[[1,1,'triangle'],[2,.48,'sine'],[3,.26,'sine'],[5,.12,'sine']] },
    'mexico-central': { label:'Marimba sintetizada', origin:'Referencia de Guatemala y Chiapas', kind:'pluck', attack:.006, release:.15, partials:[[1,1,'sine'],[4,.40,'sine'],[10,.12,'sine']] },
    'caribbean': { label:'Steelpan sintetizado', origin:'Referencia de Trinidad y Tobago', kind:'metal', attack:.005, release:.25, partials:[[1,1,'sine'],[2,.62,'sine'],[3.02,.28,'sine'],[4.95,.16,'sine']] },
    'andes': { label:'Zampoña y charango sintetizados', origin:'Referencia de tradiciones andinas', kind:'sustain', attack:.07, release:.16, vibrato:4.6, partials:[[1,1,'sine'],[2,.19,'triangle'],[4,.09,'sine']] },
    'brazil': { label:'Cavaquinho sintetizado', origin:'Referencia brasileña de samba', kind:'pluck', attack:.004, release:.09, strum:.012, partials:[[1,1,'triangle'],[2,.52,'sine'],[3,.32,'sine'],[4,.15,'sine']] },
    'south-cone': { label:'Bandoneón sintetizado', origin:'Referencia del Río de la Plata', kind:'sustain', attack:.06, release:.13, partials:[[1,.65,'sawtooth',-5],[1,.65,'sawtooth',5],[2,.24,'sine']] },
    'europe': { label:'Violín sintetizado', origin:'Referencia de cuerdas de concierto europeas', kind:'sustain', attack:.10, release:.18, vibrato:5.2, partials:[[1,.62,'sawtooth'],[2,.20,'triangle'],[3,.09,'sine']] },
    'middle-east': { label:'Oud sintetizado', origin:'Referencia del norte de África y Asia occidental', kind:'pluck', attack:.005, release:.18, partials:[[1,1,'triangle'],[2,.33,'sine'],[3,.15,'sine'],[4,.06,'sine']] },
    'west-africa': { label:'Kora sintetizada', origin:'Referencia mandé de África occidental', kind:'pluck', attack:.008, release:.26, partials:[[1,1,'sine'],[2,.30,'sine'],[4,.14,'sine'],[6,.05,'sine']] },
    'east-africa': { label:'Mbira sintetizada', origin:'Referencia de Malawi y Zimbabue', kind:'metal', attack:.004, release:.25, partials:[[1,1,'sine'],[2.76,.37,'sine'],[5.4,.19,'sine'],[7.1,.07,'sine']] },
    'central-asia': { label:'Dombra sintetizada', origin:'Referencia kazaja', kind:'pluck', attack:.002, release:.08, partials:[[1,.9,'triangle'],[2,.5,'triangle'],[3,.24,'sine']] },
    'south-asia': { label:'Sitar sintetizado', origin:'Referencia del norte de India', kind:'pluck', attack:.004, release:.30, partials:[[1,1,'triangle'],[2,.55,'sine',4],[3,.35,'sine',-3],[4.02,.13,'sine']] },
    'east-asia': { label:'Erhu sintetizado', origin:'Referencia china', kind:'sustain', attack:.09, release:.16, vibrato:6.3, partials:[[1,.7,'sawtooth'],[2,.18,'sine'],[3,.06,'triangle']] },
    'southeast-asia': { label:'Metalófonos sintetizados', origin:'Inspirados en timbres de gamelan de Indonesia', kind:'metal', attack:.008, release:.32, partials:[[1,1,'sine'],[2.4,.43,'sine'],[3.7,.27,'sine'],[5.1,.15,'sine']] },
    'australasia': { label:'Didjeridú sintetizado', origin:'Firma de entrada inspirada en el noroeste australiano', kind:'sustain', attack:.07, release:.20, vibrato:2.2, transpose:-12, partials:[[1,.6,'sawtooth'],[2,.30,'sine'],[3,.20,'sine'],[5,.10,'sine']] },
    'pacific': { label:'ʻUkulele sintetizado', origin:'Referencia hawaiana', kind:'pluck', attack:.005, release:.13, strum:.018, partials:[[1,1,'triangle'],[2,.38,'sine'],[3,.17,'sine']] },
    'neutral': { label:'Voz neutra sintetizada', origin:'Océanos, polos y zonas sin referencia instrumental', kind:'sustain', attack:.06, release:.15, partials:[[1,1,'sine'],[2,.12,'sine']] }
  };

  function descriptor(id) {
    if (IMPACTS[id]) return Object.freeze({id,label:IMPACTS[id].label,origin:IMPACTS[id].origin,synthetic:false,recorded:true});
    const p = PROFILES[id] || PROFILES.neutral;
    return Object.freeze({ id: PROFILES[id] ? id : 'neutral', label:p.label, origin:p.origin, synthetic:true });
  }

  function params(options = {}) {
    const value = Number(options.value);
    const extreme = Number.isFinite(value) && Math.abs(value) >= 1.5;
    const mode = options.mode === 'minor' ? 'minor' : 'major';
    const regionId = PROFILES[options.regionId] ? options.regionId : 'neutral';
    const impactId = ['water','biodiversity','forests','oceans','marine','humans','food','economy'].includes(options.impactId) ? options.impactId : null;
    const duration = clamp(options.duration === undefined ? .62 : options.duration, .12, 12);
    const bpm = clamp(options.bpm === undefined ? 60 : options.bpm, 30, 200);
    const pitchMidi = clamp(options.pitchMidi === undefined ? 60 : options.pitchMidi, 36, 88);
    return { value, regionId, impactId, mode, bpm, pitchMidi, duration, tension:tensionFor(value),
      pan:clamp(options.pan || 0, -1, 1), irregular:Boolean(options.irregular),
      variety:extreme ? 1 : Math.round(clamp(options.variety === undefined ? 4 : options.variety, 1, 4)),
      strength:clamp(options.strength === undefined ? .72 : options.strength, 0, 1),
      heartbeat:options.heartbeat == null ? null : Boolean(options.heartbeat),
      sequenceIndex:Math.max(0, Math.floor(Number(options.sequenceIndex) || 0)),
      replace:Boolean(options.replace), onBeat:typeof options.onBeat === 'function' ? options.onBeat : null };
  }

  function beatOffsets(duration, bpm, irregular = false) {
    const result = [];
    const period = 60 / clamp(bpm, 30, 200);
    for (let n = 0, t = 0; t < duration - .025 && n < 48; n++) {
      result.push(t);
      t += period * (irregular ? JITTER[n % JITTER.length] : 1);
    }
    return result;
  }

  function makeOutput(context, volume) {
    const gain = context.createGain();
    gain.gain.value = volume * .50;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -17; limiter.knee.value = 14;
    limiter.ratio.value = 16; limiter.attack.value = .003; limiter.release.value = .17;
    gain.connect(limiter); limiter.connect(context.destination);
    return { gain, limiter };
  }

  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels, frames = buffer.length;
    const bytes = new ArrayBuffer(44 + frames * channels * 2), view = new DataView(bytes);
    const text = (offset, value) => { for(let i=0;i<value.length;i++) view.setUint8(offset+i,value.charCodeAt(i)); };
    text(0,'RIFF'); view.setUint32(4,bytes.byteLength-8,true); text(8,'WAVE'); text(12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true);
    view.setUint32(24,buffer.sampleRate,true); view.setUint32(28,buffer.sampleRate*channels*2,true);
    view.setUint16(32,channels*2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,frames*channels*2,true);
    const samples = Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
    let offset=44;
    for(let i=0;i<frames;i++) for(let channel=0;channel<channels;channel++) {
      const sample=Math.max(-1,Math.min(1,samples[channel][i]));
      view.setInt16(offset,sample<0?sample*32768:sample*32767,true); offset+=2;
    }
    return new Blob([bytes],{type:'audio/wav'});
  }

  class AtlasAudioEngine {
    constructor() {
      this.context = null;
      this.output = null;
      this.volume = .45;
      this.heartbeat = true;
      this.heartbeatVolume = .8;
      this.heartbeatOutput = null;
      this.musicOutput = null;
      this.musicEnabled = true;
      this.duckWindows = [];
      this.waterVoices = [];
      this.sampleStatus = 'idle';
      this.sampleError = null;
      this.sampleEntries = [];
      this.sampleBuffers = new Map();
      this._preloadPromise = null;
      this.voices = new Set();
      this.groups = new Set();
      this.timers = new Set();
      this.serial = 0;
      this.lastEvent = null;
      this.offline = false;
    }
    static frequency(midi) { return hz(midi); }
    static tensionFor(value) { return tensionFor(value); }
    static waterPitchFor(value,pitchMidi) { return waterPitchFor(value,pitchMidi); }
    static get regionIds() { return Object.keys(PROFILES).filter(id => !['neutral','water','forests','oceans','marine','humans','food','economy'].includes(id)); }
    static get impactIds() { return ['water','biodiversity','forests','oceans','marine','humans','food','economy']; }
    static profile(id) { return descriptor(id); }
    static normalizeOptions(options) { return params(options); }
    static beatOffsets(duration, bpm, irregular) { return beatOffsets(duration, bpm, irregular); }
    static notesFor(pitchMidi, mode) { return (mode === 'minor' ? MINOR : MAJOR).map(n => Number(pitchMidi) + n); }
    get isReady() { return Boolean(this.context && this.context.state === 'running' && this.sampleStatus === 'ready'); }

    _heartbeatBus() {
      if (!this.heartbeatOutput) {
        this.heartbeatOutput = this.context.createGain();
        this.heartbeatOutput.kind='heartbeat-bus';
        this.heartbeatOutput.gain.value = this.heartbeatVolume*HEART_GAIN;
        this.heartbeatOutput.connect(this.output.gain);
      }
      return this.heartbeatOutput;
    }

    _musicBus() {
      if(!this.musicOutput) {
        this.musicOutput=this.context.createGain();
        this.musicOutput.kind='music-bus';
        this.musicOutput.gain.value=this.musicEnabled?MUSIC_GAIN:0;
        this.musicOutput.connect(this.output.gain);
      }
      return this.musicOutput;
    }

    _resetDucking() {
      this.duckWindows=[];
      if(this.musicOutput) {
        const now=this.context.currentTime,param=this.musicOutput.gain;
        param.cancelScheduledValues(now);
        param.setValueAtTime(this.musicEnabled?MUSIC_GAIN:0,now);
      }
    }

    _refreshDucking() {
      if(!this.musicEnabled) return;
      const now=this.context.currentTime,base=MUSIC_GAIN,floor=base*DUCK_GAIN,param=this._musicBus().gain;
      this.duckWindows=this.duckWindows.filter(w=>w.end>now&&!w.group.cancelled);
      const merged=[];
      this.duckWindows.slice().sort((a,b)=>a.start-b.start).forEach(w=>{
        const previous=merged[merged.length-1];
        if(previous&&w.start<=previous.end) {
          previous.hold=Math.max(previous.hold,w.hold);previous.end=Math.max(previous.end,w.end);
        } else merged.push({start:w.start,attack:w.attack,hold:w.hold,end:w.end});
      });
      param.cancelScheduledValues(now);
      let current=base;
      const active=merged.find(w=>w.start<=now&&w.end>now);
      if(active)current=now<active.attack?base+(floor-base)*(now-active.start)/(active.attack-active.start):now<=active.hold?floor:floor+(base-floor)*(now-active.hold)/(active.end-active.hold);
      param.setValueAtTime(current,now);
      merged.forEach(w=>{
        if(w.start>now)param.setValueAtTime(base,w.start);
        if(w.attack>now)param.linearRampToValueAtTime(floor,w.attack);
        if(w.hold>now)param.setValueAtTime(floor,w.hold);
        param.linearRampToValueAtTime(base,w.end);
      });
    }

    _duckMusic(transient,group) {
      if(!this.heartbeat||this.heartbeatVolume<=0||!this.musicEnabled)return;
      this.duckWindows.push({start:Math.max(0,transient-.012),attack:transient+.004,hold:transient+.035,end:transient+.15,group});
      this._refreshDucking();
    }

    async preloadSamples(context = this.context) {
      if (this.sampleStatus === 'ready') return true;
      if (this._preloadPromise) return this._preloadPromise;
      const bank = root.AtlasSoundBank;
      if (!context || !bank || !Array.isArray(bank.samples) || !bank.samples.length) {
        this.sampleStatus = 'error';
        this.sampleError = new Error('No se encontró el banco de grabaciones. Recarga la app para cargar los sonidos reales.');
        throw this.sampleError;
      }
      if (typeof root.fetch !== 'function') throw new Error('El navegador no puede descargar las grabaciones de audio.');
      this.sampleStatus = 'loading'; this.sampleError = null;
      this._preloadPromise = (async () => {
        const entries = bank.samples.map(sample => Object.assign({}, sample));
        const seen = new Set();
        entries.forEach(sample => {
          if (!sample.id || !sample.instrument || !sample.url || seen.has(sample.id)) throw new Error('El banco de audio contiene una muestra inválida o duplicada.');
          seen.add(sample.id);
        });
        const decoded = new Map();
        let cursor = 0;
        const worker = async () => {
          while (cursor < entries.length) {
            const sample = entries[cursor++];
            const response = await root.fetch(sample.url);
            if (!response.ok) throw new Error('No se pudo descargar la grabación «' + sample.id + '» (HTTP ' + response.status + ').');
            const bytes = await response.arrayBuffer();
            let buffer;
            try { buffer = await context.decodeAudioData(bytes); }
            catch (_) { throw new Error('No se pudo decodificar la grabación «' + sample.id + '».'); }
            if (!buffer || !(buffer.duration > 0)) throw new Error('La grabación «' + sample.id + '» está vacía.');
            decoded.set(sample.id, buffer);
          }
        };
        await Promise.all(Array.from({length:Math.min(6,entries.length)}, worker));
        this.sampleEntries = entries; this.sampleBuffers = decoded;
        this.sampleStatus = 'ready'; return true;
      })().catch(error => {
        this.sampleStatus = 'error'; this.sampleError = error;
        this._preloadPromise = null; throw error;
      });
      return this._preloadPromise;
    }

    async unlock() {
      const Context = root.AudioContext || root.webkitAudioContext;
      if (!Context) throw new Error('Este navegador no admite Web Audio. Abre la app en Edge, Chrome o Safari actualizado.');
      if (!this.context || this.context.state === 'closed') {
        this.context = new Context();
        this.output = makeOutput(this.context, this.volume);
        this.heartbeatOutput = null;
        this.musicOutput = null;
        this.duckWindows=[];this.waterVoices=[];
      }
      if (this.context.state !== 'running') await this.context.resume();
      await this.preloadSamples();
      this._heartbeatBus();
      this._musicBus();
      if (!this.isReady) throw new Error('Pulsa Escuchar para activar el audio.');
      return true;
    }
    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      if (this.output) this.output.gain.gain.setTargetAtTime(this.volume * .50, this.context.currentTime, .025);
    }
    setHeartbeat(enabled) {
      this.heartbeat = Boolean(enabled);
      if (!this.heartbeat) Array.from(this.voices).forEach(voice => {if(voice.sampleInstrument==='heartbeat')voice.cancel();});
      if(!this.heartbeat)this._resetDucking();
    }
    setHeartbeatVolume(v) {
      this.heartbeatVolume = clamp(v,0,1);
      if (this.heartbeatOutput) this.heartbeatOutput.gain.setTargetAtTime(this.heartbeatVolume*HEART_GAIN,this.context.currentTime,.025);
      if(this.heartbeatVolume===0)this._resetDucking();
    }

    _voice(profile, midi, start, duration, strength, pan, group, glide) {
      if (duration <= .02 || strength <= 0) return null;
      // Retire old groups and voices before scheduling a new one. Future notes
      // are disconnected immediately on cancellation, sounding notes fade out.
      while (!this.offline && this.voices.size >= MAX_VOICES) this.voices.values().next().value.cancel();
      const context = this.context;
      const envelope = context.createGain();
      const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
      if (panner) { panner.pan.value = pan; envelope.connect(panner); panner.connect(this._musicBus()); }
      else envelope.connect(this._musicBus());
      const oscillators = [], extraNodes = [];
      const partials = profile.partials;
      const sum = partials.reduce((n,p) => n + p[1], 0);
      const peak = .26 * strength;
      const end = start + duration;
      const attack = Math.min(profile.attack, duration * .22);
      const release = Math.min(profile.release, duration * .45);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(peak, start + attack);
      if (profile.kind === 'sustain') {
        envelope.gain.setValueAtTime(peak * .84, Math.max(start + attack, end - release));
        envelope.gain.linearRampToValueAtTime(0, end);
      } else {
        envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * .055), Math.max(start + attack + .001, end - .015));
        envelope.gain.linearRampToValueAtTime(0, end);
      }
      const fundamental = hz(midi + (profile.transpose || 0));
      partials.forEach((part, index) => {
        const osc = context.createOscillator();
        const gain = context.createGain(); gain.gain.value = part[1] / sum;
        osc.type = part[2] || 'sine';
        osc.frequency.setValueAtTime(fundamental * part[0], start);
        if (part[3] && osc.detune) osc.detune.value = part[3];
        if (glide) osc.frequency.exponentialRampToValueAtTime(fundamental * part[0] * glide, end);
        osc.connect(gain); gain.connect(envelope); extraNodes.push(gain); oscillators.push(osc);
        osc.start(start + Math.min(.04, (profile.strum || 0) * index)); osc.stop(end + .015);
      });
      if (profile.vibrato && duration > .16) {
        const lfo = context.createOscillator(), depth = context.createGain();
        lfo.frequency.value = profile.vibrato; depth.gain.value = fundamental * .0035;
        lfo.connect(depth); depth.connect(oscillators[0].frequency);
        lfo.start(start); lfo.stop(end + .015); oscillators.push(lfo); extraNodes.push(depth);
      }
      let disposed = false, cancelled = false;
      const voice = {
        group, start, end, kind:'synthetic', sampleInstrument:null,
        dispose: () => {
          if (disposed) return; disposed = true;
          oscillators.forEach(o => { try { o.disconnect(); } catch (_) {} });
          extraNodes.forEach(n => { try { n.disconnect(); } catch (_) {} });
          try { envelope.disconnect(); if (panner) panner.disconnect(); } catch (_) {}
          this.voices.delete(voice); group.voices.delete(voice);
          if (!group.voices.size && !group.timers.size) this.groups.delete(group);
        },
        cancel: () => {
          if (cancelled || disposed) { this.voices.delete(voice); group.voices.delete(voice); return; }
          cancelled = true;
          const now = context.currentTime;
          if (start > now + .001) {
            oscillators.forEach(o => { try { o.stop(now); } catch (_) {} });
            voice.dispose(); return;
          }
          try {
            if (typeof envelope.gain.cancelAndHoldAtTime === 'function') envelope.gain.cancelAndHoldAtTime(now);
            else { envelope.gain.cancelScheduledValues(now); envelope.gain.setValueAtTime(peak * .6, now); }
            envelope.gain.linearRampToValueAtTime(0, now + .018);
            oscillators.forEach(o => { try { o.stop(now + .022); } catch (_) {} });
          } catch (_) { voice.dispose(); }
          this.voices.delete(voice); group.voices.delete(voice);
        }
      };
      oscillators[0].onended = voice.dispose;
      this.voices.add(voice); group.voices.add(voice);
      return voice;
    }

    _timer(fn, delay, group) {
      const id = setTimeout(() => {
        this.timers.delete(id); group.timers.delete(id);
        if (!group.cancelled) fn();
        if (!group.voices.size && !group.timers.size) this.groups.delete(group);
      }, delay);
      this.timers.add(id); group.timers.add(id);
    }
    _cancel(group) {
      if (!group || group.cancelled) return;
      group.cancelled = true;
      group.timers.forEach(id => { clearTimeout(id); this.timers.delete(id); });
      group.timers.clear();
      Array.from(group.voices).forEach(v => v.cancel());
      this.groups.delete(group);
      if(this.duckWindows.length)this._refreshDucking();
    }
    stop() {
      Array.from(this.groups).forEach(g => this._cancel(g));
      Array.from(this.voices).forEach(v => v.cancel());
      this.timers.forEach(clearTimeout); this.timers.clear();
      this.waterVoices=[];this._resetDucking();
    }

    _findSample(instrument, midi, id) {
      if (this.sampleStatus !== 'ready') throw this.sampleError || new Error('Las grabaciones todavía no están listas. Pulsa Escuchar para cargarlas.');
      const choices = this.sampleEntries.filter(sample => sample.instrument === instrument && (!id || sample.id === id));
      if (!choices.length) throw new Error('Falta una grabación real de ' + (id || instrument) + '. No se sustituirá por un sonido sintético.');
      if (!Number.isFinite(midi)) return choices[0];
      return choices.reduce((best,sample) => {
        const distance = Number.isFinite(Number(sample.midi)) ? Math.abs(Number(sample.midi)-midi) : Infinity;
        const bestDistance = Number.isFinite(Number(best.midi)) ? Math.abs(Number(best.midi)-midi) : Infinity;
        return distance < bestDistance ? sample : best;
      }, choices[0]);
    }

    _sampleVoice(instrument, midi, start, duration, strength, pan, group, options = {}) {
      if (!(duration > .02) || !(strength > 0)) return null;
      while (!this.offline && this.voices.size >= MAX_VOICES) this.voices.values().next().value.cancel();
      const sample = this._findSample(instrument,midi,options.id);
      const buffer = this.sampleBuffers.get(sample.id);
      if (!buffer) throw new Error('No está cargada la grabación «' + sample.id + '».');
      const context=this.context, source=context.createBufferSource(), envelope=context.createGain();
      const panner=typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
      const baseMidi=Number(sample.midi);
      const rate=Number.isFinite(midi) && Number.isFinite(baseMidi) && !options.unpitched ? Math.pow(2,clamp(midi-baseMidi,-24,24)/12) : 1;
      source.buffer=buffer; source.loop=false; source.kind='sample'; source.sampleInstrument=instrument; source.sampleId=sample.id;
      source.sampleRole=options.role||null;source.midi=midi;source.baseMidi=baseMidi;
      source.playbackRate.setValueAtTime(rate,start);
      const detune=clamp(options.detune||0,-35,35);
      if(source.detune)source.detune.setValueAtTime(detune,start);
      const sampleOffset=clamp(options.offset||0,0,Math.max(0,buffer.duration-.025));
      const length=Math.min(duration,(buffer.duration-sampleOffset) / Math.max(rate,rate*(options.glide || 1)));
      const end=start+length, peak=.76*clamp(strength,0,1);
      const attack=Math.min(options.attack === undefined ? .018 : options.attack,length*.2);
      const release=Math.min(options.release === undefined ? .075 : options.release,length*.35);
      envelope.gain.setValueAtTime(0,start);
      envelope.gain.linearRampToValueAtTime(peak,start+attack);
      if (options.swell) {
        envelope.gain.setValueAtTime(peak*.34,start+attack);
        envelope.gain.linearRampToValueAtTime(peak,start+length*.53);
      }
      const sustainEnd=Math.max(start+attack,end-release),depth=clamp(options.tremolo||0,0,.8);
      if(depth>0) {
        const interval=1/(2*clamp(options.tremoloRate||8,2,32));
        let step=0;
        for(let at=start+attack+interval;at<sustainEnd;at+=interval)envelope.gain.linearRampToValueAtTime(peak*(step++%2?1:1-depth),at);
      }
      envelope.gain.setValueAtTime(peak*.90,sustainEnd);
      envelope.gain.linearRampToValueAtTime(0,end);
      if (options.glide && typeof source.playbackRate.exponentialRampToValueAtTime === 'function') source.playbackRate.exponentialRampToValueAtTime(rate*options.glide,end);
      let filter=null;
      if(options.lowpass&&typeof context.createBiquadFilter==='function') {
        filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=clamp(options.lowpass,900,16000);filter.Q.value=.5;
        source.connect(filter);filter.connect(envelope);
      } else source.connect(envelope);
      const target=options.heartbeat ? this._heartbeatBus() : this._musicBus();
      if (panner) {panner.pan.value=pan;envelope.connect(panner);panner.connect(target);} else envelope.connect(target);
      let disposed=false,cancelled=false;
      const voice={group,start,end,kind:'sample',sampleInstrument:instrument,sampleId:sample.id,sampleOffset,source,
        midi,baseMidi,playbackRate:rate,peak,detune,role:options.role||null,filterCutoff:options.lowpass||null,tremoloDepth:depth,tension:options.tension||0,cancelled:false,
        dispose:()=>{
          if(disposed)return;disposed=true;
          try{source.disconnect();envelope.disconnect();if(panner)panner.disconnect();if(filter)filter.disconnect();}catch(_){}
          this.voices.delete(voice);group.voices.delete(voice);
          if(!group.voices.size&&!group.timers.size)this.groups.delete(group);
        },
        cancel:(at=context.currentTime,fade=.018)=>{
          if(cancelled||disposed){this.voices.delete(voice);group.voices.delete(voice);return;}
          cancelled=true;voice.cancelled=true;at=Math.max(context.currentTime,Number(at)||0);fade=clamp(fade,.004,.12);
          const stopAt=Math.min(end+.004,at+fade+.004);
          voice.end=start>at?at:stopAt;
          try{
            if(typeof envelope.gain.cancelAndHoldAtTime==='function')envelope.gain.cancelAndHoldAtTime(at);
            else{envelope.gain.cancelScheduledValues(at);envelope.gain.setValueAtTime(start>at?0:peak*.7,at);}
            envelope.gain.linearRampToValueAtTime(0,Math.min(stopAt,at+fade));
            source.stop(start>at?at:stopAt);
          }catch(_){if(at<=context.currentTime+.001)voice.dispose();}
          this.voices.delete(voice);group.voices.delete(voice);
          if(start>at && at<=context.currentTime+.001)voice.dispose();
          if(!group.voices.size&&!group.timers.size)this.groups.delete(group);
        }
      };
      source.onended=voice.dispose;
      this.voices.add(voice);group.voices.add(voice);
      try{source.start(start,sampleOffset);source.stop(end+.004);}catch(error){voice.dispose();throw error;}
      return voice;
    }

    _heartbeat(start,strength,group,period=1) {
      if(!(strength>0)||this.heartbeatVolume<=0)return;
      const options={unpitched:true,heartbeat:true,attack:.003,release:.025};
      if(period>=.76) {
        this._sampleVoice('heartbeat',null,start,Math.min(1.05,period*.95),strength,0,group,options);
        this._duckMusic(start+.13,group);this._duckMusic(start+.48,group);
      } else {
        // The real recording contains lub at ~.12 s and dub at ~.48 s.
        // Shorten their intervening silence at fast BPM, preserving pitch and
        // both recorded transients instead of layering full 1 s cycles.
        this._sampleVoice('heartbeat',null,start,Math.min(.27,period*.44),strength,0,group,Object.assign({},options,{offset:.035,release:.016}));
        this._sampleVoice('heartbeat',null,start+period*.48,Math.min(.32,period*.46),strength*.92,0,group,Object.assign({},options,{offset:.40,release:.016}));
        this._duckMusic(start+.095,group);this._duckMusic(start+period*.48+.08,group);
      }
    }

    _cancelAnimalVoices(at) {
      Array.from(this.voices).forEach(voice => {
        if(voice.sampleInstrument==='animal' && voice.end>at)voice.cancel(at);
      });
    }

    _water(o,start,phase,group) {
      const t=o.tension,lead=waterPitchFor(o.value,o.pitchMidi);
      const active=this.waterVoices.filter(voice=>voice.end>start);
      active.forEach(voice=>voice.cancel(start,voice.role==='water-lead'?.065:.018));
      let leadStart=start;
      while(active.filter(voice=>voice.start<=leadStart&&voice.end>leadStart).length>=2) {
        leadStart=Math.min(...active.filter(voice=>voice.end>leadStart).map(voice=>voice.end))+.005;
      }
      const supportStart=Math.max(leadStart+.12,...active.map(voice=>voice.end+.005));
      const length=Math.max(1.15,Math.min(1.55,o.duration+.5));
      const support=phase%2?(o.mode==='minor'?63:64):60;
      // Enter the recorded sustained bow after its quiet initial attack.
      // The original six-second recording remains unchanged in the bank.
      const common={offset:1,lowpass:3200+4300*t,tension:t,attack:.13,release:.28};
      const first=this._sampleVoice('violin',lead,leadStart,length,o.strength*.67,clamp(o.pan-.08,-1,1),group,Object.assign({},common,{role:'water-lead'}));
      const second=this._sampleVoice('violin',support,supportStart,length,o.strength*.27*(1-.10*t),clamp(o.pan+.10,-1,1),group,
        Object.assign({},common,{role:'water-support',attack:.16,detune:(phase%2?1:-1)*26*t,tremolo:.36*t*t,tremoloRate:5+13*t}));
      // Keep every voice still audible at this request's start. leadStart can
      // be deferred; dropping voices relative to that future time loses slots
      // needed by another request that arrives during the crossfade.
      this.waterVoices=active.filter(voice=>voice.end>start).concat([first,second].filter(Boolean));
    }

    _impact(o,start,phase,group) {
      const n=o.pitchMidi, minor=o.mode==='minor', third=minor?3:4,t=o.tension;
      const tone=raw=>keyNote(raw,minor);
      const p=(instrument,midi,delay,length,gain,extra={})=>this._sampleVoice(instrument,midi,start+delay,length,o.strength*gain,o.pan,group,Object.assign({tension:t},extra));
      const legato=Math.max(1,Math.min(1.45,o.duration+.35));
      switch(o.impactId) {
        case 'water': {
          this._water(o,start,phase,group);
          break;
        }
        case 'forests':
          p('mutedstrings',n-12,0,legato+.12,.55,{attack:.10,release:.25,lowpass:3600+3500*t,tremolo:.28*t*t,tremoloRate:4+12*t,detune:9*t});
          p(phase%2?'clarinet':'flute',tone(n+(phase%3===0?third:7)),.16+.13*t*(phase%3),1.02-.57*t,.54,{attack:.06,release:.14,lowpass:4400+3200*t,tremolo:.24*t,tremoloRate:5+8*t});
          break;
        case 'oceans':
          [0,7,12].forEach((interval,index)=>p('harp',tone(n-12+interval)+(index===2?t*.8:0),index*.17,1.12,(.56-index*.09)*(1-.08*t),{attack:.003,release:.15}));
          p('strings',tone(n-12+third),.06,1.25,.28-.08*t,{attack:.15,release:.28,swell:true,detune:12*t,tremolo:.18*t,tremoloRate:6+9*t});
          p(phase%2?'trombone':'horn',tone(n-12+(phase%2?0:7)),.12,1.2,.40+.14*t,{attack:.18,release:.28,swell:true,lowpass:3800+4300*t,detune:-10*t});
          break;
        case 'marine':
          p('cello',n-24,0,1.35-.32*t,.66,{attack:.12,release:.26,glide:phase%2?1/(1.025+.09*t):1.025+.09*t,tremolo:.18*t,tremoloRate:3+9*t});
          p('flute',tone(n+(phase%3===1?2:0)),.22+.2*t,1.18-.61*t,.52,{attack:.12,release:.25,glide:phase%2?1.02+.22*t:1/(1.02+.22*t),tremolo:.30*t,tremoloRate:3+7*t});
          break;
        case 'humans': {
          const voice=60+Math.round((n-60)/2);
          p('choir',voice,0,1.35-.62*t,.87-.18*t,{attack:.075,release:.19,lowpass:4200+2400*t,tremolo:.55*t*t,tremoloRate:3+10*t});
          if(t>0)p('choir',voice+1,.09,.98-.44*t,.18*t,{attack:.10,release:.18,detune:(phase%2?1:-1)*14*t,tremolo:.35*t,tremoloRate:4+9*t});
          break;
        }
        case 'food': {
          const harvest=[0,2,third,7,third,2,0,-2];
          p('piano',n-12,0,1.1-.25*t,.88,{attack:.003,release:.16});
          if(!(t>.6&&phase%4===3))p('piano',t>.5?n-11:tone(n-12+harvest[(phase+1)%8]),.23+.11*t,.92-.36*t,.58*(1-.08*t),{attack:.003,release:.16});
          break;
        }
        case 'economy': {
          const quarter=60/clamp(o.bpm,72,132),beat=phase%4;
          if(beat===0||beat===2)p('bassdrum',null,0,.9,.95,{unpitched:true,attack:.002,release:.12});
          else p('snare',null,0,.42,1,{unpitched:true,attack:.002,release:.045});
          p('snare',null,quarter*.5,.34,.32,{unpitched:true,attack:.002,release:.04});
          if(beat===3)[.25,.75,.875].forEach((step,index)=>p('snare',null,quarter*step,.3,.30+index*.12,{unpitched:true,attack:.002,release:.035}));
          p(beat%2?'brakedrum':'anvil',null,.015,.78,beat===0?.54:.36,{unpitched:true,attack:.002,release:.13});
          if(beat===0) {
            p('horn',n-12,.035,.62,.24,{attack:.025,release:.11});
            p('horn',n-5,.26,.64,.20,{attack:.025,release:.12});
            p('trombone',n-12,.035,.70,.17,{attack:.035,release:.13});
          }
          break;
        }
        case 'biodiversity': {
          const ids=['animal-owl','animal-frog','animal-insect','animal-blackbird'].slice(0,o.variety);
          if(o.variety===1) {
            this._cancelAnimalVoices(start);
            p('animal',null,0,1.65,.9,{id:'animal-owl',unpitched:true,attack:.008,release:.12});
          } else {
            for(let i=0;i<o.variety;i++) {
              const id=ids[(phase+i)%ids.length];
              this._sampleVoice('animal',null,start+i*.22,id==='animal-blackbird'?1.85:1.55,o.strength*.60,
                (i/(o.variety-1)-.5)*1.25,group,{id,unpitched:true,attack:.008,release:.13});
            }
          }
          break;
        }
      }
    }

    playZone(options = {}) {
      if (this.sampleStatus === 'error') throw this.sampleError;
      if (!this.isReady) return null;
      return this._scheduleZone(options, this.context.currentTime + .012);
    }

    _scheduleZone(options, start) {
      const o = params(options);
      // Validate the required recordings before starting any layer. A missing
      // instrument is an actionable error, never a synthesized replacement.
      if(o.strength>0) {
        if(this.heartbeat && o.heartbeat!==false)this._findSample('heartbeat',null);
        const required={water:['violin'],forests:['mutedstrings','flute','clarinet'],oceans:['harp','strings','horn','trombone'],marine:['flute','cello'],humans:['choir'],food:['piano'],economy:['bassdrum','snare','anvil','brakedrum','horn','trombone']};
        if(required[o.impactId])required[o.impactId].forEach(instrument=>this._findSample(instrument,null));
        if(o.impactId==='biodiversity') {
          const ids=['animal-owl','animal-frog','animal-insect','animal-blackbird'].slice(0,o.variety);
          ids.forEach(id=>this._findSample('animal',null,id));
        }
      }
      if (o.replace && !this.offline) this.stop();
      while (!this.offline && this.groups.size >= MAX_GROUPS) this._cancel(this.groups.values().next().value);
      const group = { id:++this.serial, cancelled:false, voices:new Set(), timers:new Set() };
      this.groups.add(group);
      const offsets = beatOffsets(o.duration, o.bpm, o.irregular);
      const notes = AtlasAudioEngine.notesFor(o.pitchMidi, o.mode);
      const profileId = o.impactId || o.regionId;
      const profile = PROFILES[profileId] || PROFILES.neutral;
      const beatPeriod = 60 / o.bpm;
      offsets.forEach((offset, beat) => {
        const room = o.duration - offset;
        const nextPeriod=beat+1<offsets.length?offsets[beat+1]-offset:beatPeriod*(o.irregular?JITTER[beat%JITTER.length]:1);
        if (this.heartbeat && o.heartbeat !== false) this._heartbeat(start + offset, o.strength, group,nextPeriod);
        if (o.onBeat && !this.offline) this._timer(() => o.onBeat(beat, offset), 12 + offset * 1000, group);
        if (o.impactId) {
          this._impact(o,start+offset,o.sequenceIndex+beat,group);
        } else {
          // A short arpeggio makes the major/minor third audible. Fast raster
          // scans still retain a minimal two-note interval instead of only root.
          const span = Math.min(beatPeriod * .62, room * .72);
          [0,1,2].forEach((degree, n) => {
            const delay = n * span / 3;
            const length = Math.min(profile.kind === 'sustain' ? .65 : .44, Math.max(.055, room - delay), beatPeriod * .85);
            this._voice(profile, notes[degree], start + offset + delay, length,
              o.strength * (n === 0 ? .83 : .46), o.pan, group);
          });
          if (o.regionId === 'andes') this._voice(PROFILES.pacific, notes[2], start + offset + .035, Math.min(.28, room), o.strength * .25, .18, group);
        }
      });
      const info = { id:group.id, profile:descriptor(profileId), mode:o.mode, midi:notes.slice(),
        bpm:o.bpm, beats:offsets.slice(), sequenceIndex:o.sequenceIndex, tension:o.tension, variety:o.impactId === 'biodiversity' ? o.variety : null,
        cancel:() => this._cancel(group) };
      this.lastEvent = info;
      return info;
    }

    async exportWav(events, options = {}) {
      const Offline = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      if (!Offline) throw new Error('Este navegador no admite exportación WAV. Usa Edge, Chrome o Safari actualizado.');
      if (!Array.isArray(events) || events.length < 1 || events.length > 512) throw new RangeError('La exportación admite de 1 a 512 eventos.');
      const timeline = events.map(event => {
        if (!event || !Number.isFinite(event.time) || event.time < 0 || event.time >= 180) throw new RangeError('Cada evento necesita un tiempo entre 0 y 180 segundos.');
        const normalized = params(event.options || {});
        return {time:event.time, options:normalized};
      });
      timeline.sort((a,b)=>a.time-b.time);
      const latest = timeline.reduce((max,event)=>Math.max(max,event.time+event.options.duration+1.8),0);
      const duration = options.duration === undefined ? Math.min(180,latest) : Number(options.duration);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 180) throw new RangeError('La duración WAV debe ser mayor que cero y hasta 180 segundos.');
      const sampleRate=44100;
      const render=new AtlasAudioEngine(); render.offline=true;
      render.volume=this.volume; render.heartbeat=this.heartbeat; render.heartbeatVolume=this.heartbeatVolume;
      render.musicEnabled=options.music!==false;
      render.context=new Offline(2,Math.ceil(duration*sampleRate),sampleRate);
      render.output=makeOutput(render.context,render.volume);
      await this.preloadSamples(render.context);
      render.sampleEntries=this.sampleEntries;render.sampleBuffers=this.sampleBuffers;render.sampleStatus='ready';
      render._heartbeatBus();
      render._musicBus();
      timeline.forEach(event=>{
        if(event.time<duration) render._scheduleZone(event.options,event.time+.012);
      });
      const result=await render.context.startRendering();
      render.voices.clear(); render.groups.clear();
      return encodeWav(result);
    }
  }
  return AtlasAudioEngine;
});

