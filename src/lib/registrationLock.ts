// Registrační zámek drží AuthRoute na spinneru, dokud doběhne zakládání účtu
// (profil, plán, ověření) — jinak by nás onAuthStateChange přesměroval domů
// do polorozdělaného profilu.
//
// Zámek, který nikdo neuvolní, ale znamená nekonečné kolečko místo přihlašovací
// obrazovky. Proto se vždy pustí sám: pojistka je poslední záchrana, ne běžná
// cesta — volající má release() volat ve finally.
export const REGISTRATION_LOCK_TIMEOUT_MS = 45_000;

export interface RegistrationLock {
  acquire: () => void;
  release: () => void;
  /** Zruší pojistku bez sáhnutí na flag — pro unmount. */
  dispose: () => void;
}

export const createRegistrationLock = (
  setFlag: (value: boolean) => void,
  timeoutMs: number = REGISTRATION_LOCK_TIMEOUT_MS,
): RegistrationLock => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    acquire: () => {
      clearTimer();
      setFlag(true);
      timer = setTimeout(() => {
        timer = null;
        setFlag(false);
      }, timeoutMs);
    },
    release: () => {
      clearTimer();
      setFlag(false);
    },
    dispose: clearTimer,
  };
};
