// Import tělesné váhy ze Zdraví (Apple HealthKit na iOS, Health Connect na Androidu)
// přes @capgo/capacitor-health. Jen čtení (READ_WEIGHT / HKQuantityType bodyMass).
// Zápis do body_weight_entries jde výhradně přes upsertWeightEntries (dedupe
// user + source + external_id), takže opakované/přesahující importy nic nezdvojí.
// Trenér váhy vidí jen při zapnutém sdílení (set_weight_sharing) — tady se nic
// nesdílí, jen se plní klientův vlastní deník vah.
//
// Čistá logika (převody jednotek, filtr, dedupe, rozsah, stav) je nahoře a
// testovaná v healthWeights.test.ts; nativní volání dole.
import { Capacitor } from '@capacitor/core';
import { upsertWeightEntries, type WeightEntryInput, type WeightSource } from '@/lib/bodyWeight';

export type HealthPlatform = 'ios' | 'android';

export const MIN_WEIGHT_KG = 25;
export const MAX_WEIGHT_KG = 400;
/** První import: posledních 90 dní. */
export const FIRST_IMPORT_DAYS = 90;
/** Další importy čtou od posledního s přesahem (pozdě synchronizované vážení z váhy/hodinek). */
export const SYNC_OVERLAP_MS = 24 * 60 * 60 * 1000;
/** Automatická synchronizace při startu / návratu appky nejvýš jednou za 6 h. */
export const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LB_TO_KG = 0.45359237;

/** Vzorek, jak ho vrací plugin (podmnožina HealthSample). */
export interface RawHealthSample {
  value: number;
  unit?: string;
  startDate: string;
  endDate?: string;
  platformId?: string;
}

export interface HealthSyncState {
  connected: boolean;
  /** Okamžik začátku poslední úspěšné synchronizace (ISO). */
  lastSyncAt: string | null;
}

export const EMPTY_HEALTH_STATE: HealthSyncState = { connected: false, lastSyncAt: null };

export const healthSourceFor = (platform: HealthPlatform): WeightSource =>
  platform === 'ios' ? 'apple_health' : 'health_connect';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Hodnota v jednotce zdroje → kg. Neznámá jednotka = null (raději nic než nesmysl). Bez jednotky = kg (výchozí jednotka pluginu). */
export const toKg = (value: number, unit?: string | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const u = (unit ?? 'kilogram').trim().toLowerCase();
  if (u === 'kilogram' || u === 'kg' || u === 'kilograms') return value;
  if (u === 'pound' || u === 'lb' || u === 'lbs' || u === 'pounds') return value * LB_TO_KG;
  if (u === 'gram' || u === 'g' || u === 'grams') return value / 1000;
  return null;
};

/** Platná váha zaokrouhlená na 0,1 kg, nebo null (mimo 25–400 kg / nečíslo). */
export const normalizeWeightKg = (value: number, unit?: string | null): number | null => {
  const kg = toKg(value, unit);
  if (kg == null) return null;
  const r = round1(kg);
  return r >= MIN_WEIGHT_KG && r <= MAX_WEIGHT_KG ? r : null;
};

/** FNV-1a 32 bit se zvoleným semínkem → 8 hex znaků. */
const fnv1a = (s: string, seed: number): string => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

/** Náhradní external_id, když zdroj nedá ID vzorku: hash okamžiku + hodnoty (deterministický → dedupe funguje). */
export const fallbackExternalId = (measuredAtMs: number, weightKg: number): string => {
  const key = `${measuredAtMs}|${weightKg.toFixed(1)}`;
  return `h_${fnv1a(key, 0x811c9dc5)}${fnv1a(key, 0x01234567)}`;
};

