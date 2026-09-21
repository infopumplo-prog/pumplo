import { Capacitor, registerPlugin } from '@capacitor/core';

// Native rest-timer audio (iOS): plays one composed clip (silence + 3-2-1 + final
// beep) so the alert is heard even backgrounded / phone locked / headphones in,
// and music (Spotify) keeps playing (mixWithOthers). See RestAudioPlugin.swift.
interface RestAudioPlugin {
  start(options: { seconds: number }): Promise<void>;
  stop(): Promise<void>;
  beep(options: { freq: number; ms: number; volume: number }): Promise<void>;
}

const RestAudio = registerPlugin<RestAudioPlugin>('RestAudio');

// Returns true if native took over the beeps (so the JS fallback should stay quiet).
export async function startRestBeeps(seconds: number): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || seconds <= 0) return false;
  try {
    await RestAudio.start({ seconds });
    console.log('[RestAudio] native beeps started for', seconds, 's');
    return true;
  } catch (e) {
    console.warn('[RestAudio] native unavailable, using web fallback:', e);
    return false; // plugin missing / failed → caller falls back to web beeps
  }
}

export async function stopRestBeeps(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestAudio.stop(); } catch { /* noop */ }
}

// Krátké pípnutí nativně (iOS): AVAudioPlayer s .mixWithOthers nepřeruší hudbu,
// zatímco web <audio> ve WKWebView ano. Vrací false, když plugin není k dispozici.
export async function nativeBeep(freq: number, ms: number, volume: number): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'ios') return false;
  try {
    await RestAudio.beep({ freq, ms, volume });
    return true;
  } catch {
    return false; // plugin chybí / AVAudioSession selhal → volající pustí web fallback
  }
}
