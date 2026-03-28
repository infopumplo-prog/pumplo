// Workout audio utilities — beeps, countdown, speech
// Uses HTML Audio element with base64 WAV for maximum mobile compatibility

// Short beep as base64 WAV (440Hz, 100ms)
const BEEP_WAV = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACA' +
  Array(200).fill('f/9/').join('') + 'gICAgA==';

// Higher beep (880Hz) for finish
const HIGH_BEEP_WAV = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACA' +
  Array(200).fill('//8A').join('') + 'gICAgA==';

let beepAudio: HTMLAudioElement | null = null;
let highBeepAudio: HTMLAudioElement | null = null;

// Pre-load on first import
try {
  beepAudio = new Audio(BEEP_WAV);
  beepAudio.volume = 0.5;
  highBeepAudio = new Audio(HIGH_BEEP_WAV);
  highBeepAudio.volume = 0.5;
} catch {
  // Audio not available
}

/** Unlock audio on first user interaction (required by mobile browsers) */
export const unlockAudio = () => {
  try {
    // Play + immediately pause to unlock audio playback
    if (beepAudio) {
      beepAudio.play().then(() => { beepAudio!.pause(); beepAudio!.currentTime = 0; }).catch(() => {});
    }
  } catch {}
};

// Auto-unlock on first user interaction
const autoUnlock = () => {
  unlockAudio();
  document.removeEventListener('click', autoUnlock);
  document.removeEventListener('touchstart', autoUnlock);
};
if (typeof document !== 'undefined') {
  document.addEventListener('click', autoUnlock, { passive: true });
  document.addEventListener('touchstart', autoUnlock, { passive: true });
}

export const playBeep = () => {
  try {
    if (!beepAudio) return;
    beepAudio.currentTime = 0;
    beepAudio.play().catch(() => {});
  } catch {}
};

export const playFinishSound = () => {
  try {
    if (!highBeepAudio) return;
    highBeepAudio.currentTime = 0;
    highBeepAudio.play().catch(() => {});
    // Second beep after 200ms
    setTimeout(() => {
      if (!highBeepAudio) return;
      highBeepAudio.currentTime = 0;
      highBeepAudio.play().catch(() => {});
    }, 250);
  } catch {}
};

export const speakText = (text: string) => {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'cs-CZ';
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    speechSynthesis.speak(utterance);
  } catch {}
};
