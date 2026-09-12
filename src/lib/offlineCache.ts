/**
 * Offline cache pro data, bez kterých nejde spustit trénink (profil, aktivní plán).
 *
 * Vzor stale-while-revalidate: hook nejdřív vrátí poslední známá data z telefonu,
 * pak se zeptá serveru; když server odpoví, cache se přepíše; když síť selže
 * (nebo visí a vyprší timeout), zůstanou data z cache a hook nehlásí chybu.
 *
 * Klíče jsou vázané na uživatele, aby po odhlášení a přihlášení jiného účtu
 * nikdy nevyskočil cizí plán.
 */

const PREFIX = 'pumplo_cache';
/** Data starší než tohle už raději nepoužijeme (uživatel by cvičil cizí/staré). */
export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface Envelope<T> {
  v: 1;
  savedAt: number;
  data: T;
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

export const cacheKey = (userId: string, name: string) => `${PREFIX}:${userId}:${name}`;

export const writeCache = <T>(userId: string, name: string, data: T): void => {
  const s = storage();
  if (!s) return;
  try {
    const env: Envelope<T> = { v: 1, savedAt: Date.now(), data };
    s.setItem(cacheKey(userId, name), JSON.stringify(env));
  } catch {
    /* plný nebo nedostupný storage — cache je jen bonus */
  }
};

export const readCache = <T>(userId: string, name: string, now = Date.now()): T | null => {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(cacheKey(userId, name));
    if (!raw) return null;
    const env = JSON.parse(raw) as Partial<Envelope<T>>;
    if (env.v !== 1 || typeof env.savedAt !== 'number' || env.data === undefined) return null;
    if (now - env.savedAt > CACHE_MAX_AGE_MS) return null;
    return env.data as T;
  } catch {
    return null;
  }
};

export const clearCache = (userId: string, name: string): void => {
  storage()?.removeItem(cacheKey(userId, name));
};

/** Smaže všechny cache položky daného uživatele (odhlášení). */
export const clearUserCache = (userId: string): void => {
  const s = storage();
  if (!s) return;
  const prefix = `${PREFIX}:${userId}:`;
  const doomed: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(prefix)) doomed.push(k);
  }
  doomed.forEach((k) => s.removeItem(k));
};

export type CacheSource = 'network' | 'cache' | 'none';

export interface Resolved<T> {
  data: T | null;
  source: CacheSource;
}

/**
 * Sloučí výsledek síťového dotazu s cache.
 * - síť uspěla → její data, cache se přepíše
 * - síť selhala / vypršela → data z cache (pokud jsou), bez chyby
 * - nic → null, 'none' — až tady má smysl uživateli ukázat chybu
 */
export const resolveWithCache = <T>(
  userId: string,
  name: string,
  network: { ok: true; data: T } | { ok: false },
): Resolved<T> => {
  if (network.ok) {
    writeCache(userId, name, network.data);
    return { data: network.data, source: 'network' };
  }
  const cached = readCache<T>(userId, name);
  return cached === null ? { data: null, source: 'none' } : { data: cached, source: 'cache' };
};

/** Utne visící dotaz — na jedné čárce signálu Supabase nevyhodí chybu, jen čeká. */
export const withNetworkTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`network timeout after ${ms} ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });

export const FETCH_TIMEOUT_MS = 8000;

/** Data společná všem uživatelům (detail cviku, rozcvička) — klíčovaná bez uživatele. */
export const SHARED_SCOPE = 'shared';

/**
 * Dotaz s cache: online výsledek se uloží, při chybě/timeoutu se vrátí poslední
 * uložený. Pro Supabase buildery (thenable) — `fetcher` vrací { data, error }.
 */
export const fetchWithCache = async <T>(
  scope: string,
  name: string,
  fetcher: () => PromiseLike<{ data: T | null; error: unknown }>,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Resolved<T>> => {
  try {
    const res = await withNetworkTimeout(Promise.resolve(fetcher()), timeoutMs);
    if (!res.error && res.data !== null && res.data !== undefined) {
      return resolveWithCache<T>(scope, name, { ok: true, data: res.data });
    }
  } catch {
    /* síť selhala nebo visí — níže cache */
  }
  return resolveWithCache<T>(scope, name, { ok: false });
};
