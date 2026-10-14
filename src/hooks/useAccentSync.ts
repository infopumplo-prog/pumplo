import { useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { isAccentColor } from '@/lib/accentColors';

/**
 * Barva appky z profilu → do motivu (fáze 2 Onboarding 2.0). Lokálně uložená barva platí hned
 * při startu; jakmile dorazí profil (např. přihlášení na novém telefonu), převezme se z něj.
 */
export const useAccentSync = () => {
  const { profile } = useUserProfile();
  const { accent, setAccent } = useTheme();
  const saved = profile?.accent_color;

  useEffect(() => {
    if (isAccentColor(saved) && saved !== accent) setAccent(saved);
    // Jen když se změní barva v profilu — ne při každé lokální změně.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
};
