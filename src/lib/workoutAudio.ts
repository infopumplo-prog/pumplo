// Workout audio — beep patterns only, no TTS, no mute
// Beep pattern at end of rests and cardio:
//   T=3s: 1 short beep (playCountdown3)
//   T=2s: 1 short beep (playCountdown2)
//   T=1s: 1 short beep (playCountdown1)
//   T=0s: 1 long beep  (playAlarmFinish)

// --- Silent WAV for MediaSession lock screen support ---
let silenceUrl: string|null = null;
// eslint-disable-next-line no-empty
try {
  const sr=22050,n=sr*60;const buf=new ArrayBuffer(44+n);const v=new DataView(buf);
  const w=(o:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr,true);v.setUint16(32,1,true);v.setUint16(34,8,true);
  w(36,'data');v.setUint32(40,n,true);
  for(let i=0;i<n;i++)v.setUint8(44+i,128);
  silenceUrl=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
// eslint-disable-next-line no-empty
} catch{}

// --- Audio elements (pre-created once, unlocked during user gesture, reused) ---
// Root cause of "plays only first time": new Audio() in timer callbacks is blocked by
// Chrome Android autoplay policy. Fix: create elements once, unlock all in gesture, reuse.
let silentEl: HTMLAudioElement | null = null;
let beepEl: HTMLAudioElement | null = null;
let alarmBeepEl: HTMLAudioElement | null = null;
let alarmFinishEl: HTMLAudioElement | null = null;
let unlocked = false;

export const unlockAudio = () => {
  if (unlocked) return;
  unlocked = true; // synchronous — prevents re-entry and race conditions
  try {
    if (!beepEl && beepUrl) { beepEl = new Audio(beepUrl); beepEl.volume = 0.6; }
    if (!alarmBeepEl && alarmBeepUrl) { alarmBeepEl = new Audio(alarmBeepUrl); alarmBeepEl.volume = 0.85; }
    if (!alarmFinishEl && alarmFinishUrl) { alarmFinishEl = new Audio(alarmFinishUrl); alarmFinishEl.volume = 0.85; }
    if (!silentEl) { silentEl = new Audio(); }

    // Only start the silent loop — this unlocks the AudioContext for the whole page.
    // Pre-playing beep elements caused an audible click/beep on some Android devices.
    if (silentEl && silenceUrl) {
      silentEl.src = silenceUrl;
      silentEl.loop = true;
      silentEl.volume = 0;
      silentEl.play().catch(() => {});
    }
  // eslint-disable-next-line no-empty
  } catch {}
};

/** Start silent audio loop to keep MediaSession active (lock screen widget) */
export const startSilentLoop = () => {
  if (!silentEl || !silenceUrl) return;
  if (!silentEl.paused) return;
  silentEl.src = silenceUrl;
  silentEl.loop = true;
  silentEl.volume = 0.001;
  silentEl.play().catch(() => {});
};

/** Stop silent audio loop and release iOS audio session so music can resume */
export const stopSilentLoop = () => {
  if (!silentEl) return;
  silentEl.pause();
  silentEl.src = '';
  silentEl.load();
};


// --- Beep generation ---
function generateWavBeep(freq: number, ms: number, sr = 22050): string {
  const n = Math.floor(sr * ms / 1000); const buf = new ArrayBuffer(44+n); const v = new DataView(buf);
  const w = (o:number,s:string) => { for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr,true);v.setUint16(32,1,true);v.setUint16(34,8,true);
  w(36,'data');v.setUint32(40,n,true);
  for(let i=0;i<n;i++){const t=i/sr;const e=i>n*0.8?(n-i)/(n*0.2):1;v.setUint8(44+i,Math.floor((Math.sin(2*Math.PI*freq*t)*e*0.4+1)*127.5));}
  return URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
}
let beepUrl: string|null=null;
let alarmBeepUrl: string|null=null, alarmFinishUrl: string|null=null;
// eslint-disable-next-line no-empty
try {
  beepUrl=generateWavBeep(660,150);
  alarmBeepUrl=generateWavBeep(880,120); alarmFinishUrl=generateWavBeep(1175,500);
// eslint-disable-next-line no-empty
} catch{}

/** Single short beep — for set completion */
export const playBeep = () => {
  if (!beepEl && beepUrl) { beepEl = new Audio(beepUrl); beepEl.volume = 0.6; }
  if (!beepEl) return;
  beepEl.currentTime = 0; beepEl.play().catch(() => {});
};

function _playAlarmBeep() {
  if (!alarmBeepEl && alarmBeepUrl) { alarmBeepEl = new Audio(alarmBeepUrl); alarmBeepEl.volume = 0.85; }
  if (!alarmBeepEl) return;
  alarmBeepEl.currentTime = 0; alarmBeepEl.play().catch(() => {});
}

/** Long beep — signals end of rest or cardio (T=0) */
export const playAlarmFinish = () => {
  if (!alarmFinishEl && alarmFinishUrl) { alarmFinishEl = new Audio(alarmFinishUrl); alarmFinishEl.volume = 0.85; }
  if (!alarmFinishEl) return;
  alarmFinishEl.currentTime = 0; alarmFinishEl.play().catch(() => {});
};

/** 1 short beep — play at T=3s remaining */
export const playCountdown3 = () => _playAlarmBeep();

/** 1 short beep — play at T=2s remaining */
export const playCountdown2 = () => _playAlarmBeep();

/** 1 short beep — play at T=1s remaining */
export const playCountdown1 = () => _playAlarmBeep();

/** Long beep — signals workout completion */
export const announceWorkoutComplete = () => playAlarmFinish();
