/**
 * i18n Configuration
 * 
 * Internationalization setup using react-i18next.
 * Supports English, Hindi, Telugu, and Tamil with lazy loading of translations.
 * 
 * @module core/i18n
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import locale files
import enTranslations from './locales/en.json';
import hiTranslations from './locales/hi.json';
import teTranslations from './locales/te.json';
import taTranslations from './locales/ta.json';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr' as const,
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    dir: 'ltr' as const,
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    dir: 'ltr' as const,
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    dir: 'ltr' as const,
  },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

// Fallback language
export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

// Resources
const resources = {
  en: {
    translation: enTranslations,
  },
  hi: {
    translation: hiTranslations,
  },
  te: {
    translation: teTranslations,
  },
  ta: {
    translation: taTranslations,
  },
};

// Initialize i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_LANGUAGE,
    defaultNS: 'translation',
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'fuelsync_language',
      caches: ['localStorage'],
    },
    
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    
    // React options
    react: {
      useSuspense: true,
    },
  });

export default i18n;

// Helper to get current language
export const getCurrentLanguage = (): SupportedLanguage => {
  return (i18n.language || DEFAULT_LANGUAGE) as SupportedLanguage;
};

// Helper to change language
export const changeLanguage = async (lang: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(lang);
  localStorage.setItem('fuelsync_language', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = SUPPORTED_LANGUAGES[lang].dir;
};

// Helper to get available languages
export const getAvailableLanguages = () => {
  return Object.values(SUPPORTED_LANGUAGES);
};
