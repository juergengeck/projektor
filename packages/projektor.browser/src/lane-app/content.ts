// packages/projektor.browser/src/lane-app/content.ts
/**
 * Every user-visible string and catalog item of a lane app, in one place.
 * The screens take a LaneContent and never branch on the lane: the EK
 * content plugs into the same shape in Task 13.
 */
export interface CatalogItem {
  idPrefix: string;
  item: string;
  priceList: string;
  unitAmount: number;
  currency: string;
  button: string;
}

export interface LaneContent {
  laneClass: string;
  roleTitles: Record<string, string>;
  roleIcons: Record<string, string>;
  appoint: Record<string, string>;
  actionsTitle: string;
  catalog: CatalogItem[];
  shareDown: (offerId: string) => string;
  shareWithSeller: (offerId: string) => string;
  buyOne: (offerId: string) => string;
  buying: string;
  metrics: { contacts: string; offers: string; orders: string; purchases: string; availAdmin: string; stock: string };
  tabs: { overview: string; offers: string; orders: string; purchases: string; contacts: string; activity: string };
  catalogTitle: string;
  activeSuffix: string;
  ordersTitle: string;
  purchaseHistoryTitle: string;
  balancesTitle: string;
  partiesSuffix: string;
  directoryTitle: string;
  verifiedSuffix: string;
  feedTitle: string;
  lastEvents: (count: number) => string;
  orderCount: (count: number, customer: boolean) => string;
  empty: {
    offers: string;
    orders: string;
    purchases: string;
    contacts: string;
    feed: string;
    balances: string;
    team: string;
  };
  telemetryTitle: string;
  ordersMembers: (orders: number, members: number) => string;
  facilityStock: string;
  networkAvailability: string;
  stockUnits: (current: number, total: number) => string;
  customerOrders: (orders: number, units: number) => string;
  auditTitle: (count: number) => string;
  contactField: { namePlaceholder: string; rolePlaceholder: string; save: string; update: string; title: string };
  stockField: { receiptPlaceholder: string; quantityLabel: string; save: string; title: string };
  chat: {
    messageLabel: (peerName: string) => string;
    openChat: (peerName: string) => string;
    send: string;
    close: string;
    empty: string;
    you: string;
    title: (peerName: string) => string;
  };
  waitingForHost: string;
}

export const AMWAY_CONTENT: LaneContent = {
  laneClass: "amway-lane",
  roleTitles: { admin: "Org Admin", manager: "Manager", seller: "Seller", customer: "Customer" },
  roleIcons: { admin: "🏛️", manager: "🏢", seller: "💼", customer: "👤" },
  appoint: { manager: "Appoint Manager", seller: "Appoint Seller", customer: "Appoint Customer" },
  actionsTitle: "⚡ Actions",
  catalog: [
    { idPrefix: "offer-glister", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR", button: "+ Offer (100.00€)" },
    { idPrefix: "offer-nutrilite", item: "NUTRILITE-DAILY@1", priceList: "demo-retail@2026-09", unitAmount: 4500, currency: "EUR", button: "+ Offer (45.00€)" },
  ],
  shareDown: offerId => `Share ${offerId} down`,
  shareWithSeller: offerId => `Share ${offerId} with seller`,
  buyOne: offerId => `Buy 1x (${offerId})`,
  buying: "Processing purchase…",
  metrics: { contacts: "Contacts", offers: "Offers", orders: "Orders", purchases: "Purchases", availAdmin: "Avail.", stock: "Stock" },
  tabs: { overview: "All Items", offers: "Offers", orders: "Orders", purchases: "Purchase history", contacts: "Contacts", activity: "CHUM Feed" },
  catalogTitle: "Catalog Offers",
  activeSuffix: " active",
  ordersTitle: "Orders & Reservations",
  purchaseHistoryTitle: "Purchase history",
  balancesTitle: "Balances",
  partiesSuffix: " parties",
  directoryTitle: "Directory Contacts",
  verifiedSuffix: " verified",
  feedTitle: "CHUM Ingress Stream",
  lastEvents: count => `Last ${count} events`,
  orderCount: (count, customer) => `${count} ${customer ? (count === 1 ? "purchase" : "purchases") : (count === 1 ? "order" : "orders")}`,
  empty: {
    offers: "No offers replicated yet.",
    orders: "No orders placed.",
    purchases: "No purchases yet.",
    contacts: "No directory contacts.",
    feed: "No CHUM events recorded yet.",
    balances: "No receivables or payables yet.",
    team: "No team assignments replicated yet.",
  },
  telemetryTitle: "Network telemetry",
  ordersMembers: (orders, members) => `${orders} orders · ${members} members`,
  facilityStock: "Facility Stock",
  networkAvailability: "Network availability",
  stockUnits: (current, total) => `${current} / ${total} units`,
  customerOrders: (orders, units) => `${orders} order${orders === 1 ? "" : "s"} · ${units} units`,
  auditTitle: count => `⚠️ ${count} Access Denials / Ingress Rejections`,
  contactField: {
    namePlaceholder: "Display name",
    rolePlaceholder: "Role (admin, manager, seller, customer)",
    save: "Save name",
    update: "Update name",
    title: "Publish contact name",
  },
  stockField: {
    receiptPlaceholder: "Receipt ID",
    quantityLabel: "Quantity",
    save: "Receive stock",
    title: "Receive purchased goods",
  },
  chat: {
    messageLabel: peerName => `Message ${peerName}`,
    openChat: peerName => `Open chat with ${peerName}`,
    send: "Send",
    close: "Close chat",
    empty: "No messages yet. Say hello!",
    you: "You",
    title: peerName => `Chat with ${peerName}`,
  },
  waitingForHost: "Waiting for the lane host to sign in…",
};

/**
 * Elektro Klein lane: English chrome like the EK fork had, with German role
 * titles (Bauleiter/Vorarbeiter/Werker) and the EK catalog. Only the strings
 * the fork localized differ from AMWAY_CONTENT.
 */
export const EK_CONTENT: LaneContent = {
  ...AMWAY_CONTENT,
  laneClass: "ek-lane",
  roleTitles: { admin: "Klein", manager: "Bauleiter", seller: "Vorarbeiter", customer: "Werker" },
  appoint: { manager: "Appoint Bauleiter", seller: "Appoint Vorarbeiter", customer: "Appoint Werker" },
  catalog: [
    { idPrefix: "offer-ek", item: "BMA-WARTUNG@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR", button: "+ Offer (100.00€)" },
    { idPrefix: "offer-nutrilite", item: "NUTRILITE-DAILY@1", priceList: "demo-retail@2026-09", unitAmount: 4500, currency: "EUR", button: "+ Offer (45.00€)" },
  ],
  shareWithSeller: offerId => `Share ${offerId} with Vorarbeiter`,
};
