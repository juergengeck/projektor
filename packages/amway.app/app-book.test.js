import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { once } from "node:events";
import { test } from "node:test";
import { validateAppBookCatalog } from "../../../one/packages/source.core/dist/app-book.js";
import { createFlowDefinition } from "../../../one/packages/source.core/dist/recipes/FlowDefinitionRecipe.js";
import { createFlowBinding, createFlowEvidenceProducer } from "../../../one/packages/workspace.core/dist/flow.js";
import { createProjektorOperationRegistry, createProjektorHttpServer } from "../../scripts/projektor-http-server.mjs";
import { AMWAY_APP_BOOK_CATALOG as catalog } from "./app-book.js";

test("Amway package and catalog conform to native Book and flow contracts", async () => {
  const manifest = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "@projektor/amway.app");
  assert.equal(manifest.appBook.name, "amway");
  assert.equal(catalog.book.name, manifest.appBook.name);
  assert.equal(manifest.appBook.module, manifest.exports["./app-book"]);
  await access(new URL(manifest.appBook.module, import.meta.url));
  validateAppBookCatalog(catalog);
  for (const journey of catalog.journeys) createFlowDefinition(journey);
  for (const binding of catalog.flowBindings) {
    const { flowId, evidence, ...seed } = binding;
    assert.equal(binding.scope, "app-book-contract", "Specification evidence must not claim runtime coverage");
    assert.deepEqual(binding.toolRequirementRefs, []);
    evidence.forEach(createFlowEvidenceProducer);
    createFlowBinding({ ...seed, flowDefinitionIdHash: "a".repeat(64), createdAt: 1, updatedAt: 1 });
  }
});

test("four-instance browser lab specifies real isolation and propagation evidence", () => {
  const chapter = catalog.documents.find(({ name }) => name === "amway.four-instance-browser-lab");
  assert.ok(chapter, "Four-instance lab chapter is present");
  assert.match(chapter.body, /separate amway\.core runtime hosted in its own dedicated module Web Worker/);
  assert.match(chapter.body, /real connection, access and CHUM paths/);
  assert.match(chapter.body, /must not copy domain objects/);
  assert.match(chapter.body, /customer self-purchase feeds the same admitted order version back/);
  assert.match(chapter.body, /reload restores the live CHUM mesh before readiness/);
  assert.match(chapter.body, /admin appoints managers, managers appoint sellers, sellers appoint customers/);
  assert.match(chapter.body, /shareOffer operation/);
  assert.match(chapter.body, /Artifact \| Admin \| Manager \| Seller \| Customer/);
  assert.match(chapter.body, /\/invites\/inviteDevice\//);
  assert.match(chapter.body, /placing alone buys nothing/);
  const ek = catalog.documents.find(({ name }) => name === "ek.four-instance-browser-lab");
  assert.ok(ek, "the Elektro Klein lane is recorded");
  assert.match(ek.body, /\/ek\/lab/);
  assert.match(ek.body, /ek-de/);
  assert.match(ek.body, /There are no deltas/);

  const flow = catalog.journeys.find(({ id }) => id === "amway.flow.observe-four-instance-propagation");
  assert.ok(flow, "Four-instance propagation journey is present");
  assert.ok(flow.verificationChecks.some(check => /four concurrently active ONE instances/.test(check)));
  assert.ok(flow.verificationChecks.some(check => /customer receives only their authorized order projection/.test(check)));
  assert.ok(flow.verificationChecks.some(check => /catches up after reconnection/.test(check)));
  assert.ok(flow.verificationChecks.some(check => /Appointments follow the chain/.test(check)));
  assert.ok(flow.verificationChecks.some(check => /Publishing alone shares nothing/.test(check)));
  assert.ok(flow.verificationChecks.some(check => /Admitting an unknown/.test(check)));

  const binding = catalog.flowBindings.find(({ flowId }) => flowId === flow.id);
  assert.equal(binding?.scope, "app-book-contract");
});

test("Amway provenance resolves to real files in the declared source repositories", async () => {
  const refs = new Set([
    ...catalog.book.sourceRefs,
    ...catalog.documents.flatMap(({ sourceRefs }) => sourceRefs),
    ...catalog.journeys.flatMap(({ sourceRefs }) => sourceRefs),
    ...catalog.flowBindings.flatMap(({ evidence }) => evidence.flatMap(({ sourceRefs }) => sourceRefs)),
  ]);
  for (const ref of refs) {
    const match = /^repo:\/\/(projektor|one|vger|heiner|21|akte|aggregat)\/(.+)$/.exec(ref);
    assert.ok(match, `Unsupported source reference: ${ref}`);
    await access(new URL(`../../../${match[1]}/${match[2]}`, import.meta.url));
  }
});

test("HTTP and MCP expose an isolated Amway definition", async (t) => {
  const { registry, graph } = await createProjektorOperationRegistry();
  const server = createProjektorHttpServer({ registry, graph, port: 0, staticDir: undefined });
  t.after(async () => {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    else await graph.shutdownAll();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const discovery = await fetch(`${base}/api`);
  assert.equal(discovery.status, 200);
  assert.match(await discovery.text(), /amwayAppBook/);
  const response = await fetch(`${base}/api/amwayAppBook/getDefinition`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).product, catalog);
  const tools = await registry.execute("mcp", "getAvailableTools", {});
  assert.match(JSON.stringify(tools), /operation:amwayAppBook:getDefinition/);
  const first = await registry.execute("amwayAppBook", "getDefinition", {});
  first.product.documents[0].body = "consumer edit";
  const second = await registry.execute("amwayAppBook", "getDefinition", {});
  assert.deepEqual(second.product, catalog);
  const inventory = await registry.execute("inventoryAppBook", "getDefinition", {});
  assert.equal(inventory.product.book.name, "inventory");
});
