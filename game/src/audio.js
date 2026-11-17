// Every sound is synthesised live with WebAudio — no audio files, no
// network. Short oscillator/noise bursts for the effects, plus a quiet
// two-oscillator ambient drone that starts on the first user gesture.
// Everything is guarded: with no AudioContext (headless screenshots) every
// call is a silent no-op.

export function createAudio() {
  let ctx = null;
  let master = null;
  let drone = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ type = 'sine', from = 440, to = null, dur = 0.15, vol = 0.2, when = 0 }) {
    if (!ensure()) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // A sound must never break the game.
    }
  }

  function noise({ dur = 0.2, vol = 0.2, from = 1200, to = 200, when = 0 }) {
    if (!ensure()) return;
    try {
      const t0 = ctx.currentTime + when;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(from, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(t0);
    } catch {
      // A sound must never break the game.
    }
  }

  return {
    /** Call from a user gesture; resumes a suspended context and starts the drone. */
    unlock() {
      if (!ensure()) return;
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        if (!drone) {
          const gain = ctx.createGain();
          gain.gain.value = 0.035;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 320;
          const o1 = ctx.createOscillator();
          o1.type = 'sine';
          o1.frequency.value = 55;
          const o2 = ctx.createOscillator();
          o2.type = 'sine';
          o2.frequency.value = 55.6;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.07;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.015;
          lfo.connect(lfoGain);
          lfoGain.connect(gain.gain);
          o1.connect(filter);
          o2.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          o1.start();
          o2.start();
          lfo.start();
          drone = true;
        }
      } catch {
        // Silence is acceptable; the game is not.
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone({ type: 'square', from: 720, to: 240, dur: 0.09, vol: 0.1 });
      noise({ dur: 0.06, vol: 0.06, from: 2600, to: 900 });
    },
    pickup() {
      tone({ type: 'sine', from: 880, to: 1320, dur: 0.12, vol: 0.14 });
    },
    kill() {
      noise({ dur: 0.18, vol: 0.16, from: 900, to: 140 });
      tone({ type: 'triangle', from: 320, to: 70, dur: 0.18, vol: 0.14 });
    },
    hurt() {
      tone({ type: 'sawtooth', from: 180, to: 55, dur: 0.3, vol: 0.22 });
      noise({ dur: 0.2, vol: 0.12, from: 500, to: 120 });
    },
    dash() {
      noise({ dur: 0.22, vol: 0.12, from: 500, to: 2400 });
    },
    click() {
      tone({ type: 'sine', from: 660, to: 520, dur: 0.06, vol: 0.1 });
    },
    waveClear() {
      tone({ type: 'sine', from: 523, to: 523, dur: 0.12, vol: 0.14 });
      tone({ type: 'sine', from: 784, to: 784, dur: 0.18, vol: 0.14, when: 0.1 });
    },
    horn() {
      tone({ type: 'sawtooth', from: 98, to: 98, dur: 0.55, vol: 0.12 });
      tone({ type: 'sawtooth', from: 147, to: 147, dur: 0.55, vol: 0.1 });
      tone({ type: 'sawtooth', from: 196, to: 196, dur: 0.4, vol: 0.07, when: 0.08 });
    },
    bossRoar() {
      tone({ type: 'sawtooth', from: 70, to: 38, dur: 0.8, vol: 0.2 });
      noise({ dur: 0.6, vol: 0.1, from: 300, to: 90 });
    },
    death() {
      tone({ type: 'sawtooth', from: 220, to: 40, dur: 1.1, vol: 0.2 });
      tone({ type: 'sine', from: 110, to: 30, dur: 1.2, vol: 0.16, when: 0.1 });
    },
    victory() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => tone({ type: 'sine', from: f, to: f, dur: 0.35, vol: 0.14, when: i * 0.14 }));
    },
  };
}
