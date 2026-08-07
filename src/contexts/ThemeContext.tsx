import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Co si uživatel zvolil. `system` sleduje nastavení telefonu i za běhu. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** Co je právě vykreslené — `system` je vždy rozřešený na jednu z těchto hodnot. */
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'pumplo-theme';
// AMOLED: v tmavém režimu čistě černé pozadí (šetří baterii na OLED displejích).
const AMOLED_KEY = 'pumplo-amoled';

interface ThemeContextValue {
  /** Volba uživatele včetně `system`. */
  preference: ThemePreference;
  /** Téma, které je právě na obrazovce. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** AMOLED: čistě černé pozadí, uplatní se jen v tmavém režimu. */
  amoled: boolean;
  setAmoled: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const readStoredPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Soukromý režim prohlížeče může localStorage zakázat — padáme na systém.
  }
  return 'system';
};

const readStoredAmoled = (): boolean => {
  try { return localStorage.getItem(AMOLED_KEY) === '1'; } catch { return false; }
};

const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference;

/**
 * Promítne téma mimo React: třída na <html> přepíná Tailwind proměnné,
 * `color-scheme` řídí nativní prvky (scrollbary, vstupy, klávesnici),
 * `theme-color` barvu systémových lišt na webu a v PWA.
 */
const applyTheme = (theme: ResolvedTheme, amoled = false) => {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('amoled', theme === 'dark' && amoled);
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? (amoled ? '#000000' : '#141821') : '#ffffff');

  if (Capacitor.isNativePlatform()) {
    // Style.Dark = světlý text pro tmavé pozadí, Style.Light = tmavý text pro světlé.
    StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {
      // Na zařízeních bez podpory je to no-op, stejně jako ostatní nativní pluginy.
    });
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredPreference()));
  const [amoled, setAmoledState] = useState<boolean>(readStoredAmoled);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Volba pak nepřežije restart, ale appka běží dál.
    }
  }, []);

  const setAmoled = useCallback((on: boolean) => {
    setAmoledState(on);
    try {
      localStorage.setItem(AMOLED_KEY, on ? '1' : '0');
    } catch {
      // Volba pak nepřežije restart, ale appka běží dál.
    }
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(preference);
    setTheme(resolved);
    applyTheme(resolved, amoled);

    // Jen volba `system` reaguje na to, když si uživatel přepne téma telefonu za běhu.
    if (preference !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = query.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next, amoled);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference, amoled]);

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference, amoled, setAmoled }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
