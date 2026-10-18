import { useCallback, useEffect, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Autoplay that survives iOS WKWebView: a bare play() right after mount rejects
 * while nothing is buffered, so retry, replay on canplay/loadeddata (wire the
 * returned function to those events) and after the app resumes. Releases the
 * WebKit media player on unmount so later videos are not blocked.
 * Same recipe as ExercisePlayer (warm-up/cool-down had a single silent play()
 * — testers 13. 10. 2026: warm-up video neither autoplays nor reacts to play).
 */
export function useReliableVideoPlayback(
  videoRef: RefObject<HTMLVideoElement>,
  url: string | null,
  paused: boolean,
): () => void {
  const playVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v || !url || paused) return;
    v.muted = true;
    const p = v.play();
    if (p) p.catch(() => {});
  }, [videoRef, url, paused]);

  useEffect(() => {
    if (paused) {
      videoRef.current?.pause();
      return;
    }
    const timers: number[] = [];
    const playWithRetry = () => {
      timers.forEach(id => clearTimeout(id));
      timers.length = 0;
      [0, 300, 1200, 2500, 4000].forEach((delay, i) => {
        timers.push(window.setTimeout(() => {
          const v = videoRef.current;
          if (!v || !v.paused) return;
          if (i >= 3 && v.readyState < 2) { try { v.load(); } catch { /* noop */ } }
          playVideo();
        }, delay));
      });
    };
    playWithRetry();
    const onVisible = () => { if (document.visibilityState === 'visible') playWithRetry(); };
    document.addEventListener('visibilitychange', onVisible);
    let removeResume: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener('resume', playWithRetry).then((h) => { removeResume = () => h.remove(); });
    }
    return () => {
      timers.forEach(id => clearTimeout(id));
      document.removeEventListener('visibilitychange', onVisible);
      removeResume?.();
    };
  }, [paused, url, playVideo, videoRef]);

  // Release the media player when the video changes or the player unmounts.
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* noop */ } }
    };
  }, [url, videoRef]);

  return playVideo;
}
