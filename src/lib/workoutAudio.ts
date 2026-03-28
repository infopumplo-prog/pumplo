// Workout audio — generates proper WAV beeps as Blob URLs
// Works on iOS Safari, Android Chrome, desktop browsers

function generateWavBeep(frequency: number, durationMs: number, sampleRate = 22050): string {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const dataSize = numSamples;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true);  // block align
  view.setUint16(34, 8, true);  // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate sine wave (8-bit unsigned PCM)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Fade out in last 20%
    const envelope = i > numSamples * 0.8 ? (numSamples - i) / (numSamples * 0.2) : 1;
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.4;
    view.setUint8(44 + i, Math.floor((sample + 1) * 127.5));
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

// Pre-generate beep URLs
let beepUrl: string | null = null;
let highBeepUrl: string | null = null;

try {
  beepUrl = generateWavBeep(660, 150);
  highBeepUrl = generateWavBeep(1047, 200);
} catch {
  // Not in browser
}

// Audio elements — reused for each play
let beepAudio: HTMLAudioElement | null = null;
let highBeepAudio: HTMLAudioElement | null = null;
let unlocked = false;

const ensureAudioElements = () => {
  if (!beepAudio && beepUrl) {
    beepAudio = new Audio(beepUrl);
    beepAudio.volume = 0.6;
  }
  if (!highBeepAudio && highBeepUrl) {
    highBeepAudio = new Audio(highBeepUrl);
    highBeepAudio.volume = 0.6;
  }
};

/** Unlock audio playback — must be called from a user gesture */
export const unlockAudio = () => {
  if (unlocked) return;
  ensureAudioElements();
  try {
    // iOS requires play() from user gesture to unlock
    if (beepAudio) {
      beepAudio.muted = true;
      beepAudio.play().then(() => {
        beepAudio!.pause();
        beepAudio!.muted = false;
        beepAudio!.currentTime = 0;
        unlocked = true;
      }).catch(() => {});
    }
    if (highBeepAudio) {
      highBeepAudio.muted = true;
      highBeepAudio.play().then(() => {
        highBeepAudio!.pause();
        highBeepAudio!.muted = false;
        highBeepAudio!.currentTime = 0;
      }).catch(() => {});
    }
  } catch {}
};

// Auto-unlock on first user interaction
const autoUnlock = () => {
  unlockAudio();
  document.removeEventListener('click', autoUnlock);
  document.removeEventListener('touchstart', autoUnlock);
  document.removeEventListener('touchend', autoUnlock);
};
if (typeof document !== 'undefined') {
  document.addEventListener('click', autoUnlock, { passive: true });
  document.addEventListener('touchstart', autoUnlock, { passive: true });
  document.addEventListener('touchend', autoUnlock, { passive: true });
}

export const playBeep = () => {
  ensureAudioElements();
  try {
    if (!beepAudio) return;
    beepAudio.currentTime = 0;
    beepAudio.play().catch(() => {});
  } catch {}
};

export const playFinishSound = () => {
  ensureAudioElements();
  try {
    if (!highBeepAudio) return;
    highBeepAudio.currentTime = 0;
    highBeepAudio.play().catch(() => {});
    setTimeout(() => {
      if (!highBeepAudio) return;
      highBeepAudio.currentTime = 0;
      highBeepAudio.play().catch(() => {});
    }, 250);
  } catch {}
};

// Find the best Czech voice available on the device
let cachedCzechVoice: SpeechSynthesisVoice | null = null;
let voiceSearchDone = false;

const getCzechVoice = (): SpeechSynthesisVoice | null => {
  if (voiceSearchDone) return cachedCzechVoice;
  if (!('speechSynthesis' in window)) return null;

  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  voiceSearchDone = true;

  const czechVoices = voices.filter(v => v.lang.startsWith('cs'));
  // Prefer premium Czech voices (Zuzana on iOS, enhanced variants)
  cachedCzechVoice =
    czechVoices.find(v => v.name.toLowerCase().includes('zuzana')) ||
    czechVoices.find(v => v.name.toLowerCase().includes('enhanced')) ||
    czechVoices.find(v => v.name.toLowerCase().includes('premium')) ||
    czechVoices.find(v => !v.name.toLowerCase().includes('compact')) ||
    czechVoices[0] || null;

  return cachedCzechVoice;
};

// Pre-load voices
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    voiceSearchDone = false;
    getCzechVoice();
  });
}

export const speakText = (text: string) => {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getCzechVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'cs-CZ';
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    speechSynthesis.speak(utterance);
  } catch {}
};

/** Announce exercise: name, weight, reps */
export const announceExercise = (name: string, weight?: number, reps?: string) => {
  let text = name;
  if (weight && weight > 0) text += `. ${weight} kilo`;
  if (reps) text += `. ${reps} opakování`;
  speakText(text);
};

/** Announce workout complete */
export const announceWorkoutComplete = () => {
  speakText('Trénink dokončen. Skvělá práce!');
};
