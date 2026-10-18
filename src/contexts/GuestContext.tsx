import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import GuestSignUpSheet from '@/components/guest/GuestSignUpSheet';
import {
  clearGuestMode,
  clearGuestReturnPath,
  consumeGuestReturnPath,
  isGuestMode,
  saveGuestReturnPath,
  subscribeGuestMode,
} from '@/lib/guestMode';

interface GuestContextType {
  /** Nepřihlášený člověk, který zvolil „Vyzkoušet bez registrace“. */
  isGuest: boolean;
  /** Otevře registrační sheet; po registraci se vrátí na returnPath (výchozí = aktuální obrazovka). */
  requireAccount: (returnPath?: string) => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const GuestProvider = ({ children }: { children: ReactNode }) => {
  const { user, isRegistering } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const guestFlag = useSyncExternalStore(subscribeGuestMode, isGuestMode, () => false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isGuest = !user && guestFlag;

  const requireAccount = useCallback((returnPath?: string) => {
    saveGuestReturnPath(returnPath ?? `${location.pathname}${location.search}`);
    setSheetOpen(true);
  }, [location.pathname, location.search]);

  // Zavření sheetu člověkem = rozmyslel si to → zapomenout, kam se vracet.
  // Odkazy na přihlášení/dotazník zavírají s keepReturn (přihlášení se vrátí zpět).
  const closeSheet = useCallback((keepReturn: boolean) => {
    if (!keepReturn) clearGuestReturnPath();
    setSheetOpen(false);
  }, []);

  // Po přihlášení/registraci (sheet, Apple/Google redirect i běžné /auth): host končí
  // a vrátí se tam, kde byl — např. na plán, který chtěl spustit. Na /auth se čeká,
  // až AuthRoute přesměruje (jinak by se navigace přetahovaly); jednou na přihlášení.
  const handledUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { handledUserId.current = null; return; }
    if (isRegistering || location.pathname.startsWith('/auth')) return;
    if (handledUserId.current === user.id) return;
    handledUserId.current = user.id;
    clearGuestMode();
    setSheetOpen(false);
    const back = consumeGuestReturnPath();
    if (back && back !== `${location.pathname}${location.search}`) navigate(back, { replace: true });
  }, [user, isRegistering, location.pathname, location.search, navigate]);

  const value = useMemo(() => ({ isGuest, requireAccount }), [isGuest, requireAccount]);

  return (
    <GuestContext.Provider value={value}>
      {children}
      {!user && <GuestSignUpSheet open={sheetOpen} onClose={closeSheet} />}
    </GuestContext.Provider>
  );
};

export const useGuest = (): GuestContextType => {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error('useGuest must be used within a GuestProvider');
  return ctx;
};
