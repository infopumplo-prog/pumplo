import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

// Komprese videa vlastního cviku před uploadem (nativní plugin VideoCompress:
// iOS AVAssetExportSession 1280×720, Android Transcoder/MediaCodec). Motorola
// natáčí ~15 MB za pár sekund, po kompresi ~2 MB → upload v řádu sekund.
// Na webu nebo při selhání pluginu se vrátí původní soubor.
interface VideoCompressPlugin {
  compress(options: { path: string; maxHeight?: number; bitrate?: number }): Promise<{ path: string; size: number }>;
}

const VideoCompress = registerPlugin<VideoCompressPlugin>('VideoCompress');

const MAX_HEIGHT = 720;
const BITRATE = 2_000_000;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const s = String(r.result || '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.readAsDataURL(file);
  });
}

export async function compressVideoFile(file: File): Promise<File> {
  if (!Capacitor.isNativePlatform()) return file;
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const inName = `compress-in-${Date.now()}.${ext}`;
  let outPath: string | null = null;
  try {
    await Filesystem.writeFile({ path: inName, data: await fileToBase64(file), directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: inName, directory: Directory.Cache });
    const res = await VideoCompress.compress({ path: uri, maxHeight: MAX_HEIGHT, bitrate: BITRATE });
    outPath = res.path;
    const blob = await (await fetch(Capacitor.convertFileSrc(res.path))).blob();
    if (!blob.size || blob.size >= file.size) return file; // komprese nepomohla → originál
    console.log('[videoCompress]', Math.round(file.size / 1024), 'KB →', Math.round(blob.size / 1024), 'KB');
    return new File([blob], 'video.mp4', { type: 'video/mp4' });
  } catch (e) {
    console.warn('[videoCompress] fallback to original:', e);
    return file;
  } finally {
    Filesystem.deleteFile({ path: inName, directory: Directory.Cache }).catch(() => {});
    if (outPath) {
      const name = outPath.split('/').pop() || '';
      Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => {});
    }
  }
}
