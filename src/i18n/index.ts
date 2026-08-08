import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ko from "./locales/ko.json";

export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  ko: "한국어",
};

const STORAGE_KEY = "pilottoon.lang";

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch {
    /* ignore */
  }
  const nav = window.navigator?.language?.toLowerCase() ?? "";
  return nav.startsWith("ko") ? "ko" : "en";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

/** 브라우저에서만 저장된/감지된 언어를 적용해 SSR 하이드레이션 불일치를 피한다. */
export function initClientLanguage() {
  const lang = detectLang();
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang);
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export default i18n;
