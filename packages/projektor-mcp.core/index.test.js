import assert from "node:assert/strict";
import { OperationRegistry } from "../../../one/packages/refinio.api/dist/src/registry/index.js";
import {
  ProjektorMcpServicePlan,
  createCanonicalOperationToolName,
} from "./index.js";
import {
  createProjektorHttpServer,
  createProjektorOperationRegistry,
} from "../../scripts/projektor-http-server.mjs";

const registry = new OperationRegistry();
registry.register("demo", {
  add({ left = 0, right = 0 } = {}) {
    return { sum: left + right };
  },
}, {
  category: "demo",
  description: "Demo operation for outbound MCP tests.",
  methods: [
    {
      name: "add",
      description: "Add two numbers.",
      params: [
        { name: "left", type: "number", required: true },
        { name: "right", type: "number", required: true },
      ],
      returns: "Object with sum.",
    },
  ],
});

const sentCredentials = [];
const mcp = new ProjektorMcpServicePlan({
  registry,
  providerPersonId: "provider-1",
  now: (() => {
    let tick = 1000;
    return () => tick++;
  })(),
  sendCredential: async (personId, credential) => {
    sentCredentials.push({ personId, credential });
  },
});
registry.register("mcp", mcp, {
  category: "mcp",
  description: "MCP test operation.",
  methods: [
    { name: "getStatus" },
    { name: "createSupply" },
    { name: "handleDemand" },
    { name: "handleRequest" },
  ],
});

const toolName = createCanonicalOperationToolName("demo", "add");
assert.equal(mcp.getAvailableTools().some((tool) => tool.name === toolName), true);

const supply = mcp.createSupply({ topicId: "topic-1", allowedTools: [toolName] });
assert.equal(supply.$type$, "MCPSupply");
assert.equal(mcp.hasSupply({ topicId: "topic-1" }), true);

const demandResult = await mcp.handleDemand({ topicId: "topic-1", requesterPersonId: "consumer-1" });
assert.equal(demandResult.accepted, true);
assert.equal(sentCredentials.length, 1);
assert.equal(mcp.hasValidCredential({ topicId: "topic-1", consumerPersonId: "consumer-1", toolName }), true);

const response = await mcp.handleRequest({
  topicId: "topic-1",
  senderPersonId: "consumer-1",
  requestData: {
    toolName,
    parameters: { left: 2, right: 3 },
  },
});
assert.equal(response.$type$, "MCPResponse");
assert.equal(JSON.parse(response.result.content).sum, 5);
assert.equal(mcp.getAuditLog().length, 1);

await assert.rejects(
  () => mcp.handleRequest({
    topicId: "topic-1",
    senderPersonId: "consumer-2",
    requestData: { toolName, parameters: { left: 1, right: 1 } },
  }),
  /no valid MCP credential/,
);

mcp.setTopicConfig({ topicId: "topic-1", config: { outboundEnabled: false } });
assert.equal(mcp.hasSupply({ topicId: "topic-1" }), false);

const { registry: httpRegistry, graph } = await createProjektorOperationRegistry({
  providerPersonId: "provider-http",
  now: () => 2000,
});
const server = createProjektorHttpServer({ registry: httpRegistry, graph, port: 0 });
await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", resolve);
  server.once("error", reject);
});
const { port } = server.address();
const catalog = await fetch(`http://127.0.0.1:${port}/api`).then((response) => response.json());
assert.equal(catalog.handlers.some((handler) => handler.name === "mcp"), true);
const httpSupply = await fetch(`http://127.0.0.1:${port}/api/mcp/createSupply`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ topicId: "topic-http" }),
}).then((response) => response.json());
assert.equal(httpSupply.product.$type$, "MCPSupply");
await new Promise((resolve) => server.close(resolve));
