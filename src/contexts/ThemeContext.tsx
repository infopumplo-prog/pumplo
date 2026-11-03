import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { asAccent, type AccentColor } from '@/lib/accentColors';

/** Co si uživatel zvolil. `system` sleduje nastavení telefonu i za běhu. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** Co je právě vykreslené — `system` je vždy rozřešený na jednu z těchto hodnot. */
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'pumplo-theme';
// AMOLED: v tmavém režimu čistě černé pozadí (šetří baterii na OLED displejích).
const AMOLED_KEY = 'pumplo-amoled';
// Barva appky (fáze 2 Onboarding 2.0): uložená i v profilu, tady kvůli okamžitému startu.
const ACCENT_KEY = 'pumplo-accent';

interface ThemeContextValue {
  /** Volba uživatele včetně `system`. */
  preference: ThemePreference;
  /** Téma, které je právě na obrazovce. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** AMOLED: čistě černé pozadí, uplatní se jen v tmavém režimu. */
  amoled: boolean;
  setAmoled: (on: boolean) => void;
  /** Barva appky (Pumplo modrá, růžová, …). */
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
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

const readStoredAccent = (): AccentColor => {
  try { return asAccent(localStorage.getItem(ACCENT_KEY)); } catch { return asAccent(null); }
};

/** Barva appky = atribut na <html>; CSS [data-accent=…] přepíše --primary a odvozené proměnné. */
const applyAccent = (accent: AccentColor) => {
  document.documentElement.dataset.accent = accent;
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
  // Nastavit hned (ne až v efektu), ať při startu neprobliknu výchozí modrá.
  const [accent, setAccentState] = useState<AccentColor>(() => {
    const initial = readStoredAccent();
    applyAccent(initial);
    return initial;
  });

  const setAccent = useCallback((next: AccentColor) => {
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_KEY, next);
    } catch {
      // Volba pak nepřežije restart, ale appka běží dál.
    }
  }, []);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

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
    <ThemeContext.Provider value={{ preference, theme, setPreference, amoled, setAmoled, accent, setAccent }}>
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
