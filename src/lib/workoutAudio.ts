// Workout audio — pre-recorded Czech MP3 from Supabase Storage
// Single file per announcement = no pauses, smooth playback

const STORAGE_BASE = 'https://udqwjqgdsjobdufdxbpn.supabase.co/storage/v1/object/public/exercise-videos/tts';

// Pre-recorded phrase URLs
const PHRASES = {
  next_exercise: `${STORAGE_BASE}/phrase_next_exercise.mp3`,
  workout_complete: `${STORAGE_BASE}/phrase_workout_complete.mp3`,
  start: `${STORAGE_BASE}/phrase_start.mp3`,
  last_set: `${STORAGE_BASE}/phrase_last_set.mp3`,
};

// MD5 hash to match Python-generated filenames
function md5Hash(str: string): string {
  const data = new TextEncoder().encode(str);
  function md5cycle(x: number[], k: number[]) {
    let a=x[0],b=x[1],c=x[2],d=x[3];
    a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1770035416);d=ff(d,a,b,c,k[9],12,-1958414417);c=ff(c,d,a,b,k[10],17,-42063);b=ff(b,c,d,a,k[11],22,-1990404162);
    a=ff(a,b,c,d,k[12],7,1804603682);d=ff(d,a,b,c,k[13],12,-40341101);c=ff(c,d,a,b,k[14],17,-1502002290);b=ff(b,c,d,a,k[15],22,1236535329);
    a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);
    a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022574463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);
    a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560198380);b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);
    x[0]=add(a,x[0]);x[1]=add(b,x[1]);x[2]=add(c,x[2]);x[3]=add(d,x[3]);
  }
  function cmn(q:number,a:number,b:number,x:number,s:number,t:number){a=add(add(a,q),add(x,t));return add((a<<s)|(a>>>(32-s)),b);}
  function ff(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn((b&c)|((~b)&d),a,b,x,s,t);}
  function gg(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn((b&d)|(c&(~d)),a,b,x,s,t);}
  function hh(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn(b^c^d,a,b,x,s,t);}
  function ii(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn(c^(b|(~d)),a,b,x,s,t);}
  function add(a:number,b:number){return(a+b)&0xFFFFFFFF;}

  const n=data.length;const state=[1732584193,-271733879,-1732584194,271733878];
  let lo=0;
  for(let i=64;i<=n;i+=64){const w:number[]=[];for(let j=i-64;j<i;j+=4)w.push(data[j]|(data[j+1]<<8)|(data[j+2]<<16)|(data[j+3]<<24));md5cycle(state,w);lo=i;}
  const tail=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  for(let i=lo;i<n;i++)tail[(i-lo)>>2]|=data[i]<<(((i-lo)%4)<<3);
  tail[(n-lo)>>2]|=0x80<<(((n-lo)%4)<<3);
  if((n-lo)>55){md5cycle(state,tail);for(let i=0;i<16;i++)tail[i]=0;}
  tail[14]=n*8;md5cycle(state,tail);
  const hex='0123456789abcdef';let r='';
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){const b=(state[i]>>(j*8))&0xFF;r+=hex[b>>4]+hex[b&0xF];}
  return r;
}

function getExerciseAudioUrl(name: string): string {
  return `${STORAGE_BASE}/ex_${md5Hash(name).substring(0, 12)}.mp3`;
}

// --- Silent WAV for MediaSession lock screen support ---
// 60 seconds so the loop resets only every 60s — avoids setPositionState conflicts
let silenceUrl: string|null = null;
try {
  const sr=22050,n=sr*60;const buf=new ArrayBuffer(44+n);const v=new DataView(buf);
  const w=(o:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr,true);v.setUint16(32,1,true);v.setUint16(34,8,true);
  w(36,'data');v.setUint32(40,n,true);
  for(let i=0;i<n;i++)v.setUint8(44+i,128);
  silenceUrl=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
} catch{}

// --- Audio player ---
let audioEl: HTMLAudioElement | null = null;
let silentEl: HTMLAudioElement | null = null; // dedicated element for silent loop (MediaSession)
let unlocked = false;

function play(url: string) {
  if (!audioEl) { audioEl = new Audio(); audioEl.volume = 1.0; }
  audioEl.src = url;
  audioEl.play().catch(() => {});
}

