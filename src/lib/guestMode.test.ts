import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GUEST_KEY,
  GUEST_RETURN_KEY,
  clearGuestMode,
  consumeGuestReturnPath,
  enterGuestMode,
  guestNavAction,
  isGuestMode,
  isGuestPath,
  safeReturnPath,
  saveGuestReturnPath,
} from './guestMode';

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    _m: m,
  };
};

describe('isGuestPath / guestNavAction', () => {
  it('katalog, mapa, náhled plánu a cviku jsou pro hosta', () => {
    expect(isGuestPath('/workouts')).toBe(true);
    expect(isGuestPath('/map')).toBe(true);
    expect(isGuestPath('/plan/abc-123')).toBe(true);
    expect(isGuestPath('/cvik/42')).toBe(true);
  });
  it('účtové obrazovky hostovi nepatří', () => {
    for (const p of ['/', '/profile', '/statistics', '/settings', '/custom-plan/1', '/custom-workout/1', '/training', '/workouts/x']) {
      expect(isGuestPath(p)).toBe(false);
    }
  });
  it('spodní lišta: Tréninky a Mapa navigují, zbytek otevře registraci', () => {
    expect(guestNavAction('/workouts')).toBe('navigate');
    expect(guestNavAction('/map')).toBe('navigate');
    expect(guestNavAction('/')).toBe('register');
    expect(guestNavAction('/statistics')).toBe('register');
    expect(guestNavAction('/profile')).toBe('register');
  });
});

describe('safeReturnPath', () => {
  it('pustí interní cesty', () => {
    expect(safeReturnPath('/plan/abc')).toBe('/plan/abc');
    expect(safeReturnPath('/workouts')).toBe('/workouts');
    expect(safeReturnPath('  /map ')).toBe('/map');
  });
  it('odmítne vnější a nesmyslné cíle', () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath('')).toBeNull();
    expect(safeReturnPath('https://evil.example')).toBeNull();
    expect(safeReturnPath('//evil.example')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
    expect(safeReturnPath('plan/abc')).toBeNull();
    expect(safeReturnPath('/' + 'a'.repeat(400))).toBeNull();
  });
  it('nevrací zpátky na přihlášení', () => {
    expect(safeReturnPath('/auth')).toBeNull();
    expect(safeReturnPath('/auth?start=1')).toBeNull();
  });
});

describe('guest flag + návratová cesta (localStorage)', () => {
  let store: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    store = memoryStorage();
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('enter → isGuestMode, clear → konec hosta', () => {
    expect(isGuestMode()).toBe(false);
    enterGuestMode();
    expect(store._m.get(GUEST_KEY)).toBe('1');
    expect(isGuestMode()).toBe(true);
    clearGuestMode();
    expect(isGuestMode()).toBe(false);
    expect(store._m.has(GUEST_KEY)).toBe(false);
  });

  it('návratová cesta se spotřebuje jen jednou', () => {
    saveGuestReturnPath('/plan/xyz');
    expect(store._m.get(GUEST_RETURN_KEY)).toBe('/plan/xyz');
    expect(consumeGuestReturnPath()).toBe('/plan/xyz');
    expect(consumeGuestReturnPath()).toBeNull();
  });

  it('nebezpečnou cestu neuloží', () => {
    saveGuestReturnPath('//evil.example');
    expect(store._m.has(GUEST_RETURN_KEY)).toBe(false);
    expect(consumeGuestReturnPath()).toBeNull();
  });

  it('podvržená hodnota v úložišti se nevrátí', () => {
    store.setItem(GUEST_RETURN_KEY, 'https://evil.example');
    expect(consumeGuestReturnPath()).toBeNull();
  });

  it('nedostupné úložiště nic neshodí', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } });
    expect(isGuestMode()).toBe(false);
    expect(() => enterGuestMode()).not.toThrow();
    expect(consumeGuestReturnPath()).toBeNull();
  });
});
