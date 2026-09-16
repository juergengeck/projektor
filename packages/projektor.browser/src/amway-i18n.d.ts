declare module "@projektor/amway/i18n.js" {
  export const AMWAY_LANGUAGES: string[];
  export function translate(lang: string, key: string): string;
  export function languageKeys(lang: string): string[];
}
