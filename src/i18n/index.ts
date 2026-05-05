import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
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

export const changeLanguage = (lang: 'cs' | 'en') => {
  i18n.changeLanguage(lang);
  localStorage.setItem('pumplo_lang', lang);
};
