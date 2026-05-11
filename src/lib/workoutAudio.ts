// Workout audio — beep patterns + mute support
// Beep pattern at end of rests and cardio:
//   T=3s: 1 short beep (playCountdown3)
//   T=2s: 1 short beep (playCountdown2)
//   T=1s: 1 short beep (playCountdown1)
//   T=0s: 1 long beep  (playAlarmFinish)
//
// AudioContext is used for all beeps. No HTMLAudioElement is created so that
// WKWebView never changes the AVAudioSession away from .mixWithOthers.

// --- Mute state ---
let _muted = false;
export const setAudioMuted = (muted: boolean) => { _muted = muted; };
export const isAudioMuted = () => _muted;

// --- Web Audio API context + buffers ---
let audioCtx: AudioContext | null = null;
let beepBuffer: AudioBuffer | null = null;
let alarmBeepBuffer: AudioBuffer | null = null;
let alarmFinishBuffer: AudioBuffer | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

async function decodeWavUrl(url: string): Promise<AudioBuffer | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  } catch { return null; }
}

// --- Beep WAV generation ---
function generateWavBeep(freq: number, ms: number, sr = 22050): string {
  const n = Math.floor(sr * ms / 1000); const buf = new ArrayBuffer(44 + n); const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) { const t = i / sr; const e = i > n * 0.8 ? (n - i) / (n * 0.2) : 1; v.setUint8(44 + i, Math.floor((Math.sin(2 * Math.PI * freq * t) * e * 0.4 + 1) * 127.5)); }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let beepUrl: string | null = null;
let alarmBeepUrl: string | null = null;
let alarmFinishUrl: string | null = null;
// eslint-disable-next-line no-empty
try {
  beepUrl = generateWavBeep(660, 150);
  alarmBeepUrl = generateWavBeep(880, 120);
  alarmFinishUrl = generateWavBeep(1175, 500);
// eslint-disable-next-line no-empty
} catch {}

// --- Unlock + decode all buffers on first user gesture ---
export const unlockAudio = () => {
  if (unlocked) return;
  unlocked = true;

  // Start AudioContext (must happen in user gesture)
  const ctx = getCtx();
  if (!ctx) return;

  // Decode WAV blobs in series — parallel decodeAudioData calls can crash WebKit libpas
  (async () => {
    if (beepUrl) beepBuffer = await decodeWavUrl(beepUrl);
    if (alarmBeepUrl) alarmBeepBuffer = await decodeWavUrl(alarmBeepUrl);
    if (alarmFinishUrl) alarmFinishBuffer = await decodeWavUrl(alarmFinishUrl);
  })();
};

// --- Core playback via AudioContext (mixes with Spotify, no session takeover) ---
function playAudioBuffer(buffer: AudioBuffer | null, volume: number) {
  if (_muted || !buffer) return;
  const ctx = getCtx();
  if (!ctx) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
}

/** Single short beep — for set completion */
export const playBeep = () => playAudioBuffer(beepBuffer, 0.6);

/** Long beep — signals end of rest or cardio (T=0) */
export const playAlarmFinish = () => playAudioBuffer(alarmFinishBuffer, 0.85);

function _playAlarmBeep() { playAudioBuffer(alarmBeepBuffer, 0.85); }

/** 1 short beep — play at T=3s remaining */
export const playCountdown3 = () => _playAlarmBeep();

/** 1 short beep — play at T=2s remaining */
export const playCountdown2 = () => _playAlarmBeep();

/** 1 short beep — play at T=1s remaining */
export const playCountdown1 = () => _playAlarmBeep();

/** Long beep — signals workout completion */
export const announceWorkoutComplete = () => playAlarmFinish();
