// Every sound in Coral Bay is synthesised with WebAudio — oscillators and filtered noise, no
// audio files: a two-stroke engine whose pitch follows the car's speed, a two-tone siren that
// swells as a police car closes in, gunshots, punches, cash and the little jingles that frame a
// mission. The context wakes on the first user gesture, as browsers require; until then (and in
// screenshot scenes) every call is a quiet no-op.

/** Create the sound kit. All functions are safe to call before the context exists. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = 0;
  let muted = false;

  function wake() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.3, freq = 1200, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  return {
    wake,
    /** Toggle the master mute (the M key). Returns the new muted state. */
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    /** A UI click for menus. */
    click() { tone(660, 0.06, 'square', 0.08); },
    /** A punch landing: a short low thump. */
    punch() { noise(0.09, 0.35, 500); tone(120, 0.09, 'sine', 0.3, 60); },
    /** A pistol shot: a crack of noise over a falling square blip. */
    shot() { noise(0.14, 0.5, 2600); tone(220, 0.1, 'square', 0.18, 55); },
    /** A dry click when the gun is empty. */
    dryFire() { tone(1400, 0.03, 'square', 0.06); },
    /** Glass and metal: a car crash, louder with the impact. */
    crash(strength) {
      const v = Math.min(0.6, 0.15 + strength * 0.05);
      noise(0.22, v, 900);
      tone(90, 0.2, 'triangle', v * 0.7, 40);
    },
    /** Cash changing hands: two bright blips. */
    cash() { tone(880, 0.09, 'sine', 0.16); tone(1318, 0.14, 'sine', 0.16, null, 0.08); },
    /** Stepping into a car: a door thunk. */
    door() { tone(140, 0.08, 'sine', 0.25, 70); noise(0.05, 0.12, 700); },
    /** Mission complete: a rising three-note jingle. */
    jingle() {
      tone(523, 0.14, 'triangle', 0.2);
      tone(659, 0.14, 'triangle', 0.2, null, 0.12);
      tone(784, 0.26, 'triangle', 0.22, null, 0.24);
    },
    /** Busted or wasted: a falling two-note sting. */
    sting() {
      tone(392, 0.2, 'triangle', 0.2);
      tone(262, 0.42, 'triangle', 0.2, null, 0.18);
    },
    /**
     * The continuous sounds, called once a frame: engine pitch from the driven car's speed
     * (0 when on foot), siren volume from the nearest police car's distance (0 when none).
     */
    update(dt, engineSpeed, sirenDistance) {
      if (!ctx) return;
      if (engineSpeed > 0.01) {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          engineOsc.connect(filter).connect(engineGain).connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + engineSpeed * 165;
        engineGain.gain.value = 0.05 + engineSpeed * 0.05;
      } else if (engineGain) {
        engineGain.gain.value = 0;
      }
      if (sirenDistance < 700) {
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenOsc.type = 'triangle';
          sirenGain.gain.value = 0;
          sirenOsc.connect(sirenGain).connect(master);
          sirenOsc.start();
        }
        sirenFlip += dt;
        if (sirenFlip > 0.42) {
          sirenFlip = 0;
          sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 950;
        }
        sirenGain.gain.value = 0.055 * (1 - sirenDistance / 700);
      } else if (sirenGain) {
        sirenGain.gain.value = 0;
      }
    },
  };
}
