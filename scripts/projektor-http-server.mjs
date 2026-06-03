#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../one/packages/one.core/lib/system/load-nodejs.js";
import {
  OperationRegistry,
  createPublicOperationCatalogPayload,
  hasPublicOperationMethod,
} from "../../one/packages/refinio.api/dist/src/registry/index.js";
import {
  createNgoDemoProjectData,
} from "../packages/ngo.core/index.js";
import {
  createNgoOneCoreSupply,
  initializeNgoModuleGraph,
} from "../packages/ngo.core/refinio-api.js";
import { ProjektorMcpServicePlan } from "../packages/projektor-mcp.core/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_PORT = 4174;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export async function createProjektorOperationRegistry({
  providerPersonId = "projektor.local",
  now,
} = {}) {
  const registry = new OperationRegistry();
  const oneCore = createNgoOneCoreSupply({ storeVersionedObject: undefined });
  const graph = await initializeNgoModuleGraph({
    data: createNgoDemoProjectData(),
    oneCore,
    operationRegistry: registry,
    storageFunction: undefined,
  });

  registry.register("projector", createProjectorOperation({ providerPersonId, registry }), {
    category: "projector",
    description: "Projektor project runtime status and discovery metadata.",
    methods: [
      { name: "getStatus", description: "Return local Projektor runtime status." },
      { name: "getDiscovery", description: "Return public Projektor discovery metadata." },
    ],
  });

  const mcp = new ProjektorMcpServicePlan({ registry, providerPersonId, now });
  registry.register("mcp", mcp, {
    category: "mcp",
    description: "Outbound Projektor MCP service offering control plane.",
    methods: [
      { name: "getStatus", description: "Return outbound MCP service status." },
      { name: "getAvailableTools", description: "List canonical Projektor operation tools that can be offered." },
      { name: "getTopicConfig", description: "Read per-topic MCP inbound/outbound configuration." },
      { name: "setTopicConfig", description: "Set per-topic MCP inbound/outbound configuration." },
      { name: "createSupply", description: "Offer Projektor MCP tools to a topic." },
      { name: "removeSupply", description: "Revoke a topic MCP tool offering." },
      { name: "hasSupply", description: "Check whether a topic has an MCP supply." },
      { name: "getSupply", description: "Read a topic MCP supply." },
      { name: "listSupplies", description: "List all active outbound MCP supplies." },
      { name: "handleDemand", description: "Issue an MCP credential when a peer requests access to an offered topic." },
      { name: "hasValidCredential", description: "Check whether a peer can call a topic MCP tool." },
      { name: "revokeCredential", description: "Revoke a peer MCP credential for a topic." },
      { name: "executeTool", description: "Execute a local canonical operation tool." },
      { name: "handleRequest", description: "Execute a credentialed peer MCP request and record an audit entry." },
      { name: "getAuditLog", description: "Return audited outbound MCP tool calls." },
    ],
    tools: mcp.getToolDefinitions(),
  });

  return { registry, graph };
}

export function createProjektorHttpServer({
  registry,
  graph,
  host = "127.0.0.1",
  port = DEFAULT_PORT,
  staticDir = ROOT_DIR,
} = {}) {
  if (!registry) throw new Error("registry is required");
  let requestCount = 0;
  const startedAt = Date.now();

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      writeJson(res, 200, { ok: true });
      return;
    }

    const url = new URL(req.url || "/", `http://${host}:${port}`);
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        writeJson(res, 200, {
          status: "ok",
          url: `http://${host}:${port}`,
          requestCount,
          uptime: Date.now() - startedAt,
          operations: registry.listOperations(),
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api") {
        writeJson(res, 200, createPublicOperationCatalogPayload(registry));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        writeJson(res, 200, await registry.execute("projector", "getStatus"));
        return;
      }

      if (req.method === "GET" && url.pathname === "/.well-known/projektor") {
        writeJson(res, 200, await registry.execute("projector", "getDiscovery"));
        return;
      }

      if (req.method === "POST" && url.pathname.startsWith("/api/")) {
        const [, , operation, method] = url.pathname.split("/");
        if (!operation || !method) {
          writeJson(res, 400, { success: false, error: "Use POST /api/:operation/:method" });
          return;
        }
        if (!hasPublicOperationMethod(registry, operation, method)) {
          writeJson(res, 404, {
            success: false,
            error: { code: "METHOD_NOT_FOUND", message: `${operation}.${method} is not public` },
          });
          return;
        }
        const params = await readJsonBody(req);
        requestCount += 1;
        writeJson(res, 200, await registry.execute(operation, method, params));
        return;
      }

      if (req.method === "GET" && staticDir && serveStatic(url.pathname, staticDir, res)) {
        return;
      }

      writeJson(res, 404, { success: false, error: "Not found" });
    } catch (error) {
      writeJson(res, 500, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  server.once("close", async () => {
    await graph?.shutdownAll?.();
  });

  return server;
}

function createProjectorOperation({ providerPersonId, registry }) {
  return {
    getStatus() {
      return {
        service: "projektor.one",
        runtime: "projektor.headless.local",
        providerPersonId,
        operations: registry.listOperations(),
      };
    },
    getDiscovery() {
      return {
        service: "projektor.one",
        schemaVersion: 1,
        endpoints: {
          health: "/health",
          catalog: "/api",
          invoke: "/api/:operation/:method",
        },
        mcp: {
          plan: "mcp",
          serviceOffering: "MCPSupply",
          canonicalToolPrefix: "operation:",
        },
      };
    },
  };
}

function serveStatic(pathname, staticDir, res) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const relative = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const resolvedRoot = path.resolve(staticDir);
  const resolvedPath = path.resolve(staticDir, relative);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    writeJson(res, 403, { success: false, error: "Forbidden" });
    return true;
  }
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) return false;
  const contentType = MIME_TYPES[path.extname(resolvedPath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(resolvedPath).pipe(res);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > 1024 * 1024) {
        reject(new Error("JSON body exceeds 1 MiB"));
        req.destroy();
      }
    });
    req.on("error", reject);
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  });
}

function writeJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PROJEKTOR_HTTP_PORT || process.argv[2] || DEFAULT_PORT);
  const host = process.env.PROJEKTOR_HTTP_HOST || "127.0.0.1";
  const { registry, graph } = await createProjektorOperationRegistry();
  const server = createProjektorHttpServer({ registry, graph, host, port });
  server.listen(port, host, () => {
    console.log(`[ProjektorHTTP] listening on http://${host}:${port}`);
    console.log("[ProjektorHTTP] endpoints: GET /health, GET /api, POST /api/:operation/:method");
  });
}