export const unlockAudio = () => {
  if (unlocked) return;
  try {
    // Unlock TTS audio element
    if (!audioEl) { audioEl = new Audio(); audioEl.volume = 1.0; }
    audioEl.src = PHRASES.start;
    audioEl.muted = true;
    audioEl.play().then(() => {
      audioEl!.pause(); audioEl!.muted = false; audioEl!.currentTime = 0;
      unlocked = true;
    }).catch(() => {});
    // Unlock silent loop element in the same gesture — Safari requires this
    if (!silentEl) { silentEl = new Audio(); silentEl.volume = 0.001; silentEl.loop = true; }
    silentEl.src = PHRASES.start; // need a src for Safari to trust the element
    silentEl.muted = true;
    silentEl.play().then(() => {
      silentEl!.pause(); silentEl!.muted = false;
    }).catch(() => {});
    // Unlock speechSynthesis on iOS — first speak() must be in user gesture context.
    // Use a short space utterance and let it complete (don't cancel immediately).
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {}
};

/** Start silent audio loop to keep MediaSession active (lock screen widget) */
export const startSilentLoop = () => {
  if (!silentEl || !silenceUrl) return;
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

const autoUnlock = () => { unlockAudio(); document.removeEventListener('click',autoUnlock); document.removeEventListener('touchstart',autoUnlock); document.removeEventListener('touchend',autoUnlock); };
if (typeof document !== 'undefined') {
  document.addEventListener('click', autoUnlock, { passive: true });
  document.addEventListener('touchstart', autoUnlock, { passive: true });
  document.addEventListener('touchend', autoUnlock, { passive: true });
}

// --- Beep for countdown ---
function generateWavBeep(freq: number, ms: number, sr = 22050): string {
  const n = Math.floor(sr * ms / 1000); const buf = new ArrayBuffer(44+n); const v = new DataView(buf);
  const w = (o:number,s:string) => { for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr,true);v.setUint16(32,1,true);v.setUint16(34,8,true);
  w(36,'data');v.setUint32(40,n,true);
  for(let i=0;i<n;i++){const t=i/sr;const e=i>n*0.8?(n-i)/(n*0.2):1;v.setUint8(44+i,Math.floor((Math.sin(2*Math.PI*freq*t)*e*0.4+1)*127.5));}
  return URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
}
let beepUrl: string|null=null, highBeepUrl: string|null=null;
try { beepUrl=generateWavBeep(660,150); highBeepUrl=generateWavBeep(1047,200); } catch{}


export const playBeep = () => { if(!beepUrl)return; const b=new Audio(beepUrl);b.volume=0.6;b.play().catch(()=>{}); };
export const playFinishSound = () => { if(!highBeepUrl)return; const b=new Audio(highBeepUrl);b.volume=0.6;b.play().catch(()=>{}); };

// --- TTS via Supabase Edge Function (full sentence, one MP3) ---
const TTS_FUNCTION_URL = 'https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/tts';

function speakViaSynthesis(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'cs-CZ';
  utt.rate = 1.0;
  utt.volume = 1.0;
  window.speechSynthesis.speak(utt);
}

async function playTts(text: string) {
  // Prefer speechSynthesis on iOS — it properly releases audio session so music resumes.
  // HTMLAudioElement holds the iOS audio session after playback ends, blocking music resumption.
  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && typeof window !== 'undefined' && window.speechSynthesis) {
    speakViaSynthesis(text);
    return;
  }
  try {
    const resp = await fetch(TTS_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXdqcWdkc2pvYmR1ZmR4YnBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY3NTQsImV4cCI6MjA4Nzk2Mjc1NH0.Ehf4grKfU7flrTbuOXKnH_WRiXVDIp9BjfYif9E4SrY',
      },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) { speakViaSynthesis(text); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    play(url);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch {
    speakViaSynthesis(text);
  }
}

/** Pre-fetch TTS audio and return an Audio element ready to play */
export async function prefetchTts(text: string): Promise<HTMLAudioElement | null> {
  try {
    const resp = await fetch(TTS_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXdqcWdkc2pvYmR1ZmR4YnBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY3NTQsImV4cCI6MjA4Nzk2Mjc1NH0.Ehf4grKfU7flrTbuOXKnH_WRiXVDIp9BjfYif9E4SrY',
      },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;
    // Preload the audio data
    audio.load();
    return audio;
  } catch {
    return null;
  }
}

// --- Announce functions ---

/** Announce exercise: full sentence via TTS edge function */
export const announceExercise = (name: string, weight?: number, reps?: string) => {
  let text = name;
  if (weight && weight > 0) text += `, ${weight} kilo`;
  if (reps) text += `, ${reps} opakování`;
  playTts(text);
};

/** Countdown "3, 2, 1" + next exercise announcement via TTS */
export const announceCountdown = (nextName?: string, nextWeight?: number, nextReps?: string) => {
  let text = '3, 2, 1';
  if (nextName) {
    text += `, ${nextName}`;
    if (nextWeight && nextWeight > 0) text += `, ${nextWeight} kilo`;
    if (nextReps) text += `, ${nextReps} opakování`;
  }
  playTts(text);
};

/** Speak text — for rest timer "Další cvik: X" */
export const speakText = (text: string) => {
  playTts(text);
};

/** Announce workout complete */
export const announceWorkoutComplete = () => {
  playTts('Trénink dokončen, skvělá práce!');
};

/** Announce timed exercise (warmup/cooldown): name + duration in seconds */
export const announceTimedExercise = (name: string, durationSeconds: number) => {
  playTts(`${name}, ${durationSeconds} sekund`);
};
