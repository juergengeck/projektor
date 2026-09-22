// packages/projektor.browser/src/lane-app/format.ts
/** Presentation helpers shared by the lane screens. */
import type { Contact } from "./feed.ts";

export function nameOf(contacts: Contact[], person: string): string {
  return contacts.find(entry => entry.person === person)?.name ?? `${person.slice(0, 10)}…`;
}

export function shortId(person: string): string {
  return `${person.slice(0, 10)}…${person.slice(-4)}`;
}

export function fmtDate(at: number): string {
  return new Date(at).toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function fmtMoney(value: number, currency: string): string {
  return `${(value / 100).toFixed(2)} ${currency}`;
}
