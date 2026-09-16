import { useSyncExternalStore } from "react";
import { AMWAY_LANGUAGES, languageKeys, translate } from "@projektor/amway/i18n.js";
import { LANG_KEY, THEME_KEY } from "./api";

let version = 0;
const listeners = new Set<() => void>();
function bump() {
  version += 1;
  for (const listener of listeners) listener();
}

export function language(): string {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored && AMWAY_LANGUAGES.includes(stored)) return stored;
  const browser = (navigator.language || "").slice(0, 2).toLowerCase();
  return AMWAY_LANGUAGES.includes(browser) ? browser : "de";
}

export function setLanguage(lang: string) {
  if (!AMWAY_LANGUAGES.includes(lang)) throw new Error(`Unknown language ${lang}.`);
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  bump();
}

export function theme(): string {
  return localStorage.getItem(THEME_KEY) || "system";
}

export function applyTheme() {
  const selected = theme();
  const dark = selected === "dark" ||
    (selected === "system" && typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useLang(): string {
  useSyncExternalStore(
    callback => {
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    },
    () => version,
  );
  return language();
}

export const t = (key: string): string => translate(language(), key);

export function personLabel(names: Record<string, { name?: string; organization?: boolean }> | undefined, id: string): string {
  const entry = names?.[id];
  if (entry?.name) return entry.name;
  if (entry?.organization) return `${id} (${t("trust.orgManager")})`;
  return id || "—";
}

export function formatJournalTime(atTime: number): string {
  return Number.isFinite(atTime) && atTime > 0
    ? new Date(atTime).toLocaleString(language())
    : String(atTime ?? "");
}

export function journalTitle(names: Record<string, { name?: string; organization?: boolean }> | undefined, entry: Record<string, unknown>): string {
  const key = `journal.${entry.type}`;
  if (!languageKeys(language()).includes(key)) return String(entry.type);
  const params: Record<string, string> = {
    department: String(entry.department ?? ""),
    manager: personLabel(names, String(entry.manager ?? "")),
    role: String(entry.role ?? ""),
    subject: personLabel(names, String(entry.subject ?? "")),
    issuer: personLabel(names, String(entry.issuer ?? "")),
    holder: personLabel(names, String(entry.holder ?? "")),
    contact: personLabel(names, String(entry.contact ?? "")),
    person: personLabel(names, String(entry.person ?? "")),
    lot: String(entry.lot ?? ""),
    quantity: entry.quantity === undefined ? "" : String(entry.quantity),
    transaction: String(entry.transactionId ?? entry.transaction ?? ""),
    amount: entry.amountText !== undefined && entry.amountText !== null
      ? String(entry.amountText)
      : (entry.amount === undefined ? "" : String(entry.amount)),
  };
  return t(key).replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`);
}
