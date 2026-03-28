// Workout audio — uses pre-generated MP3 files from Supabase Storage
// Works on all devices (iOS, Android, desktop)

// No external dependencies — MD5 hash inline, audio from Supabase Storage

const STORAGE_BASE = 'https://udqwjqgdsjobdufdxbpn.supabase.co/storage/v1/object/public/exercise-videos/tts';

// Phrase audio URLs
const PHRASES: Record<string, string> = {
  next_exercise: `${STORAGE_BASE}/phrase_next_exercise.mp3`,
  workout_complete: `${STORAGE_BASE}/phrase_workout_complete.mp3`,
  set_complete: `${STORAGE_BASE}/phrase_set_complete.mp3`,
  rest: `${STORAGE_BASE}/phrase_rest.mp3`,
  start: `${STORAGE_BASE}/phrase_start.mp3`,
  last_set: `${STORAGE_BASE}/phrase_last_set.mp3`,
  reps: `${STORAGE_BASE}/phrase_reps.mp3`,
  kilo: `${STORAGE_BASE}/phrase_kilo.mp3`,
};

// Number audio (1-10)
const NUMBERS: Record<number, string> = {};
for (let i = 1; i <= 10; i++) {
  NUMBERS[i] = `${STORAGE_BASE}/phrase_${i}.mp3`;
}

// Audio player — reuses a single Audio element for sequential playback
let currentAudio: HTMLAudioElement | null = null;
let audioQueue: string[] = [];
let isPlaying = false;
let unlocked = false;

function playNext() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }
  isPlaying = true;
  const url = audioQueue.shift()!;

  if (!currentAudio) {
    currentAudio = new Audio();
    currentAudio.volume = 1.0;
  }
  currentAudio.src = url;
  currentAudio.onended = playNext;
  currentAudio.onerror = playNext; // Skip on error
  currentAudio.play().catch(() => playNext());
}

function queueAudio(url: string) {
  audioQueue.push(url);
  if (!isPlaying) playNext();
}

function playImmediately(url: string) {
  // Clear queue and play this now
  audioQueue = [];
  if (!currentAudio) {
    currentAudio = new Audio();
    currentAudio.volume = 1.0;
  }
  currentAudio.src = url;
  currentAudio.onended = () => { isPlaying = false; };
  currentAudio.onerror = () => { isPlaying = false; };
  isPlaying = true;
  currentAudio.play().catch(() => { isPlaying = false; });
}

/** Unlock audio — call from user gesture */
export const unlockAudio = () => {
  if (unlocked) return;
  try {
    if (!currentAudio) {
      currentAudio = new Audio();
      currentAudio.volume = 1.0;
    }
    // iOS requires play() from user gesture
    currentAudio.src = PHRASES.rest; // Tiny preload
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

// --- WAV beep for countdown (generated in-browser, always works) ---
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
  playImmediately(beepUrl);
};

export const playFinishSound = () => {
  if (!highBeepUrl) return;
  playImmediately(highBeepUrl);
};

// --- High-level announce functions ---

/** Get audio URL for an exercise name */
export const getExerciseAudioUrl = (name: string): string => {
  const hash = simpleHash(name);
  return `${STORAGE_BASE}/ex_${hash}.mp3`;
};

/** Simple MD5-like hash matching the generation script */
function simpleHash(text: string): string {
  // Must match: hashlib.md5(name.encode()).hexdigest()[:12]
  // We'll use a JS implementation
  return md5Hash(text).substring(0, 12);
}

// Minimal MD5 for hash matching
function md5Hash(str: string): string {
  // Use the same approach as Python's hashlib.md5
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  function md5cycle(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function add32(a: number, b: number) { return (a + b) & 0xFFFFFFFF; }

  const n = data.length;
  let state = [1732584193, -271733879, -1732584194, 271733878];
  let tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  let lo = 0;

  for (let i = 64; i <= n; i += 64) {
    const w: number[] = [];
    for (let j = i - 64; j < i; j += 4) {
      w.push(data[j] | (data[j+1] << 8) | (data[j+2] << 16) | (data[j+3] << 24));
    }
    md5cycle(state, w);
    lo = i;
  }

  for (let i = 0; i < 16; i++) tail[i] = 0;
  for (let i = lo; i < n; i++) {
    tail[(i - lo) >> 2] |= data[i] << (((i - lo) % 4) << 3);
  }
  tail[(n - lo) >> 2] |= 0x80 << (((n - lo) % 4) << 3);
  if ((n - lo) > 55) {
    md5cycle(state, tail);
    for (let i = 0; i < 16; i++) tail[i] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);

  const hex = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const byte = (state[i] >> (j * 8)) & 0xFF;
      result += hex[byte >> 4] + hex[byte & 0xF];
    }
  }
  return result;
}

/** Announce exercise with pre-recorded audio: name, then weight, then reps */
export const announceExercise = (name: string, weight?: number, reps?: string) => {
  audioQueue = [];
  // Exercise name
  queueAudio(getExerciseAudioUrl(name));
  // Weight
  if (weight && weight > 0 && NUMBERS[Math.round(weight)]) {
    queueAudio(NUMBERS[Math.round(weight)]);
    queueAudio(PHRASES.kilo);
  }
  // Reps
  const repNum = reps ? parseInt(reps) : 0;
  if (repNum > 0 && NUMBERS[repNum]) {
    queueAudio(NUMBERS[repNum]);
    queueAudio(PHRASES.reps);
  }
};

/** Announce next exercise during rest */
export const speakText = (text: string) => {
  // For backward compatibility - try to match a phrase
  if (text.includes('Další cvik:') || text.includes('Další:')) {
    queueAudio(PHRASES.next_exercise);
    // Extract exercise name and play its audio
    const match = text.match(/(?:Další cvik:|Další:)\s*(.+)/);
    if (match) {
      queueAudio(getExerciseAudioUrl(match[1].trim()));
    }
  } else {
    // Fallback to speechSynthesis for unknown text
    try {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'cs-CZ';
      utterance.rate = 0.95;
      utterance.volume = 1.0;
      speechSynthesis.speak(utterance);
    } catch {}
  }
};

/** Announce workout complete */
export const announceWorkoutComplete = () => {
  audioQueue = [];
  queueAudio(PHRASES.workout_complete);
};
