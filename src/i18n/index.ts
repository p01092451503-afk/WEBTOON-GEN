import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import ko from "./locales/ko.json";

export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        ko: { translation: ko },
      },
      fallbackLng: "en",
      supportedLngs: LANGS as unknown as string[],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "toonpilot:lang",
        caches: ["localStorage"],
      },
      react: { useSuspense: false },
    });
}

export default i18n;
