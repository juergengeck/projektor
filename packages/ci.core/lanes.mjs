// packages/ci.core/lanes.mjs
/**
 * The browser lanes and how verification reaches them. Every lane runs the
 * same contract (appointment chain, cascade disclosure, automatic purchase
 * ceremony, IoM pairing); only identity and entry points differ. Both the
 * node suite runner and the smoke ceremony driver read this registry, so a
 * new lane is added here once and verified everywhere.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LANES = [
  {
    id: "amway",
    roleLabels: { manager: "Manager", seller: "Seller", customer: "Customer" },
    shareRecipient: "seller",
    title: "Demo workspace",
    ordersTab: "Purchase history",
    packageDir: "packages/amway.lab",
    route: "/amway/lab",
    entry: "/browser/lab/",
    hash: "/browser/#/lab",
    offerId: "offer-glister-1",
  },
  {
    id: "ek",
    roleLabels: { manager: "Bauleiter", seller: "Vorarbeiter", customer: "Werker" },
    shareRecipient: "Vorarbeiter",
    title: "EK lab",
    ordersTab: "Purchase history",
    packageDir: "packages/ek.lab",
    route: "/ek/lab",
    entry: "/browser/eklab/",
    hash: "/browser/#/eklab",
    offerId: "offer-ek-1",
  },
];

export function laneById(id) {
  const lane = LANES.find(entry => entry.id === id);
  if (!lane) throw new Error(`ci.core: unknown lane ${JSON.stringify(id)} (known: ${LANES.map(entry => entry.id).join(", ")}).`);
  return lane;
}
