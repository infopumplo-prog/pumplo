/**
 * Lokální cache videí cviků (nativní platformy).
 *
 * V posilovnách bývá slabý signál a streamované video se seká nebo nejede vůbec.
 * Videa aktivního plánu (typicky ~14 souborů, dohromady jednotky MB) se proto po
 * načtení plánu stáhnou do telefonu přes @capacitor/filesystem a přehrávač pak
 * dostane lokální URL. Na webu se nic nestahuje a vrací se vzdálená URL.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const DIR = 'exercise-videos';

/** Stabilní název souboru z URL (bez závislosti na crypto API webview). */
export const fileNameForUrl = (url: string): string => {
  let h = 2166136261;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const extMatch = /\.(mp4|mov|webm|m4v|png|jpg|jpeg|webp|gif|svg)(\?|$)/i.exec(url);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
  return `${h.toString(16)}.${ext}`;
};

const pathFor = (url: string) => `${DIR}/${fileNameForUrl(url)}`;

export const isNativeVideoCacheAvailable = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/** Paměť URL → lokální src, aby přehrávač nečekal na Filesystem.stat při každém cviku. */
const resolved = new Map<string, string>();
const inFlight = new Map<string, Promise<boolean>>();

const ensureDir = async () => {
  try {
    await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true });
  } catch {
    /* už existuje */
  }
};

/** Je video už v telefonu? Vrátí lokální src (convertFileSrc) nebo null. */
export const getLocalVideoSrc = async (remoteUrl: string | null): Promise<string | null> => {
  if (!remoteUrl || !isNativeVideoCacheAvailable()) return null;
  const hit = resolved.get(remoteUrl);
  if (hit) return hit;
  try {
    const { uri } = await Filesystem.getUri({ path: pathFor(remoteUrl), directory: Directory.Data });
    await Filesystem.stat({ path: pathFor(remoteUrl), directory: Directory.Data });
    const src = Capacitor.convertFileSrc(uri);
    resolved.set(remoteUrl, src);
    return src;
  } catch {
    return null;
  }
};

/**
 * Vrátí URL, kterou má přehrávač použít: lokální, když je video stažené,
 * jinak vzdálenou (a stream jede jako dřív).
 */
export const getPlayableVideoUrl = async (remoteUrl: string | null): Promise<string | null> => {
  if (!remoteUrl) return null;
  return (await getLocalVideoSrc(remoteUrl)) ?? remoteUrl;
};

/** Stáhne jedno video, pokud ještě není v telefonu. Vrací true, když je po skončení dostupné lokálně. */
export const cacheVideo = async (remoteUrl: string): Promise<boolean> => {
  if (!isNativeVideoCacheAvailable()) return false;
  if (await getLocalVideoSrc(remoteUrl)) return true;
  const running = inFlight.get(remoteUrl);
  if (running) return running;
  const job = (async () => {
    try {
      await ensureDir();
      await Filesystem.downloadFile({ url: remoteUrl, path: pathFor(remoteUrl), directory: Directory.Data });
      resolved.delete(remoteUrl);
      return (await getLocalVideoSrc(remoteUrl)) !== null;
    } catch (e) {
      console.warn('[videoCache] download failed', remoteUrl, e);
      return false;
    } finally {
      inFlight.delete(remoteUrl);
    }
  })();
  inFlight.set(remoteUrl, job);
  return job;
};

/**
 * Předstáhne videa (typicky aktivního plánu) — postupně, ne naráz, ať to
 * nezahltí slabé připojení. Offline se tiše nic nestane. Vrací počet lokálně
 * dostupných videí po skončení.
 */
export const prefetchVideos = async (remoteUrls: Array<string | null | undefined>): Promise<number> => {
  if (!isNativeVideoCacheAvailable()) return 0;
  const urls = Array.from(new Set(remoteUrls.filter((u): u is string => Boolean(u))));
  let ok = 0;
  for (const url of urls) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (await getLocalVideoSrc(url)) ok++;
      continue;
    }
    if (await cacheVideo(url)) ok++;
  }
  return ok;
};

/** Stejná cache funguje i pro obrázky (loga posiloven, náhledy) — alias kvůli čitelnosti. */
export const getCachedFileUrl = getPlayableVideoUrl;
export const prefetchFiles = prefetchVideos;
