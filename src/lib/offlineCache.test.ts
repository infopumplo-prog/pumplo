import { beforeEach, describe, expect, it } from 'vitest';
import {
  CACHE_MAX_AGE_MS,
  cacheKey,
  clearUserCache,
  readCache,
  resolveWithCache,
  withNetworkTimeout,
  writeCache,
} from './offlineCache';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
});

describe('offline cache — základ', () => {
  it('cache: zapsaná data se po přečtení vrátí beze změny', () => {
    writeCache('u1', 'profile', { onboarding_completed: true, n: 1 });
    expect(readCache('u1', 'profile')).toEqual({ onboarding_completed: true, n: 1 });
  });

  it('cache: klíč je vázaný na uživatele — jiný uživatel cizí data nevidí', () => {
    writeCache('u1', 'plan', { id: 'plan-A' });
    expect(readCache('u2', 'plan')).toBeNull();
    expect(cacheKey('u1', 'plan')).not.toBe(cacheKey('u2', 'plan'));
  });

  it('cache: příliš stará položka se nepoužije', () => {
    writeCache('u1', 'plan', { id: 'old' });
    expect(readCache('u1', 'plan', Date.now() + CACHE_MAX_AGE_MS + 1)).toBeNull();
  });

  it('cache: poškozený záznam nevyhodí výjimku, vrátí null', () => {
    localStorage.setItem(cacheKey('u1', 'plan'), '{not json');
    expect(readCache('u1', 'plan')).toBeNull();
  });

  it('cache: odhlášení smaže všechny položky uživatele, cizí nechá', () => {
    writeCache('u1', 'profile', 1);
    writeCache('u1', 'plan', 2);
    writeCache('u2', 'plan', 3);
    clearUserCache('u1');
    expect(readCache('u1', 'profile')).toBeNull();
    expect(readCache('u1', 'plan')).toBeNull();
    expect(readCache('u2', 'plan')).toBe(3);
  });

  it('cache: visící dotaz se utne timeoutem', async () => {
    const never = new Promise<number>(() => {});
    await expect(withNetworkTimeout(never, 20)).rejects.toThrow(/timeout/);
    await expect(withNetworkTimeout(Promise.resolve(7), 20)).resolves.toBe(7);
  });
});

describe('offline cache — profil', () => {
  it('profil: úspěšná síť vrátí čerstvá data a přepíše cache', () => {
    writeCache('u1', 'profile', { onboarding_completed: false });
    const r = resolveWithCache('u1', 'profile', { ok: true, data: { onboarding_completed: true } });
    expect(r).toEqual({ data: { onboarding_completed: true }, source: 'network' });
    expect(readCache('u1', 'profile')).toEqual({ onboarding_completed: true });
  });

  it('profil: selhání sítě vrátí poslední známý profil z cache — zámek dotazníku se neukáže', () => {
    writeCache('u1', 'profile', { onboarding_completed: true, selected_gym_id: 'g1' });
    const r = resolveWithCache<{ onboarding_completed: boolean }>('u1', 'profile', { ok: false });
    expect(r.source).toBe('cache');
    expect(r.data?.onboarding_completed).toBe(true);
  });

  it('profil: selhání sítě bez cache vrátí null a zdroj none', () => {
    const r = resolveWithCache('u1', 'profile', { ok: false });
    expect(r).toEqual({ data: null, source: 'none' });
  });
});

describe('offline cache — plán', () => {
  it('plán: selhání sítě vrátí plán z cache včetně cviků', () => {
    writeCache('u1', 'plan', { id: 'p1', exercises: [{ exerciseId: 'e1' }] });
    const r = resolveWithCache<{ id: string; exercises: unknown[] }>('u1', 'plan', { ok: false });
    expect(r.source).toBe('cache');
    expect(r.data?.exercises).toHaveLength(1);
  });

  it('plán: online se cache přepíše čerstvým plánem', () => {
    writeCache('u1', 'plan', { id: 'stale' });
    resolveWithCache('u1', 'plan', { ok: true, data: { id: 'fresh' } });
    expect(readCache<{ id: string }>('u1', 'plan')?.id).toBe('fresh');
  });

  it('plán: cizí uživatel po přihlášení nikdy nedostane cizí plán z cache', () => {
    writeCache('u1', 'plan', { id: 'p-u1' });
    const r = resolveWithCache('u2', 'plan', { ok: false });
    expect(r).toEqual({ data: null, source: 'none' });
  });
});

describe('offline cache — sdílený dotaz s cache', () => {
  it('cache: fetchWithCache uloží online výsledek a při selhání sítě ho vrátí', async () => {
    const { fetchWithCache, SHARED_SCOPE } = await import('./offlineCache');
    const ok = await fetchWithCache(SHARED_SCOPE, 'exercise:e1', async () => ({ data: { video_path: 'v1' }, error: null }));
    expect(ok).toEqual({ data: { video_path: 'v1' }, source: 'network' });
    const off = await fetchWithCache<{ video_path: string }>(SHARED_SCOPE, 'exercise:e1', async () => ({ data: null, error: new Error('offline') }));
    expect(off.source).toBe('cache');
    expect(off.data?.video_path).toBe('v1');
  });

  it('cache: fetchWithCache utne visící dotaz a spadne na cache', async () => {
    const { fetchWithCache, SHARED_SCOPE, writeCache } = await import('./offlineCache');
    writeCache(SHARED_SCOPE, 'exercise:e2', { video_path: 'v2' });
    const r = await fetchWithCache<{ video_path: string }>(SHARED_SCOPE, 'exercise:e2', () => new Promise(() => {}), 15);
    expect(r).toEqual({ data: { video_path: 'v2' }, source: 'cache' });
  });
});
