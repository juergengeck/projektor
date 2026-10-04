// packages/ci.core/lanes.mjs
/**
 * The browser lanes and how verification reaches them. Every lane runs the
 * same contract (cascade disclosure, automatic purchase ceremony, IoM
 * pairing); EK and IGM appointments are admin-only while Amway keeps its chain. Both the
 * node suite runner and the smoke ceremony driver read this registry, so a
 * new lane is added here once and verified everywhere.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LANES = [
  {
    id: "amway",
    appointmentAuthority: "chain",
    roleLabels: { manager: "Manager", seller: "Seller", customer: "Customer" },
    shareRecipient: "seller",
    title: "Demo workspace",
    ordersTab: "Purchase history",
    packageDir: "packages/lab.core",
    route: "/amway/lab",
    entry: "/lab/amway",
    hash: "/browser/#/lab",
    offerId: "offer-glister-1",
    offerButton: "+ Offer (100.00€)",
  },
  {
    id: "ek",
    appointmentAuthority: "admin",
    roleLabels: { manager: "Bauleiter", seller: "Vorarbeiter", customer: "Werker" },
    shareRecipient: "Vorarbeiter",
    title: "EK lab",
    ordersTab: "Purchase history",
    packageDir: "packages/lab.core",
    route: "/ek/lab",
    entry: "/lab/ek",
    hash: "/browser/#/eklab",
    offerId: "offer-ek-1",
    offerButton: "+ Offer (100.00€)",
  },
  {
    id: "igm",
    appointmentButtons: { manager: "Bauleiter zuweisen", seller: "Vorarbeiter zuweisen", customer: "Monteur zuweisen" },
    appointmentAuthority: "admin",
    roleLabels: { manager: "Bauleiter", seller: "Vorarbeiter", customer: "Monteur" },
    shareRecipient: "Vorarbeiter",
    title: "IGM lab",
    ordersTab: "Acceptance history",
    customerAction: "Accept",
    confirmedState: "Accepted",
    packageDir: "packages/lab.core",
    route: "/igm/lab",
    entry: "/lab/igm",
    hash: "/browser/#/igmlab",
    offerId: "offer-igm-1",
    offerButton: "+ Facade element (100.00€)",
  },
];

export function laneById(id) {
  const lane = LANES.find(entry => entry.id === id);
  if (!lane) throw new Error(`ci.core: unknown lane ${JSON.stringify(id)} (known: ${LANES.map(entry => entry.id).join(", ")}).`);
  return lane;
}
