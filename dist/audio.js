/* Pulso Tierra: deterministic, browser-local image sonification. */
(function (root) {
  'use strict';

  const MIDI = Object.freeze([48, 55, 60, 64, 72]);
  const LABELS = Object.freeze(['Muy fría', 'Fría', 'Referencia', 'Cálida', 'Muy cálida']);
  const STEPS = 16;
  const MAX_VOICES = 12;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const frequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function normalize(histogram) {
    if (!Array.isArray(histogram) && !ArrayBuffer.isView(histogram)) {
      throw new TypeError('Se necesitan cinco proporciones de color.');
    }
    if (histogram.length !== 5) throw new RangeError('El histograma debe tener cinco categorías.');
    const values = Array.from(histogram, (v) => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
    const total = values.reduce((sum, v) => sum + v, 0);
    return total > 0 ? values.map((v) => v / total) : [0, 0, 0, 0, 0];
  }

  // The same distribution always produces the same 16-note motif. Largest
  // remainders retain proportions to the nearest note; no category is invented.
  function sequenceFor(histogram, steps = STEPS) {
    const weights = normalize(histogram);
    if (!weights.some(Boolean)) return [];
    steps = Math.round(clamp(steps, 1, 64));
    const exact = weights.map((w) => w * steps);
    const counts = exact.map(Math.floor);
    const rank = exact.map((v, i) => ({ i, remainder: v - counts[i] }))
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    let remaining = steps - counts.reduce((sum, n) => sum + n, 0);
    for (let i = 0; i < remaining; i++) counts[rank[i].i]++;
    const sorted = [];
    counts.forEach((count, category) => {
      for (let i = 0; i < count; i++) sorted.push(category);
    });
    // Alternate across the sorted distribution to make a repeatable musical
    // figure instead of treating a still image as a temporal climate record.
    const sequence = [];
    let low = 0;
    let high = sorted.length - 1;
    while (low <= high) {
      sequence.push(sorted[low++]);
      if (low <= high) sequence.push(sorted[high--]);
    }
    return sequence;
  }

  function makeOutput(context, volume) {
    const gain = context.createGain();
    gain.gain.value = clamp(volume, 0, 1) * 0.65;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.knee.value = 18;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;
    gain.connect(compressor);
    compressor.connect(context.destination);
    return { gain, compressor };
  }

  function createVoice(context, output, category, pan, start, duration, strength, timbre) {
    const envelope = context.createGain();
    const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = clamp(pan, -1, 1);
      envelope.connect(panner);
      panner.connect(output);
    } else {
      envelope.connect(output);
    }

    const oscillators = [];
    const harmonicGains = [];
    const hz = frequency(MIDI[category]);
    const osc = context.createOscillator();
    osc.type = timbre === 'triangle' ? 'triangle' : 'sine';
    osc.frequency.value = hz;
    osc.connect(envelope);
    oscillators.push(osc);
    if (timbre === 'soft') {
      const harmonic = context.createOscillator();
      harmonic.type = 'sine';
      harmonic.frequency.value = hz * 2;
      const mix = context.createGain();
      mix.gain.value = 0.10;
      harmonic.connect(mix);
      mix.connect(envelope);
      oscillators.push(harmonic);
      harmonicGains.push(mix);
    }

    const attack = Math.min(0.016, duration * 0.15);
    const release = Math.min(0.10, duration * 0.45);
    const peak = 0.20 * clamp(strength, 0, 1);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(peak, start + attack);
    envelope.gain.setValueAtTime(peak, Math.max(start + attack, start + duration - release));
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    oscillators.forEach((o) => {
      o.start(start);
      o.stop(start + duration + 0.02);
    });

    let disposed = false;
    const voice = {
      start,
      end: start + duration + 0.02,
      group: null,
      cancel() {
        if (disposed) return;
        const now = context.currentTime;
        try {
          if (typeof envelope.gain.cancelAndHoldAtTime === 'function') {
            envelope.gain.cancelAndHoldAtTime(now);
          } else {
            envelope.gain.cancelScheduledValues(now);
            envelope.gain.setValueAtTime(start > now ? 0 : peak, now);
          }
          envelope.gain.linearRampToValueAtTime(0, now + 0.018);
          oscillators.forEach((o) => { try { o.stop(now + 0.022); } catch (_) {} });
        } catch (_) {
          this.dispose();
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        oscillators.forEach((o) => { try { o.disconnect(); } catch (_) {} });
        harmonicGains.forEach((g) => { try { g.disconnect(); } catch (_) {} });
        try { envelope.disconnect(); } catch (_) {}
        if (panner) { try { panner.disconnect(); } catch (_) {} }
        if (voice.onDispose) voice.onDispose();
      }
    };
    osc.onended = () => voice.dispose();
    return voice;
  }

  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const bytes = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(bytes);
    const ascii = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    ascii(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true);
    ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
    ascii(36, 'data'); view.setUint32(40, frames * channels * 2, true);
    const samples = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
    let offset = 44;
    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        const value = Math.max(-1, Math.min(1, samples[channel][frame]));
        view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true);
        offset += 2;
      }
    }
    return new Blob([bytes], { type: 'audio/wav' });
  }

  class SonificationEngine {
    constructor() {
      this.context = null;
      this.output = null;
      this.volume = 0.55;
      this.timbre = 'soft';
      this.voices = new Set();
      this.timers = new Set();
      this.currentMotif = null;
    }

    static get midiNotes() { return MIDI.slice(); }
    static get categoryLabels() { return LABELS.slice(); }
    static sequenceFor(histogram, steps = STEPS) { return sequenceFor(histogram, steps); }

    get isReady() { return Boolean(this.context && this.context.state === 'running'); }

    async unlock() {
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Este navegador no admite audio. Abre la app en Chrome, Edge o Safari actualizado.');
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContextClass();
        this.output = makeOutput(this.context, this.volume);
      }
      if (this.context.state !== 'running') await this.context.resume();
      if (this.context.state !== 'running') throw new Error('Pulsa Reproducir para activar el audio del navegador.');
      return true;
    }

    setVolume(value) {
      this.volume = clamp(value, 0, 1);
      if (this.context && this.output) {
        this.output.gain.gain.setTargetAtTime(this.volume * 0.65, this.context.currentTime, 0.025);
      }
    }

    setTimbre(value) {
      if (!['sine', 'triangle', 'soft'].includes(value)) throw new RangeError('Timbre desconocido.');
      this.timbre = value;
    }

    _voice(category, pan, start, duration, strength, group) {
      const voice = createVoice(this.context, this.output.gain, category, pan, start, duration, strength, this.timbre);
      voice.group = group;
      voice.onDispose = () => this.voices.delete(voice);
      this.voices.add(voice);
      return voice;
    }

    playCell(category, pan = 0, duration = 0.16, strength = 0.7) {
      if (!this.isReady) return false;
      if (!Number.isInteger(category) || category < 0 || category > 4) return false;
      // Completed voices are removed by onended. Rapid pointer moves retire old
      // voices with a short fade rather than multiplying unlimited oscillators.
      const active = Array.from(this.voices).filter((v) => v.group === null);
      if (active.length >= MAX_VOICES) active.slice(0, active.length - MAX_VOICES + 1).forEach((v) => {
        v.cancel();
        this.voices.delete(v);
      });
      this._voice(category, clamp(pan, -1, 1), this.context.currentTime + 0.006,
        clamp(duration, 0.045, 2), clamp(strength, 0, 1), null);
      return true;
    }

    playLegend(category) { return this.playCell(category, 0, 0.55, 0.8); }

    _timer(fn, delay, group) {
      const id = setTimeout(() => {
        this.timers.delete(id);
        if (group && group.cancelled) return;
        fn();
      }, Math.max(0, delay));
      this.timers.add(id);
      if (group) group.timers.add(id);
      return id;
    }

    playMotif(histogram, options = {}) {
      if (!this.isReady) throw new Error('Activa el audio antes de reproducir.');
      const sequence = sequenceFor(histogram);
      const duration = clamp(options.duration === undefined ? 3 : options.duration, 0.8, 30);
      this.stop();
      const group = { cancelled: false, timers: new Set() };
      this.currentMotif = group;
      const start = this.context.currentTime + 0.035;
      const interval = duration / STEPS;
      sequence.forEach((category, index) => {
        this._voice(category, (category - 2) * 0.22, start + index * interval,
          Math.min(interval * 0.86, 0.55), 0.82, group);
        if (typeof options.onStep === 'function') {
          this._timer(() => options.onStep(index, category), 35 + index * interval * 1000, group);
        }
      });
      this._timer(() => {
        if (this.currentMotif === group) this.currentMotif = null;
        if (typeof options.onEnd === 'function') options.onEnd();
      }, 35 + duration * 1000, group);
      return () => this._cancelGroup(group);
    }

    _cancelGroup(group) {
      if (!group || group.cancelled) return;
      group.cancelled = true;
      group.timers.forEach((id) => { clearTimeout(id); this.timers.delete(id); });
      group.timers.clear();
      Array.from(this.voices).filter((v) => v.group === group).forEach((v) => v.cancel());
      if (this.currentMotif === group) this.currentMotif = null;
    }

    stop() {
      this._cancelGroup(this.currentMotif);
      this.timers.forEach(clearTimeout);
      this.timers.clear();
      this.voices.forEach((v) => v.cancel());
    }

    async exportWav(histograms, options = {}) {
      const Offline = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      if (!Offline) throw new Error('Este navegador no permite exportar audio.');
      if (!Array.isArray(histograms) || !histograms.length || histograms.length > 24) {
        throw new RangeError('Selecciona entre una y veinticuatro imágenes para exportar.');
      }
      const sequences = histograms.map((histogram) => sequenceFor(histogram));
      const duration = clamp(options.durationPerFrame === undefined ? 3 : options.durationPerFrame, 0.8, 15);
      const gap = clamp(options.gap === undefined ? 0.35 : options.gap, 0, 3);
      const sampleRate = 44100;
      const total = histograms.length * duration + (histograms.length - 1) * gap + 0.3;
      const context = new Offline(2, Math.ceil(total * sampleRate), sampleRate);
      const output = makeOutput(context, this.volume);
      const interval = duration / STEPS;
      sequences.forEach((sequence, frame) => {
        sequence.forEach((category, index) => {
          createVoice(context, output.gain, category, (category - 2) * 0.22,
            0.035 + frame * (duration + gap) + index * interval,
            Math.min(interval * 0.86, 0.55), 0.82, this.timbre);
        });
      });
      return encodeWav(await context.startRendering());
    }
  }

  root.SonificationEngine = SonificationEngine;
})(typeof window !== 'undefined' ? window : globalThis);
