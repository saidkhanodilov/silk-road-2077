// Tiny synthesized sound effects (no audio files). Off until the visitor turns sound on.

let ctx = null;
let master = null;
let enabled = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.5, slideTo = null) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start, dur, gain = 0.4) {
  const c = ensure();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(c.currentTime + start);
}

export const sfx = {
  get enabled() { return enabled; },
  setEnabled(on) {
    enabled = on;
    if (on) {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    }
  },
  bean() { if (!enabled) return; tone(880, 0, 0.09, 'square', 0.25); tone(1320, 0.06, 0.12, 'square', 0.22); },
  bug() { if (!enabled) return; noise(0, 0.25, 0.35); tone(160, 0, 0.3, 'sawtooth', 0.35, 60); },
  station() { if (!enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.35)); },
  launch() { if (!enabled) return; tone(120, 0, 0.9, 'sawtooth', 0.25, 520); noise(0, 0.6, 0.15); },
  finish() { if (!enabled) return; [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.35, 'triangle', 0.32)); },
};
