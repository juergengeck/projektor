const $ = selector => document.querySelector(selector);
const message = text => { $("#message").textContent = text; };
let state;

async function request(path, params) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  const result = await response.json();
  if (!response.ok || result.error) {
    const error = new Error(typeof result.error === "string" ? result.error : result.error?.message || "The operation failed.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function operation(method, params = {}) {
  const result = await request(`/api/inventory/${method}`, params);
  return result.product;
}

async function refreshWorkspace() {
  render(await operation("getSnapshot"));
  const { product } = await request("/api/projectDocuments/getSnapshot", {});
  const target = $("#project-documents");
  target.replaceChildren(...product.projects.map(project => {
    const section = textElement("div", "", "entry");
    section.append(textElement("strong", project.label));
    for (const document of project.documents) {
      const row = textElement("p", "");
      const link = textElement("a", document.path);
      link.href = `/documents/${project.ref}/${document.ref}`;
      row.append(link, textElement("small", `${format(document.size)} bytes`));
      section.append(row);
    }
    if (!project.documents.length) section.append(textElement("p", "No documents published yet."));
    return section;
  }));
  if (!product.projects.length) target.append(textElement("p", "No project documents published yet."));
}

function textElement(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function options(select, values) {
  const selected = select.value;
  select.replaceChildren(...values.map(([value, label]) => new Option(label, value)));
  if (values.some(([value]) => value === selected)) select.value = selected;
}

const locationName = ref => state.locations.find(value => value.ref === ref).name;
const lotName = ref => {
  const lot = state.lots.find(value => value.lotRef === ref);
  return `${lot.name} · ${lot.lotId}`;
};
const format = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 12 }).format(value);
const date = value => new Date(value).toLocaleString();

function renderStock() {
  const location = $("#location-filter").value;
  const query = $("#search").value.trim().toLowerCase();
  const rows = state.stock.filter(row => (!location || row.location === location) && `${row.name} ${row.lotId}`.toLowerCase().includes(query));
  $("#stock").replaceChildren(...rows.map(row => {
    const tr = document.createElement("tr");
    const material = textElement("td", row.name);
    material.append(textElement("small", row.lotId));
    tr.append(material, textElement("td", locationName(row.location)), textElement("td", `${format(row.quantity)} ${row.unit}`, "number"), textElement("td", row.custodian === state.owner ? "You" : row.custodian), textElement("td", row.titleHolder === state.owner ? "You" : row.titleHolder));
    return tr;
  }));
  $("#row-count").textContent = `${rows.length} stock ${rows.length === 1 ? "position" : "positions"}`;
  $("#empty").hidden = rows.length > 0;
  $("#empty").textContent = state.history.length ? "No stock matches this location and search." : "Add a location, then record the stock you are starting with.";
}

function render(snapshot) {
  state = snapshot;
  $("#workspace").hidden = false;
  $("#login").hidden = true;
  $("#metrics").replaceChildren(...[
    [state.locations.length, "Locations"],
    [state.lots.length, "Recorded lots"],
    [state.observations.filter(value => value.difference !== 0).length, "Count discrepancies"],
  ].map(([number, label]) => {
    const card = textElement("div", "", "metric");
    card.append(textElement("strong", format(number)), textElement("span", label));
    return card;
  }));
  const locations = state.locations.map(value => [value.ref, value.name]);
  options($("#location-filter"), [["", "All locations"], ...locations]);
  document.querySelectorAll(".locations").forEach(select => options(select, [["", "Choose a location"], ...locations]));
  options($("#move-stock"), [["", "Choose stock"], ...state.stock.map(row => [`${row.lot}:${row.location}`, `${row.name} · ${row.lotId} · ${locationName(row.location)} (${format(row.quantity)} ${row.unit})`])]);
  options($("#count-lot"), [["", "Choose a lot"], ...state.lots.map(lot => [lot.lotRef, `${lot.name} · ${lot.lotId}`])]);
  $("#observations").replaceChildren(...state.observations.slice().reverse().map(value => {
    const entry = textElement("div", "", "entry");
    entry.append(textElement("strong", `${lotName(value.observation.lot)} · ${locationName(value.observation.location)}`), textElement("p", `Recorded ${format(value.foldedQuantity)} · Observed ${format(value.observation.observedQuantity)} · Difference ${format(value.difference)}`, value.difference ? "difference" : ""), textElement("small", date(value.observation.timestamp)));
    return entry;
  }));
  if (!state.observations.length) $("#observations").append(textElement("p", "No physical counts recorded yet."));
  $("#history").replaceChildren(...state.history.slice().reverse().map(value => {
    const entry = textElement("div", "", "entry");
    let label;
    if (value.type === "opening") label = `Opening stock · ${lotName(value.lot)} · ${format(value.quantity)} at ${locationName(value.location)}`;
    else if (value.type === "movement") label = `Movement · ${lotName(value.event.lots[0].lot)} · ${format(value.event.lots[0].quantity)} from ${locationName(value.event.fromLocation)} to ${locationName(value.event.toLocation)}`;
    else label = `Physical count · ${lotName(value.event.lot)} · ${format(value.event.observedQuantity)} at ${locationName(value.event.location)}`;
    entry.append(textElement("strong", label), textElement("small", date(value.timestamp)));
    if (value.evidence) entry.append(textElement("p", value.evidence));
    const details = document.createElement("details");
    details.append(textElement("summary", "Evidence reference"), textElement("pre", value.ref));
    entry.append(details);
    return entry;
  }));
  if (!state.history.length) $("#history").append(textElement("p", "Your recorded actions will appear here."));
  $("#references").textContent = `Inventory: ${state.rootRef}\nVersion: ${state.version}\nOperator: ${state.owner}`;
  renderStock();
}

async function perform(form, work) {
  const buttons = [...document.querySelectorAll("button")];
  buttons.forEach(button => { button.disabled = true; });
  message("");
  try { await work(); }
  catch (error) { message(error.message); $("#message").scrollIntoView({ block: "center", behavior: "smooth" }); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}

$("#login-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  perform(form, async () => {
    await request("/session", Object.fromEntries(new FormData(form)));
    form.reset();
    await refreshWorkspace();
  });
});

for (const [id, method, transform] of [
  ["location-form", "addLocation", value => value],
  ["opening-form", "openLot", value => ({ ...value, quantity: Number(value.quantity) })],
  ["move-form", "move", value => {
    const row = state.stock.find(value => `${value.lot}:${value.location}` === $("#move-stock").value);
    return { ...value, lot: row.lot, fromLocation: row.location, quantity: Number(value.quantity) };
  }],
  ["count-form", "count", value => ({ ...value, observedQuantity: Number(value.observedQuantity) })],
]) {
  $(`#${id}`).addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    perform(form, async () => {
      const snapshot = await operation(method, { ...transform(Object.fromEntries(new FormData(form))), expectedVersion: state.version });
      form.reset();
      render(snapshot);
    });
  });
}
$("#refresh").addEventListener("click", () => perform(null, refreshWorkspace));
$("#search").addEventListener("input", renderStock);
$("#location-filter").addEventListener("change", renderStock);

try { await refreshWorkspace(); }
catch (error) { if (error.status !== 401) message(error.message); }
