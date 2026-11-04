import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_TRAINER_INVITE_KEY,
  clearPendingTrainerInvite,
  extractTrainerInviteToken,
  isValidInviteToken,
  mapAcceptInviteError,
  readPendingTrainerInvite,
  savePendingTrainerInvite,
} from './trainerInvite';

const TOKEN = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const makeStore = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
};

describe('isValidInviteToken', () => {
  it('accepts uuid in any case, rejects garbage', () => {
    expect(isValidInviteToken(TOKEN)).toBe(true);
    expect(isValidInviteToken(TOKEN.toUpperCase())).toBe(true);
    expect(isValidInviteToken('not-a-uuid')).toBe(false);
    expect(isValidInviteToken('')).toBe(false);
    expect(isValidInviteToken(null)).toBe(false);
    expect(isValidInviteToken(123)).toBe(false);
    expect(isValidInviteToken(`${TOKEN}x`)).toBe(false);
  });
});

describe('pending token in localStorage', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('saves, reads and clears a valid token (normalized to lower case)', () => {
    expect(savePendingTrainerInvite(TOKEN.toUpperCase())).toBe(true);
    expect(store.data.get(PENDING_TRAINER_INVITE_KEY)).toBe(TOKEN);
    expect(readPendingTrainerInvite()).toBe(TOKEN);
    clearPendingTrainerInvite();
    expect(readPendingTrainerInvite()).toBeNull();
  });

  it('refuses to save an invalid token', () => {
    expect(savePendingTrainerInvite('nope')).toBe(false);
    expect(store.data.size).toBe(0);
  });

  it('drops a corrupted stored value on read', () => {
    store.data.set(PENDING_TRAINER_INVITE_KEY, 'garbage');
    expect(readPendingTrainerInvite()).toBeNull();
    expect(store.data.has(PENDING_TRAINER_INVITE_KEY)).toBe(false);
  });

  it('clear(onlyIf) keeps a different, newer token', () => {
    savePendingTrainerInvite(OTHER);
    clearPendingTrainerInvite(TOKEN);
    expect(readPendingTrainerInvite()).toBe(OTHER);
    clearPendingTrainerInvite(OTHER);
    expect(readPendingTrainerInvite()).toBeNull();
  });

  it('survives a throwing localStorage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(savePendingTrainerInvite(TOKEN)).toBe(false);
    expect(readPendingTrainerInvite()).toBeNull();
    expect(() => clearPendingTrainerInvite()).not.toThrow();
    expect(() => clearPendingTrainerInvite(TOKEN)).not.toThrow();
  });
});

describe('extractTrainerInviteToken', () => {
  it('reads the token from universal link, custom scheme and path', () => {
    expect(extractTrainerInviteToken(`https://app.pumplo.com/trener/${TOKEN}`)).toBe(TOKEN);
    expect(extractTrainerInviteToken(`https://app.pumplo.com/trener/${TOKEN}?utm=wa#x`)).toBe(TOKEN);
    expect(extractTrainerInviteToken(`com.pumplo.app://trener/${TOKEN}`)).toBe(TOKEN);
    expect(extractTrainerInviteToken(`/trener/${TOKEN.toUpperCase()}/`)).toBe(TOKEN);
    expect(extractTrainerInviteToken(`trener/${TOKEN}`)).toBe(TOKEN);
  });

  it('returns null for other links or bad tokens', () => {
    expect(extractTrainerInviteToken(`https://app.pumplo.com/plan/${TOKEN}`)).toBeNull();
    expect(extractTrainerInviteToken('https://app.pumplo.com/trener/abc')).toBeNull();
    expect(extractTrainerInviteToken(`https://app.pumplo.com/xtrener/${TOKEN}`)).toBeNull();
    expect(extractTrainerInviteToken('')).toBeNull();
    expect(extractTrainerInviteToken(null)).toBeNull();
    expect(extractTrainerInviteToken(undefined)).toBeNull();
  });
});

describe('mapAcceptInviteError', () => {
  it('permanent errors clear the token and show a message', () => {
    expect(mapAcceptInviteError({ message: 'invite_invalid' })).toEqual({ kind: 'invalid', messageKey: 'trainer_client.error_invite_invalid', clearToken: true });
    expect(mapAcceptInviteError({ message: 'invite_used' })).toEqual({ kind: 'used', messageKey: 'trainer_client.error_invite_used', clearToken: true });
    expect(mapAcceptInviteError({ message: 'own_invite' })).toEqual({ kind: 'own', messageKey: 'trainer_client.error_own_invite', clearToken: true });
    expect(mapAcceptInviteError('INVITE_USED')).toMatchObject({ kind: 'used', clearToken: true });
  });

  it('not_authenticated keeps the token silently', () => {
    expect(mapAcceptInviteError({ message: 'not_authenticated' })).toEqual({ kind: 'not_authenticated', messageKey: null, clearToken: false });
  });

  it('network / missing function / unknown errors keep the token for a retry', () => {
    for (const e of [
      { message: 'TypeError: Failed to fetch' },
      { message: 'Could not find the function public.trainer_accept_invite(p_token) in the schema cache', code: 'PGRST202' },
      new Error('boom'),
      { message: 42 },
      null,
      undefined,
    ]) {
      const info = mapAcceptInviteError(e);
      expect(info.kind).toBe('retry');
      expect(info.clearToken).toBe(false);
      expect(info.messageKey).toBe('trainer_client.error_generic');
    }
  });
});
