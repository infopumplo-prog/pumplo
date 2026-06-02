import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import cs from './locales/cs';
import en from './locales/en';

const savedLang = localStorage.getItem('pumplo_lang');
const browserLang = navigator.language.startsWith('cs') || navigator.language.startsWith('sk') ? 'cs' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      en: { translation: en },
    },
    lng: savedLang || browserLang,
    fallbackLng: 'cs',
    interpolation: { escapeValue: false },
  });

export default i18n;

// Persist the chosen language to the user's profile (fire-and-forget) so the
// server-side push-notification function can localize messages per recipient.
const persistLanguageToProfile = async (lang: 'cs' | 'en') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_profiles').update({ language: lang }).eq('user_id', user.id);
  } catch {
    // Non-critical: UI language still works from localStorage even if this fails.
  }
};

export const changeLanguage = (lang: 'cs' | 'en') => {
  i18n.changeLanguage(lang);
  localStorage.setItem('pumplo_lang', lang);
  void persistLanguageToProfile(lang);
};
