import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { t as translate } from "../i18n/translations";

const LanguageContext = createContext(null);
const KEY = "tcims_lang";

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(KEY);
    return saved === "fil" ? "fil" : "en";
  });

  useEffect(() => { localStorage.setItem(KEY, lang); }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    toggle: () => setLang((l) => (l === "en" ? "fil" : "en")),
    t: (key, vars) => translate(key, lang, vars),
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// Falls back to English if used outside the provider (defensive — should not happen).
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: "en", setLang: () => {}, toggle: () => {}, t: (key, vars) => translate(key, "en", vars) };
  return ctx;
}
