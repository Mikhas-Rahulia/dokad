/**
 * Native Platform Capabilities & 0-overhead Web Audio Synthesizer
 * Provides 100% native app feel:
 * - Screen Wake Lock API (keeps screen awake during walks)
 * - App Badging API (shows remaining spots on app icon)
 * - Native Web Share API (share photo / streak to Instagram/WhatsApp/Photos)
 * - View Transitions API (buttery smooth state morphing)
 * - Zero-asset Web Audio API 8-bit retro sound effects (0 KB bandwidth)
 */

class NativePlatform {
  constructor() {
    this.wakeLockSentinel = null;
    this.wakeLockActive = false;
    this.audioCtx = null;
    this.soundEnabled = true;
    this.initVisibilityListener();
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. SCREEN WAKE LOCK API — Keeps screen active while walking
  // ═══════════════════════════════════════════════════════════════
  async requestWakeLock() {
    this.wakeLockActive = true;
    if ('wakeLock' in navigator) {
      try {
        if (!this.wakeLockSentinel || this.wakeLockSentinel.released) {
          this.wakeLockSentinel = await navigator.wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockSentinel = null;
          });
        }
      } catch (err) {
        // WakeLock can fail if battery saver is active or tab not active
      }
    }
  }

  releaseWakeLock() {
    this.wakeLockActive = false;
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release().catch(() => {});
      this.wakeLockSentinel = null;
    }
  }

  initVisibilityListener() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        if (this.wakeLockActive) {
          await this.requestWakeLock();
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. APP BADGING API — Shows remaining spots on OS home icon
  // ═══════════════════════════════════════════════════════════════
  setAppBadge(count) {
    if ('setAppBadge' in navigator) {
      try {
        if (count > 0) {
          navigator.setAppBadge(count).catch(() => {});
        } else {
          navigator.clearAppBadge().catch(() => {});
        }
      } catch {}
    }
  }

  clearAppBadge() {
    if ('clearAppBadge' in navigator) {
      try {
        navigator.clearAppBadge().catch(() => {});
      } catch {}
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. NATIVE WEB SHARE API — Native OS share sheet
  // ═══════════════════════════════════════════════════════════════
  async shareContent({ title, text, url, photoDataUrl }) {
    if (!navigator.share) return false;

    try {
      if (photoDataUrl && navigator.canShare) {
        const blob = await (await fetch(photoDataUrl)).blob();
        const file = new File([blob], 'dokad_spot.jpg', { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: title || 'Dokąd? Walk',
            text: text || 'I visited a secret spot today! 🔥',
            files: [file]
          });
          return true;
        }
      }

      await navigator.share({
        title: title || 'Dokąd?',
        text: text || 'Explore 3 secret spots in a 1.5 km square!',
        url: url || window.location.href
      });
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native share failed:', err);
      }
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. VIEW TRANSITIONS API — Seamless UI state transitions
  // ═══════════════════════════════════════════════════════════════
  transition(callback) {
    if ('startViewTransition' in document) {
      return document.startViewTransition(callback);
    }
    callback();
    return Promise.resolve();
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. WEB AUDIO API SYNTHESIZER — Zero asset 8-bit sound effects
  // ═══════════════════════════════════════════════════════════════
  getAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  playBlip() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  playCoin() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Note 1: B5 (987.77 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      // Note 2: E6 (1318.51 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.08);
      gain2.gain.setValueAtTime(0.14, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch {}
  }

  playVictory() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.12, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.22);
      });
    } catch {}
  }

  playShutter() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Quick click-clack noise burst
      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(now);
    } catch {}
  }

  playError() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(110, now + 0.08);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }
}

export const nativePlatform = new NativePlatform();
