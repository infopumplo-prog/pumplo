// Workout audio — uses Google Translate TTS for smooth Czech announcements
// Audio elements bypass CORS, so we can use Google TTS URLs directly

const TTS_BASE = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=cs&client=tw-ob&q=';

// Pre-recorded phrases from Supabase Storage (fallback)
const STORAGE_BASE = 'https://udqwjqgdsjobdufdxbpn.supabase.co/storage/v1/object/public/exercise-videos/tts';

// Audio player
let currentAudio: HTMLAudioElement | null = null;
let unlocked = false;

function getTtsUrl(text: string): string {
  return TTS_BASE + encodeURIComponent(text);
}

function playAudio(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!currentAudio) {
      currentAudio = new Audio();
      currentAudio.volume = 1.0;
    }
    currentAudio.src = url;
    currentAudio.onended = () => resolve();
    currentAudio.onerror = () => resolve();
    currentAudio.play().catch(() => resolve());
  });
}

/** Unlock audio — call from user gesture */
export const unlockAudio = () => {
  if (unlocked) return;
  try {
    if (!currentAudio) {
      currentAudio = new Audio();
      currentAudio.volume = 1.0;
    }
    currentAudio.src = `${STORAGE_BASE}/phrase_rest.mp3`;
    currentAudio.muted = true;
    currentAudio.play().then(() => {
      currentAudio!.pause();
      currentAudio!.muted = false;
      currentAudio!.currentTime = 0;
      unlocked = true;
    }).catch(() => {});
  } catch {}
};

// Auto-unlock on first interaction
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

// --- WAV beep for countdown ---
function generateWavBeep(frequency: number, durationMs: number, sampleRate = 22050): string {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + numSamples, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true); w(36, 'data');
  view.setUint32(40, numSamples, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = i > numSamples * 0.8 ? (numSamples - i) / (numSamples * 0.2) : 1;
    view.setUint8(44 + i, Math.floor((Math.sin(2 * Math.PI * frequency * t) * env * 0.4 + 1) * 127.5));
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

let beepUrl: string | null = null;
let highBeepUrl: string | null = null;
try {
  beepUrl = generateWavBeep(660, 150);
  highBeepUrl = generateWavBeep(1047, 200);
} catch {}

export const playBeep = () => {
  if (!beepUrl) return;
  const beep = new Audio(beepUrl);
  beep.volume = 0.6;
  beep.play().catch(() => {});
};

export const playFinishSound = () => {
  if (!highBeepUrl) return;
  const beep = new Audio(highBeepUrl);
  beep.volume = 0.6;
  beep.play().catch(() => {});
};

// --- Announce functions ---

/** Announce exercise: single smooth sentence */
export const announceExercise = (name: string, weight?: number, reps?: string) => {
  let text = name;
  if (weight && weight > 0) text += `, ${weight} kilo`;
  if (reps) text += `, ${reps} opakování`;
  playAudio(getTtsUrl(text));
};

/** Speak any text as one smooth audio clip */
export const speakText = (text: string) => {
  playAudio(getTtsUrl(text));
};

/** Announce workout complete */
export const announceWorkoutComplete = () => {
  playAudio(getTtsUrl('Trénink dokončen, skvělá práce!'));
};
