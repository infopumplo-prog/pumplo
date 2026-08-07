import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Smartphone } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';

// Jednorázové představení tmavého režimu. Otevře se všem — stávajícím po
// aktualizaci i novým — a rovnou nabídne volbu, aby uživatel nemusel hledat
// v nastavení. Zvýšením verze se dá panel v budoucnu ukázat znovu.
const SEEN_KEY = 'pumplo_theme_intro';
const VERSION = 1;

const hasSeenThemeIntro = (): boolean => {
  try {
    return Number(localStorage.getItem(SEEN_KEY) || 0) >= VERSION;
  } catch {
    // Bez localStorage panel raději neotravujeme opakovaně.
    return true;
  }
};

const markThemeIntroSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, String(VERSION));
  } catch {
    /* noop */
  }
};

const OPTIONS: { value: ThemePreference; labelKey: string; icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'settings.theme_light', icon: Sun },
  { value: 'dark', labelKey: 'settings.theme_dark', icon: Moon },
  { value: 'system', labelKey: 'settings.theme_system', icon: Smartphone },
];

interface ThemeIntroSheetProps {
  /** Panel se otevře, až je na něj prostor — ne přes onboarding nebo prohlídku. */
  enabled: boolean;
}

const ThemeIntroSheet = ({ enabled }: ThemeIntroSheetProps) => {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || hasSeenThemeIntro()) return;
    // Krátká prodleva, ať panel nevyskočí do rozanimované obrazovky.
    const timer = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const close = () => {
    markThemeIntroSeen();
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DrawerContent className="px-6 pb-8">
        <div className="mx-auto w-full max-w-md pt-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Moon className="w-7 h-7 text-primary" />
          </div>

          <DrawerTitle className="text-xl font-bold text-center mb-2">
            {t('theme_intro.title')}
          </DrawerTitle>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {t('theme_intro.body')}
          </p>

          <div className="flex gap-2 mb-3">
            {OPTIONS.map(({ value, labelKey, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setPreference(value)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-xl font-medium text-xs transition-colors border ${
                  preference === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                }`}
              >
                <Icon className="w-5 h-5" />
                {t(labelKey)}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center mb-5">
            {t('theme_intro.hint')}
          </p>

          <Button className="w-full h-12 rounded-xl font-bold" onClick={close}>
            {t('theme_intro.confirm')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ThemeIntroSheet;
