import i18next from 'i18next';
import { cs, enUS } from 'date-fns/locale';
import csStrings from '@/i18n/locales/cs';

/** True when the UI language is English. Reads the live i18next instance, so it works outside React. */
export const isEnglishUi = (): boolean => i18next.language === 'en';

/** BCP-47 locale for Intl / toLocale*String, following the selected UI language. */
export const uiLocaleTag = (): string => (isEnglishUi() ? 'en-GB' : 'cs-CZ');

/** date-fns locale following the selected UI language. */
export const uiDateFnsLocale = () => (isEnglishUi() ? enUS : cs);

/**
 * Translate outside React components (hooks' toasts, lib error messages).
 * Before i18next is initialised (unit tests, very early boot) it falls back to the Czech strings.
 */
export const tr = (key: string, options?: Record<string, unknown>): string => {
  if (i18next.isInitialized) return i18next.t(key, options) as string;
  const raw = (csStrings as Record<string, string>)[key] ?? key;
  return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(options?.[name] ?? ''));
};
