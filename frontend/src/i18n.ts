import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

// Bilingual UI (DECISIONS D1). Default FR; remembers the visitor's choice.
const STORAGE_KEY = 'oj-lang';
const FALLBACK = 'fr';

function initialLanguage(): 'fr' | 'en' {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (saved === 'fr' || saved === 'en') return saved;
  return navigator.language?.startsWith('en') ? 'en' : FALLBACK;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: initialLanguage(),
  fallbackLng: FALLBACK,
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: 'fr' | 'en'): void {
  void i18n.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
}

export default i18n;
