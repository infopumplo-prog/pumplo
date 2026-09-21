// Workout audio — beep patterns + mute support
// Uses HTMLAudioElement (no AudioContext/decodeAudioData) to avoid
// WebKit libpas heap crashes on iOS 26.
// On iOS native the beeps go through RestAudioPlugin (AVAudioPlayer, .mixWithOthers):
// a web <audio> element in WKWebView grabs a non-mixing audio session and pauses
// Spotify/Apple Music — that was the "music stops when I start a workout" bug.
import { Capacitor } from '@capacitor/core';
import { nativeBeep } from './restAudioNative';

const isIosNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// --- Mute state ---
let _muted = false;
export const setAudioMuted = (muted: boolean) => { _muted = muted; };
export const isAudioMuted = () => _muted;

// --- WAV generation (runs at module load, before any user gesture) ---
function generateWavBlob(freq: number, ms: number, sr = 22050): string | null {
  try {
    const n = Math.floor(sr * ms / 1000);
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const e = i > n * 0.8 ? (n - i) / (n * 0.2) : 1;
      v.setUint8(44 + i, Math.floor((Math.sin(2 * Math.PI * freq * t) * e * 0.4 + 1) * 127.5));
    }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  } catch { return null; }
}

const TONES: Record<string, { freq: number; ms: number }> = {};
const beepUrl = generateWavBlob(660, 150);
const alarmBeepUrl = generateWavBlob(880, 120);
const alarmFinishUrl = generateWavBlob(1175, 500);
if (beepUrl) TONES[beepUrl] = { freq: 660, ms: 150 };
if (alarmBeepUrl) TONES[alarmBeepUrl] = { freq: 880, ms: 120 };
if (alarmFinishUrl) TONES[alarmFinishUrl] = { freq: 1175, ms: 500 };

let unlocked = false;

// Must be called on first user gesture so iOS allows audio playback
export const unlockAudio = () => {
  if (unlocked) return;
  unlocked = true;
  // Warm up by creating a silent audio element — lets iOS allow future HTMLAudioElement plays
  // without interrupting background music (short, immediate, then discarded)
  if (isIosNative) return; // native beeps need no WebKit unlock
  try {
    const warm = new Audio(beepUrl ?? '');
    warm.muted = true; // volume=0 is still "audible" for WebKit and interrupts background music
    warm.volume = 0;
    warm.play().catch(() => {}).finally(() => { warm.src = ''; });
  } catch {}
};

// --- Playback: each beep gets its own short-lived Audio element ---
function playUrl(url: string | null, volume: number) {
  if (_muted || !url || !unlocked) return;
  if (isIosNative) {
    const tone = TONES[url];
    if (tone && nativeBeep(tone.freq, tone.ms, volume)) return;
  }
  try {
    const a = new Audio(url);
    a.volume = volume;
    a.play().catch(() => {});
  } catch {}
}

export const playBeep        = () => playUrl(beepUrl, 0.6);
export const playAlarmFinish = () => playUrl(alarmFinishUrl, 0.85);
export const playCountdown3  = () => playUrl(alarmBeepUrl, 0.85);
export const playCountdown2  = () => playUrl(alarmBeepUrl, 0.85);
export const playCountdown1  = () => playUrl(alarmBeepUrl, 0.85);
export const announceWorkoutComplete = () => playUrl(alarmFinishUrl, 0.85);