/** Vzorky ze Zdraví → záznamy pro upsertWeightEntries: převod, filtr, dedupe (poslední vyhrává), seřazeno od nejstaršího. */
export const mapHealthSamples = (samples: RawHealthSample[], source: WeightSource): WeightEntryInput[] => {
  const byId = new Map<string, WeightEntryInput & { ms: number }>();
  for (const s of samples ?? []) {
    if (!s) continue;
    const ms = Date.parse(s.startDate);
    if (!Number.isFinite(ms)) continue;
    const kg = normalizeWeightKg(s.value, s.unit);
    if (kg == null) continue;
    const pid = typeof s.platformId === 'string' ? s.platformId.trim() : '';
    const externalId = pid || fallbackExternalId(ms, kg);
    byId.set(externalId, { measuredAt: new Date(ms).toISOString(), weightKg: kg, source, externalId, ms });
  }
  return [...byId.values()]
    .sort((a, b) => a.ms - b.ms)
    .map(({ ms: _ms, ...entry }) => entry);
};

/** Od kdy číst: první import 90 dní zpět, jinak od poslední synchronizace minus přesah (nikdy ne do budoucnosti). */
export const syncRange = (lastSyncAt: string | null, now: Date): { startDate: string; endDate: string } => {
  const nowMs = now.getTime();
  const last = lastSyncAt ? Date.parse(lastSyncAt) : NaN;
  const start = Number.isFinite(last)
    ? Math.min(last, nowMs) - SYNC_OVERLAP_MS
    : nowMs - FIRST_IMPORT_DAYS * DAY_MS;
  return { startDate: new Date(start).toISOString(), endDate: now.toISOString() };
};

export const isAutoSyncDue = (state: HealthSyncState, now: Date): boolean => {
  if (!state.connected) return false;
  if (!state.lastSyncAt) return true;
  const last = Date.parse(state.lastSyncAt);
  if (!Number.isFinite(last)) return true;
  // Hodiny posunuté dozadu (last v budoucnu) → synchronizovat, ať se import nezasekne.
  return last > now.getTime() || now.getTime() - last >= AUTO_SYNC_INTERVAL_MS;
};

export const parseHealthState = (raw: string | null): HealthSyncState => {
  if (!raw) return { ...EMPTY_HEALTH_STATE };
  try {
    const v = JSON.parse(raw) as Partial<HealthSyncState> | null;
    if (!v || typeof v !== 'object') return { ...EMPTY_HEALTH_STATE };
    const lastSyncAt = typeof v.lastSyncAt === 'string' && Number.isFinite(Date.parse(v.lastSyncAt)) ? v.lastSyncAt : null;
    return { connected: v.connected === true, lastSyncAt };
  } catch {
    return { ...EMPTY_HEALTH_STATE };
  }
};

/** Android: plugin vrací jen anglický důvod nedostupnosti → stav pro UI. */
export type HealthAvailability = 'available' | 'not_installed' | 'update_required' | 'unsupported';
export const availabilityFromResult = (
  platform: HealthPlatform | null,
  result: { available: boolean; reason?: string } | null,
): HealthAvailability => {
  if (!platform || !result) return 'unsupported';
  if (result.available) return 'available';
  if (platform === 'ios') return 'unsupported'; // iPad bez Zdraví apod.
  return /update/i.test(result.reason ?? '') ? 'update_required' : 'not_installed';
};

// ───────────────────────────── stav (localStorage, per uživatel) ─────────────────────────────

const stateKey = (userId: string) => `pumplo.health_weights.v1.${userId}`;
const listeners = new Set<() => void>();

export const readHealthState = (userId: string): HealthSyncState => {
  try { return parseHealthState(localStorage.getItem(stateKey(userId))); } catch { return { ...EMPTY_HEALTH_STATE }; }
};

const writeHealthState = (userId: string, state: HealthSyncState) => {
  try { localStorage.setItem(stateKey(userId), JSON.stringify(state)); } catch { /* soukromý režim apod. */ }
  listeners.forEach((l) => l());
};

export const subscribeHealthState = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// ───────────────────────────── nativní část ─────────────────────────────

/** Jen nativní iOS/Android; web/PWA = null (Zdraví nejde). */
export const getHealthPlatform = (): HealthPlatform | null => {
  if (!Capacitor.isNativePlatform()) return null;
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
};

const loadHealth = async () => (await import('@capgo/capacitor-health')).Health;

