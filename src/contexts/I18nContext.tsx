import React, { createContext, useContext, useState, useEffect } from 'react';
import jaDict from '../locales/ja.json';
import enDict from '../locales/en.json';

export type Language = 'ja' | 'en';

type Dictionaries = Record<string, any>;

const dicts: Record<Language, Dictionaries> = {
  ja: jaDict,
  en: enDict,
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyPath: string, defaultText?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLanguage?: Language; onLanguageChange?: (lang: Language) => void }> = ({
  children,
  initialLanguage = 'ja',
  onLanguageChange,
}) => {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    setLanguageState(initialLanguage);
  }, [initialLanguage]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  };

  const t = (keyPath: string, defaultText?: string): string => {
    const keys = keyPath.split('.');
    let current: any = dicts[language] || dicts.ja;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // フォールバック: ja辞書で再検索
        let fb: any = dicts.ja;
        for (const k of keys) {
          if (fb && typeof fb === 'object' && k in fb) {
            fb = fb[k];
          } else {
            return defaultText || keyPath;
          }
        }
        return typeof fb === 'string' ? fb : defaultText || keyPath;
      }
    }
    return typeof current === 'string' ? current : defaultText || keyPath;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
