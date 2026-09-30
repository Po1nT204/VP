// Процедурный звук через Web Audio API. Без файлов.
const Sound = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;
  const throttle = {}; // { name: lastTime }

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch (e) {
      enabled = false;
    }
  }

  function ok(name, minGap = 0.03) {
    if (!enabled) return false;
    ensure();
    if (!ctx) return false;
    const now = ctx.currentTime;
    if (throttle[name] && now - throttle[name] < minGap) return false;
    throttle[name] = now;
    return true;
  }

  function tone(
    freq,
    dur,
    type = 'square',
    vol = 0.5,
    freqEnd = null,
    delay = 0,
  ) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, freqEnd),
        t0 + dur,
      );
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.4, filterFreq = 1200, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  return {
    resume() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    isEnabled() {
      return enabled;
    },

    shoot() {
      if (!ok('shoot', 0.04)) return;
      tone(900, 0.05, 'square', 0.25, 380);
    },
    hit() {
      if (!ok('hit', 0.02)) return;
      noise(0.04, 0.18, 2400);
    },
    kill() {
      if (!ok('kill', 0.03)) return;
      tone(180, 0.13, 'sawtooth', 0.3, 60);
    },
    pickup() {
      if (!ok('pickup', 0.02)) return;
      tone(1300, 0.04, 'triangle', 0.15, 1700);
    },
    heal() {
      if (!ok('heal', 0.1)) {
        tone(700, 0.1, 'sine', 0.3, 900);
        tone(1000, 0.12, 'sine', 0.25, 1300, 0.07);
      }
    },
    dash() {
      if (!ok('dash', 0.1)) return;
      noise(0.12, 0.25, 900);
    },
    hurt() {
      if (!ok('hurt', 0.15)) return;
      tone(160, 0.2, 'sawtooth', 0.4, 50);
      noise(0.08, 0.3, 500);
    },
    levelup() {
      if (!ok('levelup', 0.2)) return;
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.18, 'triangle', 0.3, null, i * 0.07),
      );
    },
    boss() {
      if (!ok('boss', 0.5)) return;
      tone(60, 0.9, 'sawtooth', 0.5, 40);
      tone(90, 0.9, 'sawtooth', 0.35, 55, 0.05);
      noise(0.6, 0.25, 300);
    },
    bossDown() {
      if (!ok('bossDown', 0.5)) return;
      [880, 660, 440, 330].forEach((f, i) =>
        tone(f, 0.2, 'square', 0.35, null, i * 0.08),
      );
    },
    gameover() {
      if (!ok('gameover', 0.5)) return;
      [400, 320, 240, 160].forEach((f, i) =>
        tone(f, 0.35, 'sawtooth', 0.4, null, i * 0.15),
      );
    },
  };
})();
