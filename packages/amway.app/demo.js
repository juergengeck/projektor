/**
 * Demo department: a complete, internally consistent slice of Amway data
 * built only through public module APIs — the authority chain from the
 * country organisation manager down to a settled facility sale, plus a
 * certified phonebook contact and an active subscription.
 */

const ORG = "person:amway-de";
const ADMIN = "person:demo-admin";
const MANAGER = "person:demo-manager";
const SELLER = "person:demo-seller";
const CUSTOMER = "person:demo-customer";
const SELLER2 = "person:demo-seller-2";
const CUSTOMER2 = "person:demo-customer-2";
const MANAGER2 = "person:demo-manager-2";
const SELLER3 = "person:demo-seller-3";
const CUSTOMER3 = "person:demo-customer-3";

/**
 * Demo assortment inspired by the amway.de shop, as
 * [itemNumber, brand, unit, price in EUR cents, display name, category,
 * PV, BV]. PV/BV are plausible demo values, not quoted Amway figures.
 */
const DEMO_CATALOG = [
  ["NUTRILITE-DAILY", "Nutrilite", "piece", 2790, "Daily Multivitamin Tabletten", "Ernährung", 11, 30],
  ["NUTRILITE-DOUBLE-X", "Nutrilite", "piece", 9650, "Double X Multivitamin Tabletten", "Ernährung", 42, 108],
  ["NUTRILITE-VITAMIN-C", "Nutrilite", "piece", 3690, "Vitamin C Plus Tabletten", "Ernährung", 15, 41],
  ["NUTRILITE-OMEGA-3", "Nutrilite", "piece", 3250, "Omega-3 Complex Kapseln", "Ernährung", 13.5, 36],
  ["NUTRILITE-PROTEIN-VANILLE", "Nutrilite", "piece", 4600, "All Plant Protein Pulver Vanille", "Ernährung", 19, 52],
  ["NUTRILITE-CALCIUM-MAGNESIUM-D", "Nutrilite", "piece", 2490, "Calcium Magnesium D Plus Tabletten", "Ernährung", 10, 28],
  ["NUTRILITE-VITAMIN-B-PLUS", "Nutrilite", "piece", 2990, "Vitamin B Plus Tabletten", "Ernährung", 12.5, 33],
  ["NUTRILITE-ECHINACEA-PLUS", "Nutrilite", "piece", 2250, "Echinacea Plus Tabletten", "Ernährung", 9.5, 25],
  ["BODYKEY-SHAKE-VANILLE", "bodykey by Nutrilite", "piece", 4450, "Mahlzeitenersatz Shake Vanille", "Ernährung", 20, 48],
  ["BODYKEY-SHAKE-SCHOKO", "bodykey by Nutrilite", "piece", 4450, "Mahlzeitenersatz Shake Schoko", "Ernährung", 20, 48],
  ["BODYKEY-KRAEUTERTEE", "bodykey by Nutrilite", "piece", 1990, "Kräutertee", "Ernährung", 8.5, 22],
  ["ARTISTRY-SN-AKTIVIERUNGSCREME", "Artistry", "piece", 9800, "Skin Nutrition Erneuernde Aktivierungscreme", "Schönheit", 55, 112],
  ["ARTISTRY-SN-VITAMIN-C-SERUM", "Artistry", "piece", 8900, "Skin Nutrition Vitamin C + HA3 Tages Serum", "Schönheit", 50, 102],
  ["ARTISTRY-EXACT-FIT-MAKEUP", "Artistry", "piece", 4650, "Exact Fit Make-up", "Schönheit", 26, 53],
  ["ARTISTRY-SUPREME-LX-CREME", "Artistry", "piece", 21500, "Supreme LX Regenerierende Creme", "Schönheit", 120, 246],
  ["ARTISTRY-STUDIO-GLOW", "Artistry", "piece", 2800, "Studio Glow Finish", "Schönheit", 15.5, 32],
  ["AMWAY-HOME-LOC-1L", "Amway Home", "piece", 1490, "L.O.C. Mehrzweckreiniger 1 L", "Haushalt", 8, 17],
  ["AMWAY-HOME-SA8-1L", "Amway Home", "piece", 3150, "SA8 Flüssigwaschmittel konzentriert 1 L", "Haushalt", 17, 36],
  ["AMWAY-HOME-DISH-DROPS-1L", "Amway Home", "piece", 1190, "Dish Drops Spülmittel konzentriert 1 L", "Haushalt", 6.5, 13.5],
  ["AMWAY-HOME-LOC-KUECHE", "Amway Home", "piece", 990, "L.O.C. Küchenreiniger 500 ml", "Haushalt", 5.5, 11],
  ["AMWAY-HOME-SA8-PREWASH", "Amway Home", "piece", 1250, "SA8 Vorwaschspray 400 ml", "Haushalt", 7, 14],
  ["ICOOK-KOCHTOPF-4L", "iCook", "piece", 28900, "iCook Kochtopf 4 L", "Küche", 160, 330],
  ["ICOOK-PFANNE-24CM", "iCook", "piece", 19900, "iCook Bratpfanne 24 cm", "Küche", 110, 227],
  ["ESPRING-FILTER-UV", "eSpring", "piece", 23900, "eSpring Filterkartusche + UV-Lampe", "Wasser & Luft", 135, 273],
  ["ATMOSPHERE-SKY-FILTER", "Atmosphere Sky", "piece", 8900, "Atmosphere Sky Filter", "Wasser & Luft", 50, 102],
  ["GLISTER-100", "Glister", "piece", 10000, "Glister Multi-Action Zahncreme", "Mundpflege", 55, 114],
  ["GLISTER-MUNDSPUELUNG", "Glister", "piece", 1850, "Glister Mundspülung Konzentrat", "Mundpflege", 10, 21],
  ["SATINIQUE-200", "Satinique", "piece", 15500, "Satinique Repair Set", "Haarpflege", 86, 177],
  ["SATINIQUE-SHAMPOO-280", "Satinique", "piece", 1690, "Satinique Repair Shampoo 280 ml", "Haarpflege", 9.5, 19],
  ["SATINIQUE-SPUELUNG-250", "Satinique", "piece", 1790, "Satinique Repair Spülung 250 ml", "Haarpflege", 10, 20],
  ["XS-POWER-TROPICAL-12ER", "XS", "pack", 2990, "XS Power Drink Tropical Blast 12er", "Energie", 13, 34],
  ["XS-FUEL-RIEGEL-CAFFE-LATTE", "XS", "pack", 1990, "XS Fuel Snack Riegel Café Latte 6er", "Energie", 8.5, 22.5],
  ["GH-COMPLEXION-SEIFE", "G&H", "piece", 890, "G&H Complexion Seifenstück", "Körperpflege", 5, 10],
  ["GH-BODY-LOTION-400", "G&H", "piece", 1950, "G&H Body Lotion 400 ml", "Körperpflege", 11, 22],
];

