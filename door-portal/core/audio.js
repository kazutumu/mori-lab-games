export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.master = null;
    this.filter = null;
    this.windGain = null;
    this.mode = 'gallery';
    this.isNight = false;
    this.chirpTimer = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);

    // Filtered noise for wind / space hum
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.03 * white) / 1.03;
      lastOut = data[i];
      data[i] *= 2.4;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 320;
    this.filter.Q.value = 1.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.16;

    noise.connect(this.filter);
    this.filter.connect(this.windGain);
    this.windGain.connect(this.master);
    noise.start();
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.enabled = !this.enabled;
    this.master.gain.setTargetAtTime(this.enabled ? 0.35 : 0.0, this.ctx.currentTime, 0.25);
    return this.enabled;
  }

  setEnvironment(audioType, hour) {
    this.mode = audioType;
    this.isNight = hour < 5.5 || hour > 19.2;
    if (!this.ctx || !this.filter) return;

    const now = this.ctx.currentTime;
    const presets = {
      gallery: { freq: 180, q: 1.0, gain: 0.04 },
      mountain: { freq: 380, q: 1.8, gain: 0.22 },
      plains: { freq: 290, q: 1.3, gain: 0.24 },
      desert: { freq: 520, q: 2.2, gain: 0.26 },
      jungle: { freq: 260, q: 0.9, gain: 0.14 },
      space: { freq: 95, q: 4.0, gain: 0.12 }
    };
    const p = presets[audioType] || presets.gallery;
    this.filter.frequency.setTargetAtTime(p.freq, now, 0.5);
    this.filter.Q.setTargetAtTime(p.q, now, 0.5);
    this.windGain.gain.setTargetAtTime(p.gain, now, 0.5);
  }

  update(dt) {
    if (!this.enabled || !this.ctx) return;
    if (this.mode === 'gallery' || this.mode === 'space' || this.mode === 'desert') return;

    this.chirpTimer -= dt;
    if (this.chirpTimer <= 0) {
      this.chirpTimer = 1.8 + Math.random() * 3.8;
      this.playNatureTone();
    }
  }

  playNatureTone() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = this.isNight ? 'triangle' : 'sine';

    if (this.isNight) {
      // Soft cricket pulse
      const base = 3600 + Math.random() * 500;
      osc.frequency.setValueAtTime(base, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.025, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(g); g.connect(this.master);
      osc.start(now); osc.stop(now + 0.25);
    } else {
      // Distant bird chirp
      const f1 = 1600 + Math.random() * 900;
      osc.frequency.setValueAtTime(f1, now);
      osc.frequency.exponentialRampToValueAtTime(f1 * 1.35, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(f1 * 0.9, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.03, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(g); g.connect(this.master);
      osc.start(now); osc.stop(now + 0.26);
    }
  }
}
