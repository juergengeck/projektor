import { AMWAY_LANGUAGES, languageKeys, translate } from "../i18n.js";

const $ = selector => document.querySelector(selector);
const LANG_KEY = "amway.lang";
const THEME_KEY = "amway.theme";
const EMAIL_KEY = "amway.email";
const REMEMBER_KEY = "amway.remember";

const SCREENS = [
  "overview", "people", "chat", "products", "orders",
  "inventory", "earnings", "returns", "journal", "settings",
];

// Settings lives behind the cog in the lower right, not in the nav.
const NAV_SCREENS = SCREENS.filter(id => id !== "settings");

function language() {
  const stored = localStorage.getItem(LANG_KEY);
  if (AMWAY_LANGUAGES.includes(stored)) return stored;
  const browser = (navigator.language || "").slice(0, 2).toLowerCase();
  return AMWAY_LANGUAGES.includes(browser) ? browser : "de";
}

function setLanguage(lang) {
  if (!AMWAY_LANGUAGES.includes(lang)) throw new Error(`Unknown language ${lang}.`);
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
}

function theme() {
  const stored = localStorage.getItem(THEME_KEY);
  return ["light", "dark", "system"].includes(stored) ? stored : "system";
}

function effectiveTheme() {
  const selected = theme();
  if (selected !== "system") return selected;
  if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme() {
  document.documentElement.dataset.theme = effectiveTheme();
}

const t = key => translate(language(), key);

function message(text, isSuccess = false) {
  const el = $("#message");
  if (!el) return;
  el.textContent = text;
  if (isSuccess) el.classList.add("is-success");
  else el.classList.remove("is-success");
}

function showError(error) {
  if (error?.code) {
    try {
      message(translate(language(), error.code));
      return;
    } catch { /* fall through to server message */ }
  }
  message(error?.message ?? "");
}

async function request(path, params) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    const error = new Error(
      typeof result.error === "string" ? result.error : result.error?.message || "The operation failed.",
    );
    error.status = response.status;
    if (result.code) error.code = result.code;
    throw error;
  }
  return result;
}

async function operation(method, params = {}) {
  const result = await request(`/api/amway/${method}`, params);
  return result.product;
}

