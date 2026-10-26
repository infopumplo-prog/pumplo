// Pozvánka od trenéra (odkaz https://app.pumplo.com/trener/<token>).
// Nepřihlášený klient si token odloží sem, po registraci/přihlášení ho
// PendingTrainerInviteAccept v App.tsx automaticky přijme.

export const PENDING_TRAINER_INVITE_KEY = 'pumplo_pending_trainer_invite';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidInviteToken = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value.trim());

export const normalizeInviteToken = (value: unknown): string | null =>
  isValidInviteToken(value) ? value.trim().toLowerCase() : null;

export const savePendingTrainerInvite = (token: string): boolean => {
  const normalized = normalizeInviteToken(token);
  if (!normalized) return false;
  try {
    localStorage.setItem(PENDING_TRAINER_INVITE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
};

export const readPendingTrainerInvite = (): string | null => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_TRAINER_INVITE_KEY);
  } catch {
    return null;
  }
  const normalized = normalizeInviteToken(raw);
  // Rozbitá hodnota by se zkoušela donekonečna → rovnou pryč.
  if (raw !== null && !normalized) clearPendingTrainerInvite();
  return normalized;
};

/** Smaže odložený token; s `onlyIf` jen když je uložený právě tenhle (souběh dvou pozvánek). */
export const clearPendingTrainerInvite = (onlyIf?: string): void => {
  try {
    if (onlyIf) {
      const current = localStorage.getItem(PENDING_TRAINER_INVITE_KEY);
      if (current && current.toLowerCase() !== onlyIf.toLowerCase()) return;
    }
    localStorage.removeItem(PENDING_TRAINER_INVITE_KEY);
  } catch {
    /* noop */
  }
};

/** Token z URL / deep linku: https://app.pumplo.com/trener/<uuid>, com.pumplo.app://trener/<uuid>, /trener/<uuid>. */
export const extractTrainerInviteToken = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const m = url.match(/(?:^|\/)trener\/([^/?#\s]+)/i);
  if (!m) return null;
  let candidate = m[1];
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    /* noop — necháme původní */
  }
  return normalizeInviteToken(candidate);
};

export type AcceptErrorKind = 'invalid' | 'used' | 'own' | 'not_authenticated' | 'retry';

export interface AcceptErrorInfo {
  kind: AcceptErrorKind;
  /** i18n klíč hlášky pro uživatele; null = nic neukazovat (tichý pokus později). */
  messageKey: string | null;
  /** true = token už nikdy nepůjde přijmout → smazat. */
  clearToken: boolean;
}

/**
 * Chyba z RPC trainer_accept_invite → co ukázat a jestli token zahodit.
 * Síť / nenasazená migrace / cokoli neznámého = token nechat a zkusit později.
 */
export const mapAcceptInviteError = (error: unknown): AcceptErrorInfo => {
  const message = (() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const m = (error as { message?: unknown }).message;
      return typeof m === 'string' ? m : '';
    }
    return '';
  })().toLowerCase();

  if (message.includes('invite_invalid')) {
    return { kind: 'invalid', messageKey: 'trainer_client.error_invite_invalid', clearToken: true };
  }
  if (message.includes('invite_used')) {
    return { kind: 'used', messageKey: 'trainer_client.error_invite_used', clearToken: true };
  }
  if (message.includes('own_invite')) {
    return { kind: 'own', messageKey: 'trainer_client.error_own_invite', clearToken: true };
  }
  if (message.includes('not_authenticated')) {
    return { kind: 'not_authenticated', messageKey: null, clearToken: false };
  }
  return { kind: 'retry', messageKey: 'trainer_client.error_generic', clearToken: false };
};
