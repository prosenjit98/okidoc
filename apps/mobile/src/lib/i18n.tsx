import { translate, type I18nKey, type Language } from '@okidoc/shared';
import { getLocales } from 'react-native-localize';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { prefs } from './storage';

interface I18nValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  ready: boolean;
}

const Ctx = createContext<I18nValue>({ lang: 'en', setLang: () => {}, t: (k) => k, ready: false });

/** Device default: Bengali / Hindi when the phone is set to them, otherwise English (NFR-08). */
function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'bn' ? 'bn' : code === 'hi' ? 'hi' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [ready, setReady] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    prefs.get<Language | null>('lang', null).then((saved) => {
      setLangState(saved ?? deviceLanguage());
      setReady(true);
    });
  }, []);

  useEffect(() => {
    // Admin-managed overrides (ADM-11) on top of bundled strings.
    api<Record<string, string>>(`/i18n/${lang}`, { auth: false })
      .then(setOverrides)
      .catch(() => setOverrides({}));
  }, [lang]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    prefs.set('lang', l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, ready, t: (key, vars) => translate(lang, key, vars, overrides) }),
    [lang, setLang, ready, overrides],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;
