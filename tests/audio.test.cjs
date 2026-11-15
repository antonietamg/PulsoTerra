const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const timers = new Map();
  let timerId = 0;
  const events = [];
  class Param {
    constructor(value = 0) { this.value = value; }
    setValueAtTime(value, time) { assert.ok(Number.isFinite(value)); assert.ok(Number.isFinite(time)); this.value = value; }
    linearRampToValueAtTime(value, time) { assert.ok(Number.isFinite(value)); assert.ok(Number.isFinite(time)); this.value = value; }
    setTargetAtTime(value) { this.value = value; }
    cancelAndHoldAtTime() {}
    cancelScheduledValues() {}
  }
  class Node {
    constructor() { this.gain = new Param(); this.pan = new Param(); this.frequency = new Param(); }
    connect() {}
    disconnect() {}
    start(time) { events.push(['start', time, this.frequency.value]); }
    stop(time) { events.push(['stop', time]); }
  }
  class Context {
    constructor() { this.currentTime = 0; this.state = 'suspended'; this.destination = new Node(); }
    async resume() { this.state = 'running'; }
    createGain() { return new Node(); }
    createStereoPanner() { return new Node(); }
    createOscillator() { return new Node(); }
    createDynamicsCompressor() {
      const node = new Node();
      for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Param();
      return node;
    }
  }
  class Offline extends Context {
    constructor(channels, length, sampleRate) { super(); Object.assign(this, { channels, length, sampleRate }); }
    async startRendering() {
      return {
        numberOfChannels: this.channels,
        length: this.length,
        sampleRate: this.sampleRate,
        getChannelData: () => new Float32Array(this.length)
      };
    }
  }
  const window = { AudioContext: Context, OfflineAudioContext: Offline };
  const context = vm.createContext({ window, Blob, setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); } });
  const code = fs.readFileSync(path.join(__dirname, '../dist/audio.js'), 'utf8');
  vm.runInContext(code, context);
  return { Engine: window.SonificationEngine, timers, events };
}

test('fixed notes and weighted motifs are repeatable and keep proportions', () => {
  const { Engine } = setup();
  assert.deepEqual(Array.from(Engine.midiNotes), [48, 55, 60, 64, 72]);
  const counts = Array(5).fill(0);
  const sequence = Array.from(Engine.sequenceFor([1, 2, 3, 4, 6]));
  sequence.forEach((category) => counts[category]++);
  assert.equal(sequence.length, 16);
  assert.deepEqual(counts, [1, 2, 3, 4, 6]);
  assert.deepEqual(sequence, Array.from(Engine.sequenceFor([10, 20, 30, 40, 60])));
  assert.deepEqual(Array.from(Engine.sequenceFor([0, 0, 0, 0, 1])), Array(16).fill(4));
});

test('missing or invalid bins never invent a neutral note', () => {
  const { Engine } = setup();
  assert.deepEqual(Array.from(Engine.sequenceFor([0, 0, 0, 0, 0])), []);
  assert.deepEqual(Array.from(Engine.sequenceFor([NaN, -1, 0, Infinity, 0])), []);
  assert.throws(() => Engine.sequenceFor([1, 2]), /cinco/);
});

test('unlock, volume, pitch and rapid pointer events stay bounded', async () => {
  const { Engine, events } = setup();
  const engine = new Engine();
  assert.equal(engine.playCell(2), false);
  await engine.unlock();
  engine.setVolume(9);
  assert.equal(engine.volume, 1);
  engine.setVolume(-3);
  assert.equal(engine.volume, 0);
  engine.setTimbre('sine');
  assert.equal(engine.playCell(9), false);
  for (let i = 0; i < 50; i++) engine.playCell(i % 5);
  assert.ok(engine.voices.size <= 12);
  assert.ok(events.some((e) => e[0] === 'start' && Math.abs(e[2] - 261.625565) < .01));
  assert.throws(() => engine.setTimbre('unknown'), /Timbre/);
});

test('stop cancels motif callbacks even if an already queued callback runs', async () => {
  const { Engine, timers } = setup();
  const engine = new Engine();
  await engine.unlock();
  let steps = 0;
  let ends = 0;
  engine.playMotif([.2, .2, .2, .2, .2], { onStep: () => steps++, onEnd: () => ends++ });
  const pending = Array.from(timers.values());
  assert.equal(pending.length, 17);
  engine.stop();
  assert.equal(timers.size, 0);
  pending.forEach(({ fn }) => fn());
  assert.equal(steps, 0);
  assert.equal(ends, 0);
});

test('WAV export has valid stereo PCM header and expected duration', async () => {
  const { Engine } = setup();
  const engine = new Engine();
  const blob = await engine.exportWav([[1, 0, 0, 0, 0], [0, 0, 0, 0, 1]], { durationPerFrame: 2, gap: .5 });
  assert.equal(blob.type, 'audio/wav');
  const buffer = Buffer.from(await blob.arrayBuffer());
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
  assert.equal(buffer.readUInt16LE(22), 2);
  assert.equal(buffer.readUInt32LE(24), 44100);
  assert.equal(buffer.readUInt16LE(34), 16);
  assert.equal(buffer.length, 44 + Math.ceil(4.8 * 44100) * 4);
});