function currentScreen() {
  const hash = location.hash.replace(/^#\/?/, "");
  return SCREENS.includes(hash) ? hash : "overview";
}

function currentDepartment() {
  return localStorage.getItem("amway.department") || "";
}

function textElement(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function badge(text, variant = "neutral", withDot = false) {
  const span = document.createElement("span");
  span.className = `badge badge-${variant}`;
  if (withDot) {
    const dot = document.createElement("span");
    dot.className = "badge-dot";
    span.append(dot);
  }
  span.append(document.createTextNode(text));
  return span;
}

function categoryBadge(category) {
  const cat = String(category || "").toLowerCase();
  let variant = "neutral";
  if (cat.includes("ernährung") || cat.includes("nutri")) variant = "category-nutrition";
  else if (cat.includes("schönheit") || cat.includes("beauty") || cat.includes("artistry")) variant = "category-beauty";
  else if (cat.includes("haushalt") || cat.includes("home") || cat.includes("spring") || cat.includes("atmosphere")) variant = "category-home";
  return badge(category || "—", variant);
}

function statusBadge(status) {
  const stat = String(status || "").toLowerCase();
  let variant = "neutral";
  let label = status;
  if (stat === "fulfilled" || stat === "settled" || stat === "active" || stat === "certified" || stat === "complete" || stat === "consumed") {
    variant = "success";
    if (stat === "fulfilled") label = t("badge.fulfilled");
    else if (stat === "active") label = t("badge.active");
    else if (stat === "consumed") label = t("badge.consumed");
  } else if (stat === "accepted" || stat === "held") {
    variant = "info";
    if (stat === "accepted") label = t("badge.accepted");
    else if (stat === "held") label = t("badge.held");
  } else if (stat === "pending" || stat === "unverified") {
    variant = "warning";
    if (stat === "pending") label = t("badge.pending");
  } else if (stat === "revoked" || stat === "denied" || stat === "cancelled") {
    variant = "danger";
    if (stat === "revoked") label = t("badge.revoked");
  }
  return badge(label, variant, variant === "success");
}

function roleBadge(role) {
  let variant = "neutral";
  if (role === "manager") variant = "accent";
  else if (role === "seller") variant = "info";
  else if (role === "admin") variant = "warning";
  else if (role === "customer") variant = "success";
  return badge(role, variant);
}

function metricCard(label, value, sub = "", accent = "") {
  const card = document.createElement("div");
  card.className = `metric-card ${accent ? `accent-${accent}` : ""}`;
  const labelEl = textElement("div", label, "metric-label");
  const valEl = textElement("div", value, "metric-value");
  card.append(labelEl, valEl);
  if (sub) {
    const subEl = textElement("div", sub, "metric-sub");
    card.append(subEl);
  }
  return card;
}

function languageSelect() {
  const select = document.createElement("select");
  select.setAttribute("aria-label", t("lang.label"));
  for (const lang of AMWAY_LANGUAGES) {
    select.append(new Option({ de: "Deutsch (DE)", en: "English (EN)", fr: "Français (FR)" }[lang], lang));
  }
  select.value = language();
  select.onchange = () => { setLanguage(select.value); render(); };
  return select;
}

function renderNav(screen) {
  document.title = t("app.title");
  $("#main-nav").setAttribute("aria-label", t("nav.label"));
  $("#main-nav").replaceChildren(...NAV_SCREENS.map(id => {
    const link = textElement("a", t(`nav.${id}`));
    link.href = `#/${id}`;
    if (id === screen) link.setAttribute("aria-current", "page");
    return link;
  }));
  const cog = $("#settings-cog");
  cog.setAttribute("aria-label", t("settings.title"));
  cog.title = t("settings.title");
  if (screen === "settings") cog.setAttribute("aria-current", "page");
  else cog.removeAttribute("aria-current");
  cog.onclick = () => { location.hash = "#/settings"; };
}

async function renderScopeBanner() {
  const banner = $("#scope-banner");
  const department = currentDepartment();
  banner.replaceChildren();

  const content = textElement("div", "", "scope-content");
  const controls = textElement("div", "", "scope-controls");

  if (!department) {
    content.append(
      badge(t("scope.none"), "warning"),
      textElement("span", t("scope.hint"), "scope-hint-text"),
    );

    const input = document.createElement("input");
    input.id = "department-input";
    input.placeholder = t("scope.placeholder");
    input.setAttribute("aria-label", t("scope.department"));

    const save = textElement("button", t("scope.select"));
    save.onclick = async () => {
      const value = input.value.trim();
      if (!value) { message(t("scope.missing")); return; }
      try {
        await operation("selectDepartment", { department: value });
        localStorage.setItem("amway.department", value);
        message("");
        render();
      } catch (error) { showError(error); }
    };

    controls.append(input, save);

    // Fetch registered departments for quick select
    try {
      const scopeData = await operation("getScope", {});
      if (scopeData?.departments?.length) {
        const chipsContainer = textElement("div", "", "scope-quick-chips");
        chipsContainer.append(textElement("span", t("scope.quickSelect"), "scope-hint-text"));
        for (const dept of scopeData.departments) {
          const chip = textElement("button", dept.name || dept.id, "scope-chip");
          chip.type = "button";
          chip.onclick = async () => {
            try {
              await operation("selectDepartment", { department: dept.id });
              localStorage.setItem("amway.department", dept.id);
              message("");
              render();
            } catch (err) { showError(err); }
          };
          chipsContainer.append(chip);
        }
        controls.append(chipsContainer);
      }
    } catch { /* best effort */ }
  } else {
    content.append(
      textElement("span", `${t("scope.active")}:`, "scope-hint-text"),
      textElement("span", `🏢 ${department}`, "scope-pill"),
    );

    const change = textElement("button", t("scope.change"), "secondary sm");
    change.onclick = () => { localStorage.removeItem("amway.department"); render(); };
    controls.append(change);
  }

  banner.append(content, controls);
}

function dataTable(headers, rows, options = {}) {
  const container = textElement("div", "", "table-wrap");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  for (const header of headers) {
    const th = textElement("th", header);
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      const td = document.createElement("td");
      if (cell instanceof HTMLElement) {
        td.append(cell);
      } else {
        const text = String(cell ?? "");
        td.textContent = text;
        if (/^[\d,.\s]+(\s?[A-Z]{3}|%)?$/.test(text.trim()) && !text.includes("-") && text.trim().length > 0) {
          td.classList.add("num-col");
        }
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  container.append(table);
  return container;
}

async function renderInvitePanel() {
  const panel = textElement("div", "", "card");
  const header = textElement("div", "", "card-header");
  header.append(
    textElement("h2", t("invites.title")),
    textElement("p", t("section.invitations")),
  );
  panel.append(header);

  const department = currentDepartment();
  try {
    const trust = await operation("getTrustInfo", { department });

    // Invitation Creation Form
    const createRow = textElement("div", "", "form-row");
    const roleGroup = textElement("div", "", "form-group");
    const roleLabel = textElement("label", `${t("invites.role")}`);
    const role = document.createElement("select");
    role.append(new Option("seller (Berater)", "seller"), new Option("customer (Kunde)", "customer"));
    roleGroup.append(roleLabel, role);

    const createBtn = textElement("button", `+ ${t("invites.create")}`);
    createBtn.onclick = async () => {
      try {
        const invite = await operation("createInvite", {
          issuer: trust.manager, department, role: role.value,
        });
        message("");
        render();
      } catch (error) { showError(error); }
    };
    createRow.append(roleGroup, createBtn);
    panel.append(createRow);

    // Active Invites List
    const { invites } = await operation("listInvites", { department });
    if (invites.length > 0) {
      const invitesTitle = textElement("h3", `${t("invites.title")} (${invites.length})`, "section-heading");
      invitesTitle.style.marginTop = "1.25rem";
      panel.append(invitesTitle);

      const headers = [t("table.role"), t("table.actions"), t("invites.url")];
      const rows = invites.map(entry => {
        const roleCell = roleBadge(entry.role);

        const actionsCell = document.createElement("div");
        actionsCell.style.display = "flex";
        actionsCell.style.gap = "0.4rem";

        const copyBtn = textElement("button", t("invites.copy"), "secondary sm");
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(entry.url);
            message(t("invites.copied"), true);
          } catch { message(entry.url, true); }
        };

        const revokeBtn = textElement("button", t("invites.revoke"), "danger sm");
        revokeBtn.onclick = async () => {
          await operation("revokeInvite", { issuer: trust.manager, token: entry.token });
          render();
        };

        actionsCell.append(copyBtn, revokeBtn);

        const urlText = textElement("span", entry.url, "code-cell");
        urlText.style.wordBreak = "break-all";

        return [roleCell, actionsCell, urlText];
      });
      panel.append(dataTable(headers, rows));
    }

    // Accept Invitation Card
    const acceptHeader = textElement("h3", t("invites.accept"), "section-heading");
    acceptHeader.style.marginTop = "1.25rem";
    const acceptRow = textElement("div", "", "form-row");

    const acceptUrlGroup = textElement("div", "", "form-group");
    acceptUrlGroup.append(textElement("label", t("invites.url")));
    const acceptUrl = document.createElement("input");
    acceptUrl.placeholder = "https://projektor.one/amway/invite/...";
    acceptUrlGroup.append(acceptUrl);

    const acceptPersonGroup = textElement("div", "", "form-group");
    acceptPersonGroup.append(textElement("label", t("invites.person")));
    const acceptPerson = document.createElement("input");
    acceptPerson.placeholder = "person:kunde-neu";
    acceptPersonGroup.append(acceptPerson);

    const acceptNameGroup = textElement("div", "", "form-group");
    acceptNameGroup.append(textElement("label", t("invites.name")));
    const acceptName = document.createElement("input");
    acceptName.placeholder = "Vorname Nachname";
    acceptNameGroup.append(acceptName);

    const acceptBtn = textElement("button", t("invites.accept"));
    acceptBtn.onclick = async () => {
      try {
        const result = await operation("acceptInvite", {
          invitationUrl: acceptUrl.value.trim(),
          person: acceptPerson.value.trim(),
          name: acceptName.value.trim(),
        });
        message(`${t("data.importOk")} ${result.pairing.person}`, true);
        render();
      } catch (error) { showError(error); }
    };

    acceptRow.append(acceptUrlGroup, acceptPersonGroup, acceptNameGroup, acceptBtn);
    panel.append(acceptHeader, acceptRow);
  } catch (error) { showError(error); }
  return panel;
}

const emptyList = () => textElement("div", t("list.empty"), "state-empty");

const personLabel = (names, id) => {
  const entry = names?.[id];
  if (entry?.name) return entry.name;
  if (entry?.organization) return `${id} (${t("trust.orgManager")})`;
  return id || "—";
};

const withDepartment = params => ({ ...params, department: currentDepartment() || undefined });

const formatJournalTime = atTime => Number.isFinite(atTime) && atTime > 0
  ? new Date(atTime).toLocaleString(language())
  : String(atTime ?? "");

function journalTitle(names, entry) {
  const key = `journal.${entry.type}`;
  if (!languageKeys(language()).includes(key)) return entry.type;
  const params = {
    department: entry.department ?? "",
    manager: personLabel(names, entry.manager),
    role: entry.role ?? "",
    subject: personLabel(names, entry.subject),
    issuer: personLabel(names, entry.issuer),
    holder: personLabel(names, entry.holder),
    contact: personLabel(names, entry.contact),
    person: personLabel(names, entry.person),
    lot: entry.lot ?? "",
    quantity: entry.quantity === undefined ? "" : String(entry.quantity),
    transaction: entry.transactionId ?? entry.transaction ?? "",
    amount: entry.amountText ?? (entry.amount === undefined ? "" : String(entry.amount)),
  };
  return t(key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

const SCREEN_LOADERS = {
  overview: async () => {
    const box = textElement("div", "");
    const status = await operation("getStatus", withDepartment({}));

    // System KPI metrics
    const metrics = textElement("div", "", "metrics-grid");
    metrics.append(
      metricCard(t("table.departments"), String(status.departments), "Organisations-Bereiche", "accent"),
      metricCard(t("table.transactions"), String(status.transactions), "Handels-Vorgänge", "success"),
      metricCard(
        t("table.journalComplete"),
        status.journalComplete ? "✓ Aktiv" : "Unvollständig",
        "Ereigniskette integer",
        status.journalComplete ? "success" : "warning",
      ),
      metricCard(t("table.owner"), (status.owner || "—").slice(0, 12), "Identitäts-Hash", "home"),
    );
    box.append(metrics);

    if (!status.summary) {
      box.append(textElement("div", t("scope.required"), "state-empty"));
      return box;
    }

    const summary = status.summary;

    // Department Performance Metrics
    const deptMetrics = textElement("div", "", "metrics-grid");
    deptMetrics.append(
      metricCard(t("overview.kpi.revenue"), summary.cash, "Eingegangene Zahlungen", "success"),
      metricCard(t("overview.kpi.receivable"), summary.receivable, "Ausstehende Zahlungen", "warning"),
      metricCard(t("overview.kpi.orders"), String(summary.orders), `${Object.values(summary.ordersByStatus).reduce((a, b) => a + b, 0)} gebucht`, "accent"),
      metricCard(t("overview.kpi.subscriptions"), String(summary.subscriptions), "Dauerhafte Abos", "nutrition"),
      metricCard(t("overview.kpi.products"), String(summary.items), `${summary.offers} aktive Angebote`, "beauty"),
      metricCard(t("overview.kpi.members"), String(Object.values(summary.members).reduce((a, b) => a + b, 0)), "Aktive Rollen", "home"),
    );
    box.append(deptMetrics);

    // Dashboard Cards Grid
    const dashboardGrid = textElement("div", "", "dashboard-grid");

    // Orders breakdown card
    const ordersCard = textElement("div", "", "card");
    ordersCard.append(
      textElement("h3", t("overview.card.orders")),
      dataTable(
        [t("table.status"), t("table.orders")],
        Object.entries(summary.ordersByStatus).map(([state, count]) => [statusBadge(state), String(count)]),
      ),
    );

    // Role distribution card
    const rolesCard = textElement("div", "", "card");
    rolesCard.append(
      textElement("h3", t("overview.card.roles")),
      dataTable(
        [t("table.role"), t("table.members")],
        Object.entries(summary.members).map(([role, count]) => [roleBadge(role), String(count)]),
      ),
    );

    // Inventory & reservations card
    const inventoryCard = textElement("div", "", "card");
    inventoryCard.append(
      textElement("h3", t("overview.card.inventory")),
      dataTable(
        [t("table.status"), t("table.lot")],
        [
          [badge(t("badge.held"), "info"), String(summary.reservations.held)],
          [badge(t("badge.consumed"), "success"), String(summary.reservations.consumed)],
        ],
      ),
    );

    dashboardGrid.append(ordersCard, rolesCard, inventoryCard);
    box.append(dashboardGrid);

    return box;
  },

  people: async () => {
    const { assignments, contacts, names } = await operation("getDirectory", withDepartment({}));
    const box = textElement("div", "");
    box.append(await renderInvitePanel());

    // Role Assignments Section
    const assignCard = textElement("div", "", "card");
    assignCard.append(textElement("h2", t("section.teamAssignments")));
    if (assignments.length) {
      assignCard.append(dataTable(
        [t("table.subject"), t("table.role"), t("table.issuer"), t("table.revoked")],
        assignments.map(entry => [
          personLabel(names, entry.subject),
          roleBadge(entry.role),
          personLabel(names, entry.issuer),
          entry.revokedAt === null ? badge(t("badge.active"), "success") : badge(t("badge.revoked"), "danger"),
        ]),
      ));
    } else {
      assignCard.append(emptyList());
    }
    box.append(assignCard);

    // Contacts & Phonebook Section
    const contactCard = textElement("div", "", "card");
    contactCard.append(textElement("h2", t("section.contactsDirectory")));
    if (contacts.length) {
      contactCard.append(dataTable(
        [t("table.name"), t("table.person"), t("table.role"), t("table.certified")],
        contacts.map(entry => [
          textElement("strong", entry.name),
          textElement("span", entry.person, "code-cell"),
          roleBadge(entry.role),
          entry.certified.some(cert => cert.current) ? badge(t("badge.verified"), "success", true) : badge("—", "neutral"),
        ]),
      ));
    } else {
      contactCard.append(emptyList());
    }
    box.append(contactCard);

    return box;
  },

  chat: async () => {
    const { contracts, names } = await operation("getContracts", withDepartment({}));
    if (!contracts.length) return emptyList();

    const box = textElement("div", "", "card");
    box.append(
      textElement("h2", t("section.advisoryContracts")),
      dataTable(
        [t("table.holder"), t("table.contact"), t("table.purpose"), t("table.status")],
        contracts.map(entry => [
          personLabel(names, entry.holder),
          personLabel(names, entry.contact),
          entry.purpose,
          entry.revokedAt === null ? badge(t("badge.active"), "success") : badge(t("badge.revoked"), "danger"),
        ]),
      ),
    );
    return box;
  },

  products: async () => {
    const { items, offers } = await operation("getCatalog", {});
    const byKey = new Map(items.map(entry => [entry.key, entry]));
    if (!offers.length) return emptyList();

    const box = textElement("div", "");

    // Search and filter toolbar
    const toolbar = textElement("div", "", "toolbar");
    const searchBox = textElement("div", "", "search-box");
    const searchInput = document.createElement("input");
    searchInput.placeholder = t("filter.searchPlaceholder");
    searchInput.type = "search";
    const searchIcon = textElement("span", "🔍", "search-icon");
    searchBox.append(searchIcon, searchInput);

    const filterChips = textElement("div", "", "filter-chips");
    const categories = ["all", "Ernährung", "Schönheit", "Haushalt"];
    let activeCat = "all";

    const tableContainer = textElement("div", "");

    function renderFiltered() {
      const q = searchInput.value.trim().toLowerCase();
      const filtered = offers.filter(entry => {
        const item = byKey.get(entry.item);
        const nameMatch = !q || (item?.name || entry.item).toLowerCase().includes(q) || (item?.brand || "").toLowerCase().includes(q);
        const catMatch = activeCat === "all" || (item?.category || "").toLowerCase() === activeCat.toLowerCase();
        return nameMatch && catMatch;
      });

      tableContainer.replaceChildren(
        dataTable(
          [t("table.name"), t("table.brand"), t("table.category"), t("table.price"), t("table.pvbv"), t("table.channel")],
          filtered.map(entry => {
            const item = byKey.get(entry.item);
            return [
              textElement("strong", item?.name ?? entry.item),
              item?.brand ?? "—",
              categoryBadge(item?.category),
              textElement("span", entry.unitPrice, "num-col"),
              item && item.pv !== null && item.pv !== undefined ? badge(`${item.pv} PV / ${item.bv} BV`, "accent") : "—",
              badge(entry.channel, "neutral"),
            ];
          }),
        ),
      );
    }

    categories.forEach(cat => {
      const chip = textElement("button", cat === "all" ? t("filter.all") : cat, `filter-chip ${cat === activeCat ? "active" : ""}`);
      chip.type = "button";
      chip.onclick = () => {
        activeCat = cat;
        filterChips.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        renderFiltered();
      };
      filterChips.append(chip);
    });

    searchInput.oninput = renderFiltered;

    toolbar.append(searchBox, filterChips);
    box.append(toolbar, tableContainer);
    renderFiltered();

    return box;
  },

  orders: async () => {
    const { transactions, subscriptions, names } = await operation("getOrders", withDepartment({}));
    const box = textElement("div", "");

    const ordersCard = textElement("div", "", "card");
    ordersCard.append(textElement("h2", t("section.orderHistory")));
    if (transactions.length) {
      ordersCard.append(dataTable(
        [t("table.id"), t("table.channel"), t("table.seller"), t("table.total"), t("table.status")],
        transactions.map(entry => [
          textElement("span", entry.id, "code-cell"),
          badge(entry.channel, "neutral"),
          personLabel(names, entry.seller),
          textElement("strong", entry.total),
          statusBadge(entry.ledger.status),
        ]),
      ));
    } else {
      ordersCard.append(emptyList());
    }
    box.append(ordersCard);

    const subsCard = textElement("div", "", "card");
    subsCard.append(textElement("h2", t("section.activeSubscriptions")));
    if (subscriptions.length) {
      subsCard.append(dataTable(
        [t("table.id"), t("table.customer"), t("table.status")],
        subscriptions.map(entry => [
          textElement("span", entry.id, "code-cell"),
          personLabel(names, entry.customer),
          statusBadge(entry.status),
        ]),
      ));
    } else {
      subsCard.append(emptyList());
    }
    box.append(subsCard);

    return box;
  },

  inventory: async () => {
    const { reservations } = await operation("getInventory", withDepartment({}));
    if (!reservations.length) return emptyList();

    const box = textElement("div", "");
    const held = reservations.filter(r => r.status === "held").length;
    const consumed = reservations.filter(r => r.status === "consumed").length;

    const metrics = textElement("div", "", "metrics-grid");
    metrics.append(
      metricCard(t("table.heldLots"), String(held), "Lagerbestand blockiert", "warning"),
      metricCard(t("table.consumedLots"), String(consumed), "Ausgeliefert / Eingelöst", "success"),
      metricCard(t("table.lot"), String(reservations.length), "Gesamtposten", "accent"),
    );
    box.append(metrics);

    const card = textElement("div", "", "card");
    card.append(
      textElement("h2", t("section.inventoryReservations")),
      dataTable(
        [t("table.id"), t("table.transaction"), t("table.lot"), t("table.quantity"), t("table.status")],
        reservations.map(entry => [
          textElement("span", entry.id, "code-cell"),
          textElement("span", entry.transactionId, "code-cell"),
          textElement("strong", entry.lot),
          textElement("span", String(entry.quantity), "num-col"),
          statusBadge(entry.status),
        ]),
      ),
    );
    box.append(card);
    return box;
  },

  earnings: async () => {
    const { sales } = await operation("getEarnings", withDepartment({}));
    if (!sales.length) return emptyList();

    const box = textElement("div", "");
    const card = textElement("div", "", "card");
    card.append(
      textElement("h2", t("section.salesLedger")),
      dataTable(
        [t("table.transaction"), t("table.total"), t("table.recognized"), t("table.receivable"), t("table.cash")],
        sales.map(entry => [
          textElement("span", entry.transaction, "code-cell"),
          textElement("strong", entry.total),
          entry.recognized,
          entry.receivable,
          textElement("span", entry.cash, "num-col"),
        ]),
      ),
    );
    box.append(card);
    return box;
  },

  returns: async () => {
    const { cases } = await operation("getReturns", {});
    if (!cases.length) return emptyList();

    const card = textElement("div", "", "card");
    card.append(
      textElement("h2", t("section.returnCases")),
      dataTable(
        [t("table.id"), t("table.transaction"), t("table.status"), t("table.decision")],
        cases.map(entry => [
          textElement("span", entry.id, "code-cell"),
          textElement("span", entry.transaction, "code-cell"),
          statusBadge(entry.status),
          badge(entry.resolution?.decision || "In Bearbeitung", "warning"),
        ]),
      ),
    );
    return card;
  },

  journal: async () => {
    const { occurrences, cut, names } = await operation("getJournal", withDepartment({ limit: 50 }));
    const box = textElement("div", "");

    const statusBadgeEl = cut.complete ? badge(t("service.connected"), "success", true) : badge(t("service.unavailable"), "warning");
    const headerInfo = textElement("div", "", "card-header");
    headerInfo.append(textElement("h2", t("section.auditTimeline")), statusBadgeEl);
    box.append(headerInfo);

    if (!occurrences.length) {
      box.append(emptyList());
      return box;
    }

    const layout = textElement("div", "", "journal-layout");
    const detail = textElement("div", "", "journal-inspector");
    detail.append(textElement("p", t("section.selectEventPrompt"), "state-empty"));

    const renderDetail = (entry, btn) => {
      layout.querySelectorAll(".journal-event-button").forEach(b => b.classList.remove("is-active"));
      if (btn) btn.classList.add("is-active");

      detail.replaceChildren();
      if (!entry) return;

      const detailHeader = textElement("div", "", "card-header");
      detailHeader.append(
        textElement("h3", t("section.eventDetail")),
        badge(entry.type, "accent"),
      );
      detail.append(
        detailHeader,
        dataTable(
          [t("table.field"), t("table.value")],
          Object.entries(entry).map(([field, value]) => [
            textElement("strong", field),
            textElement("span", String(value ?? ""), "code-cell"),
          ]),
        ),
      );
    };

    const list = document.createElement("ol");
    list.className = "journal-timeline";

    occurrences.forEach((entry, idx) => {
      const item = document.createElement("li");
      item.className = "journal-timeline-item";

      const open = document.createElement("button");
      open.type = "button";
      open.className = "journal-event-button";

      const actor = entry.subject ?? entry.holder ?? entry.issuer ?? entry.person ?? entry.manager ?? "";
      const actorLabel = personLabel(names, actor);
      const when = formatJournalTime(entry.atTime);

      const title = textElement("span", journalTitle(names, entry), "journal-event-title");
      const meta = textElement("span", actorLabel ? `${actorLabel} · ${when}` : when, "journal-event-meta");

      open.append(title, meta);
      open.onclick = () => renderDetail(entry, open);

      item.append(open);
      list.append(item);

      // Auto select first entry
      if (idx === 0) {
        setTimeout(() => renderDetail(entry, open), 0);
      }
    });

    layout.append(list, detail);
    box.append(layout);
    return box;
  },
};

function scopedScreen(title, body) {
  const section = textElement("section", "");
  const header = textElement("div", "", "page-header");
  header.append(textElement("h1", title));
  section.append(header);

  if (!currentDepartment()) {
    section.append(textElement("div", t("scope.required"), "state-empty"));
    return section;
  }
  section.append(body);
  return section;
}

async function pushLocalSettings() {
  try {
    await operation("updateSettings", { key: "language", value: language() });
    await operation("updateSettings", { key: "theme", value: theme() });
  } catch { /* first sync is best-effort */ }
}

function settingsCard(title, open) {
  const card = document.createElement("details");
  card.className = "settings-card";
  if (open) card.open = true;
  card.append(textElement("summary", title));
  const body = textElement("div", "", "settings-card-body");
  card.append(body);
  return card;
}

async function renderSettings(email, schema, values) {
  const section = textElement("section", "");
  const header = textElement("div", "", "page-header");
  header.append(
    textElement("h1", t("settings.title")),
    textElement("p", t("settings.subtitle")),
  );
  section.append(header);

  const container = textElement("div", "", "settings-grid");

  // Account Card
  const account = settingsCard(t("settings.account"), true);
  const accountBody = account.querySelector(".settings-card-body");
  accountBody.append(
    textElement("p", `${t("auth.signedInAs")} ${email}.`),
    textElement("p", t("auth.restartHint"), "state-empty"),
  );
  container.append(account);

  // Settings from schema (Theme & Language)
  for (const field of schema.fields) {
    if (field.type !== "select") continue;
    const block = settingsCard(t(`settings.${field.key === "theme" ? "appearance" : field.key}`), false);
    const body = block.querySelector(".settings-card-body");
    const label = textElement("label", `${t(field.key === "theme" ? "settings.appearance" : "settings.language")}`);
    const select = document.createElement("select");

    for (const option of field.options) {
      const text = field.key === "theme" ? t(`theme.${option.value}`) : option.label;
      select.append(new Option(text, option.value));
    }

    select.value = values[field.key] ?? field.default;
    select.onchange = async () => {
      try {
        const updated = await operation("updateSettings", { key: field.key, value: select.value });
        localStorage.setItem(field.key === "theme" ? THEME_KEY : LANG_KEY, updated.values[field.key]);
        if (field.key === "language") { setLanguage(updated.values[field.key]); render(); }
        else applyTheme();
      } catch (error) { showError(error); }
    };
    label.append(select);
    body.append(label);
    container.append(block);
  }

  container.append(renderDataSection());
  container.append(await renderTrustSection());

  section.append(container);
  return section;
}

function renderDataSection() {
  const block = settingsCard(t("settings.data"), false);
  const body = block.querySelector(".settings-card-body");
  const department = currentDepartment();

  const exportButton = textElement("button", `⬇ ${t("data.export")}`);
  exportButton.disabled = !department;
  exportButton.onclick = async () => {
    try {
      const envelope = await operation("exportDepartment", { department });
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${department}.amway.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      message(t("data.exported"), true);
    } catch (error) { showError(error); }
  };

  const importLabel = textElement("label", `${t("data.import")}`);
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.onchange = async () => {
    try {
      const envelope = JSON.parse(await file.files[0].text());
      const result = await operation("importDepartment", { envelope });
      if (result.trustStatus === "unverified") {
        message(`${t("data.importUnverified")} ${result.signer}`);
        const elevate = textElement("button", t("data.elevate"), "warning");
        elevate.onclick = async () => {
          await operation("trustSigner", { signer: result.signer });
          message(t("data.importOk"), true);
          render();
        };
        $("#screen").append(elevate);
      } else {
        message(t("data.importOk"), true);
      }
      render();
    } catch (error) { showError(error); }
  };
  importLabel.append(file);

  const demo = textElement("button", `✨ ${t("data.demo")}`, "secondary");
  demo.onclick = async () => {
    try {
      const result = await operation("loadDemo", {});
      localStorage.setItem("amway.department", result.department);
      message(t("data.importOk"), true);
      render();
    } catch (error) { showError(error); }
  };

  const publish = textElement("button", `⬆ ${t("data.publish")}`, "secondary");
  publish.disabled = !department;
  publish.onclick = async () => {
    try {
      const info = await operation("getTrustInfo", { department });
      const result = await operation("publishDepartment", { issuer: info.manager, department });
      message(`${t("data.published")} ${result.rootRef.slice(0, 12)}`, true);
      render();
    } catch (error) { showError(error); }
  };

  body.append(exportButton, importLabel, demo, publish);
  return block;
}

async function renderTrustSection() {
  const block = settingsCard(t("settings.trust"), false);
  const body = block.querySelector(".settings-card-body");
  const department = currentDepartment();

  if (!department) {
    body.append(textElement("div", t("scope.required"), "state-empty"));
    return block;
  }

  try {
    const info = await operation("getTrustInfo", { department });
    const chainCard = textElement("div", "", "card");
    chainCard.style.margin = "0";
    chainCard.append(
      textElement("strong", `${t("trust.chain")}: `),
      textElement("p", `${info.organizationManager} → ${info.managerEnrolledBy} → ${info.manager}`, "code-cell"),
    );
    body.append(chainCard);

    const signers = textElement("div", "");
    signers.append(textElement("strong", `${t("trust.signers")}: `));

    if (info.trustedSigners.length === 0) {
      signers.append(textElement("span", " — ", "state-empty"));
    }

    for (const signer of info.trustedSigners) {
      const pill = textElement("div", "", "user-badge");
      pill.style.margin = "0.25rem 0.25rem 0.25rem 0";
      pill.append(textElement("span", signer, "code-cell"));
      const remove = textElement("button", t("trust.remove"), "danger sm");
      remove.onclick = async () => {
        await operation("untrustSigner", { signer });
        render();
      };
      pill.append(remove);
      signers.append(pill);
    }

    const addRow = textElement("div", "", "input-with-button");
    addRow.style.marginTop = "0.75rem";
    const addInput = document.createElement("input");
    addInput.placeholder = t("trust.signers");
    addInput.setAttribute("aria-label", t("trust.signers"));
    const add = textElement("button", t("trust.add"));
    add.onclick = async () => {
      if (!addInput.value.trim()) return;
      await operation("trustSigner", { signer: addInput.value.trim() });
      render();
    };
    addRow.append(addInput, add);
    body.append(signers, addRow);
  } catch (error) { showError(error); }
  return block;
}

async function unlock(event, email, password, rememberCheck) {
  event.preventDefault();
  if (!email.value.trim() || !password.value) { message(t("auth.required")); return; }
  try {
    const response = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value.trim(), password: password.value }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      const error = new Error(result.error || "The operation failed.");
      error.status = response.status;
      if (result.code) error.code = result.code;
      throw error;
    }
    if (rememberCheck?.checked) {
      localStorage.setItem(EMAIL_KEY, result.email);
      localStorage.setItem(REMEMBER_KEY, "true");
    } else {
      localStorage.removeItem(EMAIL_KEY);
      localStorage.setItem(REMEMBER_KEY, "false");
    }
    await pushLocalSettings();
    message("");
    render();
  } catch (error) { showError(error); }
}

function renderAuthScreen() {
  const main = $("#screen");
  main.replaceChildren();

  const container = textElement("div", "", "auth-container");
  const card = textElement("div", "", "auth-card");

  const header = textElement("div", "", "auth-header");
  const logo = document.createElement("img");
  logo.src = "/amway/assets/amway-logo-black.svg";
  logo.alt = "Amway";
  logo.width = 100;
  logo.height = 34;

  header.append(
    logo,
    textElement("h1", t("auth.signin")),
    textElement("p", t("auth.tagline")),
  );

  const langLabel = textElement("label", t("lang.label"));
  langLabel.append(languageSelect());

  const remember = localStorage.getItem(REMEMBER_KEY) !== "false";
  const emailLabel = textElement("label", t("auth.email"));
  const email = document.createElement("input");
  email.type = "email";
  email.id = "amway-email";
  email.name = "username";
  email.autocomplete = "username";
  email.placeholder = "seller@example.de";
  if (remember) {
    email.value = localStorage.getItem(EMAIL_KEY) || "";
  }
  emailLabel.append(email);

  const passwordLabel = textElement("label", t("auth.password"));
  const password = document.createElement("input");
  password.type = "password";
  password.id = "amway-password";
  password.name = "password";
  password.autocomplete = "current-password";
  password.placeholder = "••••••••";
  passwordLabel.append(password);

  const rememberLabel = textElement("label", "", "checkbox-label");
  const rememberCheck = document.createElement("input");
  rememberCheck.type = "checkbox";
  rememberCheck.id = "amway-remember";
  rememberCheck.checked = remember;
  const rememberText = textElement("span", t("auth.remember"));
  rememberLabel.append(rememberCheck, rememberText);

  const submit = textElement("button", t("auth.signin"));
  submit.type = "submit";

  const form = document.createElement("form");
  form.append(langLabel, emailLabel, passwordLabel, rememberLabel, submit);
  form.onsubmit = event => unlock(event, email, password, rememberCheck);

  const footer = textElement("div", "", "auth-footer");
  footer.append(textElement("span", t("auth.instanceInfo")));

  card.append(header, form, footer);
  container.append(card);
  main.append(container);
}

async function render() {
  message("");
  let email = localStorage.getItem(EMAIL_KEY);
  if (email) {
    try {
      const session = await operation("getSession", {});
      email = session.email;
      localStorage.setItem(EMAIL_KEY, email);
    } catch {
      email = null;
      localStorage.removeItem(EMAIL_KEY);
    }
  }

  if (!email) {
    applyTheme();
    renderNav(currentScreen());
    $("#scope-banner").replaceChildren();
    renderAuthScreen();
    return;
  }

  try {
    const { values } = await operation("getSettings", {});
    localStorage.setItem(LANG_KEY, values.language);
    localStorage.setItem(THEME_KEY, values.theme);
  } catch { /* keep local mirror */ }

  setLanguage(language());
  applyTheme();
  renderNav(currentScreen());
  await renderScopeBanner();

  const main = $("#screen");
  main.replaceChildren();

  if (currentScreen() === "settings") {
    try {
      const { schema, values } = await operation("getSettings", {});
      main.append(await renderSettings(email, schema, values));
    } catch (error) { showError(error); }
    return;
  }

  try {
    const loader = SCREEN_LOADERS[currentScreen()];
    if (!loader) throw new Error(`Unknown screen: ${currentScreen()}`);
    main.append(scopedScreen(t(`nav.${currentScreen()}`), await loader()));
  } catch (error) {
    if (error?.status === 401) {
      localStorage.removeItem(EMAIL_KEY);
      render();
      return;
    }
    showError(error);
    const retry = textElement("button", t("service.retry"), "secondary");
    retry.onclick = () => render();
    main.append(scopedScreen(t(`nav.${currentScreen()}`), retry));
  }
}

window.addEventListener("hashchange", render);
setLanguage(language());
applyTheme();
render();