export function buildDemoDepartment(modules, { atTime = Date.now() } = {}) {
  const { directory, phonebook, shop, lifecycle, subscriptions } = modules;
  if (directory.departments.has("demo-de")) return { department: "demo-de", replayed: true };

  directory.bootstrapIssuers.add(ORG);
  const department = directory.createDepartment({
    id: "demo-de", name: "Demo Deutschland", manager: MANAGER, createdBy: ORG, createdAt: atTime,
  });
  directory.assignRole({ issuer: ORG, subject: ADMIN, role: "admin", department: "demo-de", validFrom: atTime });
  directory.assignRole({ issuer: MANAGER, subject: SELLER, role: "seller", department: "demo-de", validFrom: atTime });
  directory.assignRole({ issuer: MANAGER, subject: SELLER2, role: "seller", department: "demo-de", validFrom: atTime });
  directory.assignRole({ issuer: MANAGER, subject: CUSTOMER, role: "customer", department: "demo-de", validFrom: atTime });
  directory.assignRole({ issuer: MANAGER, subject: CUSTOMER2, role: "customer", department: "demo-de", validFrom: atTime });
  directory.grantContract({
    issuer: MANAGER, holder: CUSTOMER, contact: SELLER,
    purpose: "order-support", department: "demo-de", validFrom: atTime,
  });
  directory.grantContract({
    issuer: MANAGER, holder: CUSTOMER2, contact: SELLER2,
    purpose: "order-support", department: "demo-de", validFrom: atTime,
  });

  // A second department under the same country organisation manager, with
  // its own manager-owned phonebook and member chain.
  const west = directory.createDepartment({
    id: "demo-de-west", name: "Demo West", manager: MANAGER2, createdBy: ORG, createdAt: atTime,
  });
  directory.assignRole({ issuer: MANAGER2, subject: SELLER3, role: "seller", department: "demo-de-west", validFrom: atTime });
  directory.assignRole({ issuer: MANAGER2, subject: CUSTOMER3, role: "customer", department: "demo-de-west", validFrom: atTime });
  directory.grantContract({
    issuer: MANAGER2, holder: CUSTOMER3, contact: SELLER3,
    purpose: "order-support", department: "demo-de-west", validFrom: atTime,
  });

  // Every member gets a published, certified contact so views can show
  // names instead of raw identity refs. Sellers are granted into the
  // customer-visible phonebook of their own department.
  const certifiedByPerson = new Map();
  for (const [person, name, role, dept] of [
    [MANAGER, "Maria Manager", "manager", "demo-de"],
    [ADMIN, "Anna Admin", "admin", "demo-de"],
    [SELLER, "Selma Seller", "seller", "demo-de"],
    [SELLER2, "Ben Berater", "seller", "demo-de"],
    [CUSTOMER, "Cora Customer", "customer", "demo-de"],
    [CUSTOMER2, "Karla Kunde", "customer", "demo-de"],
    [MANAGER2, "Markus Manager", "manager", "demo-de-west"],
    [SELLER3, "Sven Seller", "seller", "demo-de-west"],
    [CUSTOMER3, "Clara Customer", "customer", "demo-de-west"],
  ]) {
    const publishedContact = phonebook.publishContact({
      publisher: role === "customer" ? (dept === "demo-de" ? MANAGER : MANAGER2) : person,
      person, name, department: dept, role,
    });
    const assignment = [...directory.assignments.values()]
      .find(entry => entry.subject === person && entry.department === dept);
    const certifiedContact = phonebook.certifyContact({
      publishedContact: publishedContact.id, roleSubject: person, certRoot: assignment.id,
    });
    certifiedByPerson.set(person, certifiedContact);
  }
  const book = phonebook.createPhoneBook({ department: "demo-de", owner: MANAGER });
  for (const seller of [SELLER, SELLER2]) {
    phonebook.addEntry({ phonebook: book.id, certifiedContact: certifiedByPerson.get(seller).id });
  }
  for (const customer of [CUSTOMER, CUSTOMER2]) {
    phonebook.grantAccess({ phonebook: book.id, contact: customer, grantedBy: MANAGER });
  }
  const westBook = phonebook.createPhoneBook({ department: "demo-de-west", owner: MANAGER2 });
  phonebook.addEntry({ phonebook: westBook.id, certifiedContact: certifiedByPerson.get(SELLER3).id });
  phonebook.grantAccess({ phonebook: westBook.id, contact: CUSTOMER3, grantedBy: MANAGER2 });

  // Full demo assortment modelled on the amway.de shop: Nutrilite and
  // bodykey for nutrition, Artistry for beauty, Amway Home (L.O.C., SA8,
  // Dish Drops) for home care, plus iCook, eSpring, Atmosphere Sky,
  // Glister, Satinique, XS, and G&H. Prices are EUR cents.
  const prices = {};
  for (const [itemNumber, brand, unit, price, name, category, pv, bv] of DEMO_CATALOG) {
    shop.catalog.registerItem(
      { itemNumber, brand, market: "DE", language: "de", unit, name, category, pv, bv },
      { version: "1" },
    );
    prices[itemNumber] = price;
  }
  shop.catalog.publishPriceList({
    id: "demo-retail", version: "2026-09", currency: "EUR", prices,
  });
  for (const [itemNumber] of DEMO_CATALOG) {
    shop.catalog.publishOffer({
      id: itemNumber === "GLISTER-100" ? "demo-offer-glister" : `demo-offer-${itemNumber.toLowerCase()}`,
      item: `${itemNumber}@1`,
      priceList: "demo-retail@2026-09", channel: "facility",
    });
  }

  const projection = [{ lot: "demo-lot-a", location: "demo-facility", quantity: 10 }];
  const order = shop.admitTransaction({
    channel: "facility", seller: SELLER, customer: CUSTOMER,
    department: "demo-de", facility: "demo-facility",
    lines: [{ offer: "demo-offer-glister", quantity: 2 }],
    terms: { id: "demo-terms", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "demo-order-1",
  });
  lifecycle.reserve({
    expectedVersion: lifecycle.version, transactionId: order.id, lot: "demo-lot-a",
    quantity: 2, facility: "demo-facility", stockProjection: projection,
  });
  lifecycle.accept({ expectedVersion: lifecycle.version, transactionId: order.id });
  lifecycle.fulfil({
    expectedVersion: lifecycle.version, transactionId: order.id,
    movementRef: "demo-move-1", titleRef: "demo-title-1", invoiceRef: "demo-inv-1",
  });
  lifecycle.recognize({ expectedVersion: lifecycle.version, transactionId: order.id, amount: 20000 });
  lifecycle.settle({
    expectedVersion: lifecycle.version, transactionId: order.id,
    paymentRef: "demo-pay-1", amount: 20000,
  });

  // A second, larger basket across nutrition, home care, and XS: reserved
  // from three facility lots and accepted, but not yet fulfilled. Its
  // reservations stay held, so the inventory view shows live stock holds
  // next to the consumed reservation of the settled sale.
  const stock = [
    { lot: "demo-lot-nutrilite", location: "demo-facility", quantity: 40 },
    { lot: "demo-lot-home", location: "demo-facility", quantity: 60 },
    { lot: "demo-lot-xs", location: "demo-facility", quantity: 48 },
  ];
  const secondOrder = shop.admitTransaction({
    channel: "facility", seller: SELLER2, customer: CUSTOMER2,
    department: "demo-de", facility: "demo-facility",
    lines: [
      { offer: "demo-offer-nutrilite-double-x", quantity: 1 },
      { offer: "demo-offer-amway-home-loc-1l", quantity: 2 },
      { offer: "demo-offer-xs-power-tropical-12er", quantity: 1 },
    ],
    terms: { id: "demo-terms", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "demo-order-2",
  });
  lifecycle.reserve({
    expectedVersion: lifecycle.version, transactionId: secondOrder.id, lot: "demo-lot-nutrilite",
    quantity: 1, facility: "demo-facility", stockProjection: stock,
  });
  lifecycle.reserve({
    expectedVersion: lifecycle.version, transactionId: secondOrder.id, lot: "demo-lot-home",
    quantity: 2, facility: "demo-facility", stockProjection: stock,
  });
  lifecycle.reserve({
    expectedVersion: lifecycle.version, transactionId: secondOrder.id, lot: "demo-lot-xs",
    quantity: 1, facility: "demo-facility", stockProjection: stock,
  });
  lifecycle.accept({ expectedVersion: lifecycle.version, transactionId: secondOrder.id });

  // The west household shops hair and body care from its own seller. One
  // lot, accepted but not yet fulfilled.
  const westStock = [{ lot: "demo-lot-west", location: "demo-facility-west", quantity: 20 }];
  const westOrder = shop.admitTransaction({
    channel: "facility", seller: SELLER3, customer: CUSTOMER3,
    department: "demo-de-west", facility: "demo-facility-west",
    lines: [
      { offer: "demo-offer-satinique-shampoo-280", quantity: 2 },
      { offer: "demo-offer-gh-complexion-seife", quantity: 1 },
    ],
    terms: { id: "demo-terms", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "demo-order-3",
  });
  lifecycle.reserve({
    expectedVersion: lifecycle.version, transactionId: westOrder.id, lot: "demo-lot-west",
    quantity: 3, facility: "demo-facility-west", stockProjection: westStock,
  });
  lifecycle.accept({ expectedVersion: lifecycle.version, transactionId: westOrder.id });

  let subscription = null;
  let secondSubscription = null;
  if (subscriptions) {
    subscription = subscriptions.subscribe({
      customer: CUSTOMER, department: "demo-de",
      lines: [{ offer: "demo-offer-glister", quantity: 1 }],
      schedule: { interval: "monthly" },
      authorization: { id: "demo-auth-1", method: "sepa-mandate" },
      externalRef: "demo-sub-1",
      benefitPolicy: { version: "2026-09" },
    });
    secondSubscription = subscriptions.subscribe({
      customer: CUSTOMER2, department: "demo-de",
      lines: [{ offer: "demo-offer-bodykey-shake-vanille", quantity: 1 }],
      schedule: { interval: "monthly" },
      authorization: { id: "demo-auth-2", method: "sepa-mandate" },
      externalRef: "demo-sub-2",
      benefitPolicy: { version: "2026-09" },
    });
  }

  return {
    department: department.id,
    west: west.id,
    manager: MANAGER,
    order: order.id,
    secondOrder: secondOrder.id,
    westOrder: westOrder.id,
    catalogItems: DEMO_CATALOG.length,
    subscription: subscription?.id ?? null,
    secondSubscription: secondSubscription?.id ?? null,
    replayed: false,
  };
}