export const checkHealthAvailability = async (): Promise<HealthAvailability> => {
  const platform = getHealthPlatform();
  if (!platform) return 'unsupported';
  try {
    const Health = await loadHealth();
    return availabilityFromResult(platform, await Health.isAvailable());
  } catch (e) {
    console.warn('[health] availability check failed', e);
    return platform === 'android' ? 'not_installed' : 'unsupported';
  }
};

export type HealthSyncResult =
  | { ok: true; imported: number; failed: number }
  | { ok: false; reason: 'unsupported' | 'not_connected' | 'error' };

let inflight: Promise<HealthSyncResult> | null = null;

/** Načte váhy od poslední synchronizace a zapíše je. Souběžná volání sdílí jeden běh. */
export const syncHealthWeights = (userId: string): Promise<HealthSyncResult> => {
  if (inflight) return inflight;
  inflight = (async (): Promise<HealthSyncResult> => {
    const platform = getHealthPlatform();
    if (!platform) return { ok: false, reason: 'unsupported' };
    const state = readHealthState(userId);
    if (!state.connected) return { ok: false, reason: 'not_connected' };
    const startedAt = new Date();
    try {
      const Health = await loadHealth();
      const range = syncRange(state.lastSyncAt, startedAt);
      const { samples } = await Health.readSamples({ dataType: 'weight', ...range, limit: 2000, ascending: true });
      const entries = mapHealthSamples((samples ?? []) as RawHealthSample[], healthSourceFor(platform));
      const { failed } = entries.length ? await upsertWeightEntries(userId, entries) : { failed: 0 };
      // Při chybě zápisu posun nedělat — příště se stejný rozsah načte znovu (dedupe to unese).
      if (failed === 0) writeHealthState(userId, { connected: true, lastSyncAt: startedAt.toISOString() });
      return { ok: true, imported: entries.length - failed, failed };
    } catch (e) {
      console.warn('[health] sync failed', e);
      return { ok: false, reason: 'error' };
    }
  })().finally(() => { inflight = null; });
  return inflight;
};

export type HealthConnectResult =
  | { ok: true; sync: HealthSyncResult }
  | { ok: false; reason: 'unsupported' | 'not_installed' | 'update_required' | 'denied' | 'error' };

/** Požádá o čtení váhy (jen read) a hned importuje. */
export const connectHealth = async (userId: string): Promise<HealthConnectResult> => {
  const platform = getHealthPlatform();
  if (!platform) return { ok: false, reason: 'unsupported' };
  const availability = await checkHealthAvailability();
  if (availability !== 'available') return { ok: false, reason: availability };
  try {
    const Health = await loadHealth();
    const status = await Health.requestAuthorization({ read: ['weight'], write: [] });
    // iOS záměrně neprozradí, zda čtení povolil — zamítnutí se projeví jen prázdnými daty.
    if (platform === 'android' && !status.readAuthorized.includes('weight')) return { ok: false, reason: 'denied' };
  } catch (e) {
    console.warn('[health] authorization failed', e);
    return { ok: false, reason: platform === 'android' ? 'denied' : 'error' };
  }
  writeHealthState(userId, { ...readHealthState(userId), connected: true });
  return { ok: true, sync: await syncHealthWeights(userId) };
};

/** Odpojení v Pumplu (oprávnění v systému zůstává, odebrat ho jde v nastavení Zdraví / Health Connect). Importované váhy zůstávají. */
export const disconnectHealth = (userId: string) => writeHealthState(userId, { ...EMPTY_HEALTH_STATE });

/** Android: Health Connect chybí / je zastaralý → stránka v Obchodě Play. */
export const openHealthConnectStore = async () => {
  const { AppLauncher } = await import('@capacitor/app-launcher');
  try {
    await AppLauncher.openUrl({ url: 'market://details?id=com.google.android.apps.healthdata' });
  } catch {
    await AppLauncher.openUrl({ url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata' });
  }
};

/** Android: zamítnuté oprávnění → nastavení Health Connect, kde ho jde povolit. */
export const openHealthSettings = async () => {
  try {
    const Health = await loadHealth();
    await Health.openHealthConnectSettings();
  } catch (e) {
    console.warn('[health] cannot open settings', e);
  }
};
