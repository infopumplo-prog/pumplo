import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = {
  files: new Set<string>(),
  downloads: [] as string[],
  failNext: false,
};

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native,
    convertFileSrc: (uri: string) => `capacitor://localhost/_capacitor_file_${uri}`,
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: {
    mkdir: async () => undefined,
    getUri: async ({ path }: { path: string }) => ({ uri: `/data/${path}` }),
    stat: async ({ path }: { path: string }) => {
      if (!fs.files.has(path)) throw new Error('ENOENT');
      return { type: 'file', size: 1 };
    },
    downloadFile: async ({ url, path }: { url: string; path: string }) => {
      fs.downloads.push(url);
      if (fs.failNext) { fs.failNext = false; throw new Error('network'); }
      fs.files.add(path);
      return { path };
    },
  },
}));

let native = true;

const load = async () => {
  vi.resetModules();
  return import('./videoCache');
};

beforeEach(() => {
  fs.files.clear();
  fs.downloads.length = 0;
  fs.failNext = false;
  native = true;
  setOnline(true);
});

function setOnline(onLine: boolean) {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine }, configurable: true, writable: true });
}

const URL_A = 'https://x.supabase.co/storage/v1/object/public/exercise-videos/a/1.mp4';
const URL_B = 'https://x.supabase.co/storage/v1/object/public/exercise-videos/b/2.mp4';

describe('video cache', () => {
  it('nestažené video → přehrávač dostane vzdálenou URL', async () => {
    const m = await load();
    expect(await m.getPlayableVideoUrl(URL_A)).toBe(URL_A);
  });

  it('stažené video → přehrávač dostane lokální src z telefonu', async () => {
    const m = await load();
    expect(await m.cacheVideo(URL_A)).toBe(true);
    const src = await m.getPlayableVideoUrl(URL_A);
    expect(src).toMatch(/^capacitor:\/\/localhost\/_capacitor_file_\/data\/exercise-videos\//);
    expect(src).not.toBe(URL_A);
  });

  it('prefetch stáhne každé video jen jednou a duplicity v seznamu ignoruje', async () => {
    const m = await load();
    expect(await m.prefetchVideos([URL_A, URL_B, URL_A, null, undefined])).toBe(2);
    expect(await m.prefetchVideos([URL_A, URL_B])).toBe(2);
    expect(fs.downloads).toEqual([URL_A, URL_B]);
  });

  it('selhání stahování nic nerozbije — vrátí vzdálenou URL a příště to zkusí znovu', async () => {
    const m = await load();
    fs.failNext = true;
    expect(await m.cacheVideo(URL_A)).toBe(false);
    expect(await m.getPlayableVideoUrl(URL_A)).toBe(URL_A);
    expect(await m.cacheVideo(URL_A)).toBe(true);
  });

  it('mimo nativní platformu se nic nestahuje a vrací se vzdálená URL', async () => {
    native = false;
    const m = await load();
    expect(await m.prefetchVideos([URL_A])).toBe(0);
    expect(fs.downloads).toEqual([]);
    expect(await m.getPlayableVideoUrl(URL_A)).toBe(URL_A);
  });

  it('offline prefetch nevolá síť, jen spočítá, co už v telefonu je', async () => {
    const m = await load();
    await m.cacheVideo(URL_A);
    setOnline(false);
    expect(await m.prefetchVideos([URL_A, URL_B])).toBe(1);
    expect(fs.downloads).toEqual([URL_A]);
  });
});
