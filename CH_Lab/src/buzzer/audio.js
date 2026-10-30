const pentatonic = [261.63, 293.66, 329.63, 392, 440, 523.25, 392, 329.63];

let context = null;
let musicTimer = null;
let clockTimer = null;
let musicGain = null;
let muted = false;
let musicOn = false;
let lastTickSecond = null;

function audioContext() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

function tone(frequency, duration, type, volume, when = 0, throughMusic = false) {
  const ctx = audioContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + when;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(throughMusic && musicGain ? musicGain : ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function setMuted(next) {
  muted = next;
  if (musicGain) musicGain.gain.value = muted || !musicOn ? 0.0001 : 0.07;
}

export function isMuted() {
  return muted;
}

export function startMusic() {
  const ctx = audioContext();
  if (!ctx) return;
  musicOn = true;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = muted ? 0.0001 : 0.07;
    musicGain.connect(ctx.destination);
  } else musicGain.gain.value = muted ? 0.0001 : 0.07;
  if (musicTimer) return;
  let step = 0;
  const playStep = () => {
    if (!musicOn || muted) return;
    const note = pentatonic[step % pentatonic.length];
    tone(note / 2, 1.6, 'sine', 0.22, 0, true);
    if (step % 2 === 0) tone(note, 0.9, 'triangle', 0.12, 0.05, true);
    step += 1;
  };
  playStep();
  musicTimer = window.setInterval(playStep, 1400);
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
  if (musicGain) musicGain.gain.value = 0.0001;
}

export function ringBell() {
  const ctx = audioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  master.connect(ctx.destination);
  [784, 988, 1175].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = 0.4 - index * 0.08;
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 1.05);
  });
}

function tick(urgent) {
  tone(urgent ? 980 : 620, urgent ? 0.09 : 0.07, 'square', urgent ? 0.08 : 0.045);
  window.setTimeout(() => tone(urgent ? 720 : 420, 0.08, 'square', urgent ? 0.06 : 0.03), 90);
}

export function startClock(getRemainingMs) {
  stopClock();
  lastTickSecond = null;
  const pulse = () => {
    const remaining = Math.max(0, Math.ceil(getRemainingMs() / 1000));
    if (remaining === lastTickSecond) return;
    lastTickSecond = remaining;
    if (remaining <= 0) {
      tone(180, 0.35, 'sine', 0.16);
      stopClock();
      return;
    }
    tick(remaining <= 5);
  };
  pulse();
  clockTimer = window.setInterval(pulse, 120);
}

export function stopClock() {
  if (clockTimer) { window.clearInterval(clockTimer); clockTimer = null; }
  lastTickSecond = null;
}
