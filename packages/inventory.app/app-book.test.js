import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { once } from "node:events";
import { test } from "node:test";
import { validateAppBookCatalog } from "../../../one/packages/source.core/dist/app-book.js";
import { createFlowDefinition } from "../../../one/packages/source.core/dist/recipes/FlowDefinitionRecipe.js";
import { createFlowBinding, createFlowEvidenceProducer } from "../../../one/packages/workspace.core/dist/flow.js";
import { createProjektorOperationRegistry, createProjektorHttpServer } from "../../scripts/projektor-http-server.mjs";
import { INVENTORY_APP_BOOK_CATALOG as catalog } from "./app-book.js";

test("package declaration and catalog satisfy native App Book and flow contracts", async () => {
  const manifest = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
  assert.equal(manifest.appBook.name, "inventory");
  assert.equal(manifest.appBook.module, manifest.exports["./app-book"]);
  await access(new URL(manifest.appBook.module, import.meta.url));
  validateAppBookCatalog(catalog);
  assert.equal(catalog.book.name, manifest.appBook.name);
  for (const journey of catalog.journeys) createFlowDefinition(journey);
  for (const binding of catalog.flowBindings) {
    const { flowId, evidence, ...seed } = binding;
    assert.ok(["core-contract", "local-runtime"].includes(binding.scope));
    evidence.forEach(createFlowEvidenceProducer);
    createFlowBinding({ ...seed, flowDefinitionIdHash: "a".repeat(64), createdAt: 1, updatedAt: 1 });
  }
});

test("all catalog provenance resolves to existing files in the declared repositories", async () => {
  const refs = new Set([
    ...catalog.book.sourceRefs,
    ...catalog.documents.flatMap((document) => document.sourceRefs),
    ...catalog.journeys.flatMap((journey) => journey.sourceRefs),
    ...catalog.flowBindings.flatMap((binding) => binding.evidence.flatMap((evidence) => evidence.sourceRefs)),
  ]);
  for (const ref of refs) {
    const match = /^repo:\/\/(projektor|one|vger)\/(.+)$/.exec(ref);
    assert.ok(match, `Unsupported source reference: ${ref}`);
    await access(new URL(`../../../${match[1]}/${match[2]}`, import.meta.url));
  }
});

test("HTTP and MCP discover and invoke the registered inventory definition", async (t) => {
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
  assert.match(await discovery.text(), /inventoryAppBook/);
  const response = await fetch(`${base}/api/inventoryAppBook/getDefinition`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.product, catalog);
  const tools = await registry.execute("mcp", "getAvailableTools", {});
  assert.match(JSON.stringify(tools), /operation:inventoryAppBook:getDefinition/);
  const first = await registry.execute("inventoryAppBook", "getDefinition", {});
  first.product.book.name = "modified-by-consumer";
  const second = await registry.execute("inventoryAppBook", "getDefinition", {});
  assert.equal(second.product.book.name, "inventory");
});
