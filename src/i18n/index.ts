import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

// English-only platform: no language detection, no switching.
export const LANGS = ["en"] as const;
export type Lang = (typeof LANGS)[number];

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
