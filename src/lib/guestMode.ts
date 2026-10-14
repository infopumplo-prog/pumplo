/**
 * Režim „Vyzkoušet bez registrace“ (feedback 13. 10.): host si prohlíží katalog tréninků,
 * náhledy plánů a mapu bez účtu. Vše, co účet potřebuje, otevře registrační sheet.
 * Příznak v localStorage přežije restart appky, smaže se po přihlášení.
 */

export const GUEST_KEY = 'pumplo_guest';
export const GUEST_RETURN_KEY = 'pumplo_guest_return';
const CHANGE_EVENT = 'pumplo-guest-change';

/** Kam host smí v appce (uvnitř nativní appky; webová brána zůstává beze změny). */
export const GUEST_EXACT_PATHS = ['/workouts', '/map'] as const;
const GUEST_PREFIXES = ['/plan/', '/cvik/'];

/** Výchozí obrazovka hosta. */
export const GUEST_HOME = '/workouts';

export const isGuestPath = (pathname: string): boolean =>
  (GUEST_EXACT_PATHS as readonly string[]).includes(pathname) ||
  GUEST_PREFIXES.some((p) => pathname.startsWith(p));

/** Položka spodní lišty: host buď normálně naviguje, nebo dostane registrační sheet. */
export const guestNavAction = (path: string): 'navigate' | 'register' =>
  isGuestPath(path) ? 'navigate' : 'register';

/**
 * Kam se po registraci vrátit — jen interní cesta appky (ne //host, ne /auth),
 * ať se z localStorage nedá podstrčit přesměrování ven.
 */
export const safeReturnPath = (raw: string | null | undefined): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  if (path === '/auth' || path.startsWith('/auth?') || path.startsWith('/auth/')) return null;
  if (path.length > 300) return null;
  return path;
};

const read = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* úložiště nedostupné */ }
};
const notify = () => {
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* noop */ }
};

export const isGuestMode = (): boolean => read(GUEST_KEY) === '1';

export const enterGuestMode = () => { write(GUEST_KEY, '1'); notify(); };

/** Po přihlášení/registraci: host už není host. Návratovou cestu nechává (spotřebuje ji App). */
export const clearGuestMode = () => {
  if (read(GUEST_KEY) === null) return;
  write(GUEST_KEY, null);
  notify();
};

export const saveGuestReturnPath = (path: string) => {
  const safe = safeReturnPath(path);
  write(GUEST_RETURN_KEY, safe);
};

export const clearGuestReturnPath = () => write(GUEST_RETURN_KEY, null);

/** Návratová cesta bez smazání. */
export const peekGuestReturnPath = (): string | null => safeReturnPath(read(GUEST_RETURN_KEY));

/** Přečte a smaže návratovou cestu (jednorázově). */
export const consumeGuestReturnPath = (): string | null => {
  const path = safeReturnPath(read(GUEST_RETURN_KEY));
  write(GUEST_RETURN_KEY, null);
  return path;
};

export const subscribeGuestMode = (cb: () => void): (() => void) => {
  const onStorage = (e: StorageEvent) => { if (e.key === GUEST_KEY) cb(); };
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
};
