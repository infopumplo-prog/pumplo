// Workout audio utilities — beeps, countdown, speech
// AudioContext must be unlocked via a user gesture before it can play.

let audioCtx: AudioContext | null = null;
let unlocked = false;

/** Call this from any click/tap handler to unlock audio on mobile */
export const unlockAudio = () => {
  if (unlocked) return;
  try {
    const ctx = getAudioCtx();
    // Play a silent buffer to unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  } catch {
    // Silently ignore
  }
};

/** Auto-unlock on first user interaction anywhere on the page */
const autoUnlockHandler = () => {
  unlockAudio();
  document.removeEventListener('click', autoUnlockHandler);
  document.removeEventListener('touchstart', autoUnlockHandler);
};
document.addEventListener('click', autoUnlockHandler, { passive: true });
document.addEventListener('touchstart', autoUnlockHandler, { passive: true });

const getAudioCtx = (): AudioContext => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

export const playBeep = (frequency: number = 880, durationMs: number = 150) => {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Audio not available
  }
};

export const playFinishSound = () => {
  playBeep(1047, 200);
  setTimeout(() => playBeep(1319, 300), 200);
};

export const speakText = (text: string) => {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel(); // Cancel any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'cs-CZ';
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    speechSynthesis.speak(utterance);
  } catch {
    // Speech not available
  }
};
