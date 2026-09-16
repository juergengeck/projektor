#!/usr/bin/env node
import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../one/packages/one.core/lib/system/load-nodejs.js";
import { initInstance, closeInstance, getInstanceOwnerIdHash } from "../../one/packages/one.core/lib/instance.js";
import { SupplyCoreRecipes } from "../../one/packages/supply.core/dist/index.js";
import { OperationRegistry, createPublicOperationCatalogPayload, hasPublicOperationMethod } from "../../one/packages/refinio.api/dist/src/registry/index.js";
import { InventoryPlan } from "../packages/inventory.app/InventoryPlan.js";
import { INVENTORY_APP_BOOK_CATALOG } from "../packages/inventory.app/app-book.js";
import { FileProviderRpc } from "../../one/packages/refinio.api/dist/src/filer/FileProviderRpc.js";
import { ProjectSourceCoreRecipes } from "../packages/project-source.core/index.js";
import { ProjectDocumentRecipes } from "../packages/project-documents.core/recipes.js";
import { ProjectDocumentsPlan } from "../packages/project-documents.core/ProjectDocumentsPlan.js";
import { ProjektorFileSystem } from "../packages/project-documents.core/ProjektorFileSystem.js";

const assets = new Map([
  ["/", ["../packages/inventory.app/ui/index.html", "text/html"]],
  ["/app.js", ["../packages/inventory.app/ui/app.js", "text/javascript"]],
  ["/styles.css", ["../packages/inventory.app/ui/styles.css", "text/css"]],
]);

async function body(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1150000) throw new Error("Request exceeds the document upload limit.");
    chunks.push(chunk);
  }
  if (!String(req.headers["content-type"]).startsWith("application/json")) throw new Error("JSON request required.");
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request must be an object.");
  return value;
}

export function createInventoryServer({ directory, filerToken }) {
  if (filerToken !== undefined && (typeof filerToken !== "string" || filerToken.length < 32)) throw new Error("Filer token must contain at least 32 characters.");
  let session;
  let registry;
  let filerRpc;
  let documents;
  let initialized = false;
  let opening = false;
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(value));
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const port = server.address()?.port;
    const sessionCookie = `inventory-session-${port}`;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return send(403, { error: "Local host required." });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const nativeRpc = req.method === "POST" && url.pathname === "/filer/rpc";
    if (req.method === "POST" && (!nativeRpc || req.headers.origin) && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: "Same-origin request required." });
    try {
      if (nativeRpc) {
        if (!filerToken) return send(404, { error: "Filer is not configured." });
        if (!filerRpc || !filerRpc.isAuthorized(req.headers.authorization)) return send(401, { error: "Unlock the local account and supply its Filer token." });
        const request = await body(req);
        // Refuse writes before the shared writeFile transport stores a BLOB.
        if (["writeFile", "createFile", "createDir", "rename", "unlink", "rmdir"].includes(request.method)) return send(200, { jsonrpc: "2.0", id: request.id ?? null, error: { code: -13, message: "Project documents are read-only in Filer. Publish changes through Projektor." } });
        return send(200, await filerRpc.handle(request));
      }
      if (req.method === "GET" && assets.has(url.pathname)) {
        const [asset, mime] = assets.get(url.pathname);
        const bytes = await readFile(new URL(asset, import.meta.url));
        res.writeHead(200, { "Content-Type": `${mime}; charset=utf-8`, "Cache-Control": "no-store" });
        res.end(bytes);
        return;
      }
      if (req.method === "POST" && url.pathname === "/session") {
        if (opening || initialized) return send(409, { error: "This runtime is already unlocked. Restart it to unlock another account." });
        const { email, password } = await body(req);
        if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || !password) throw new Error("Email and password are required.");
        opening = true;
        try {
          await initInstance({ name: "inventory", email, secret: password, directory, encryptStorage: false, initialRecipes: [...SupplyCoreRecipes, ...ProjectSourceCoreRecipes, ...ProjectDocumentRecipes] });
          initialized = true;
          const plan = new InventoryPlan({ owner: getInstanceOwnerIdHash() });
          await plan.init();
          documents = new ProjectDocumentsPlan({ owner: getInstanceOwnerIdHash() });
          await documents.init();
          registry = new OperationRegistry();
          registry.register("projectDocuments", documents, {
            description: "Owner-published project documents, projected into Filer.",
            methods: ["getSnapshot", "getProject", "createProject", "importDocument", "removeDocument"].map(name => ({ name, description: `Project documents ${name}` })),
          });
          registry.register("inventory", plan, {
            description: "Local operator inventory: evidenced opening stock, locations, movements, and counts.",
            methods: ["getSnapshot", "addLocation", "openLot", "move", "count"].map(name => ({ name, description: `Inventory ${name}` })),
          });
          registry.register("inventoryAppBook", { getDefinition: () => structuredClone(INVENTORY_APP_BOOK_CATALOG) }, {
            methods: [{ name: "getDefinition", description: "Inventory application Book catalog" }],
          });
          session = randomBytes(32).toString("hex");
          if (filerToken) filerRpc = new FileProviderRpc(new ProjektorFileSystem(documents), filerToken);
          res.setHeader("Set-Cookie", `${sessionCookie}=${session}; HttpOnly; SameSite=Strict; Path=/`);
          return send(200, { owner: getInstanceOwnerIdHash() });
        } catch (error) {
          closeInstance();
          initialized = false;
          registry = undefined;
          filerRpc = undefined;
          documents = undefined;
          throw error;
        } finally { opening = false; }
      }
      const cookie = String(req.headers.cookie || "").split("; ").find(value => value.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
      if (!session || !cookie || cookie.length !== session.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(session))) return send(401, { error: "Unlock your local inventory first." });
      const download = /^\/documents\/([a-f0-9]{64})\/([a-f0-9]{64})$/.exec(url.pathname);
      if (req.method === "GET" && download) {
        const project = await documents.getProject({ projectRef: download[1] });
        const entry = project.documents.find(entry => entry.ref === download[2]);
        if (!entry) return send(404, { error: "Document is no longer published." });
        const bytes = await documents.readDocument({ projectRef: download[1], artifactRef: download[2] });
        const filename = encodeURIComponent(entry.path.split("/").at(-1)).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
        res.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "Content-Disposition": `attachment; filename*=UTF-8''${filename}` });
        res.end(bytes);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api") return send(200, createPublicOperationCatalogPayload(registry));
      const route = /^\/api\/([^/]+)\/([^/]+)$/.exec(url.pathname);
      if (req.method === "POST" && route && hasPublicOperationMethod(registry, route[1], route[2])) {
        return send(200, await registry.execute(route[1], route[2], await body(req)));
      }
      return send(404, { error: "Operation not found." });
    } catch (error) { send(400, { error: error.message }); }
  });
  server.on("close", () => { if (initialized) closeInstance(); });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const directory = process.env.INVENTORY_STORAGE_DIR || path.join(homedir(), ".local", "share", "projektor", "inventory");
  const port = Number(process.env.INVENTORY_PORT || 4175);
  const filerToken = process.env.PROJEKTOR_FILER_TOKEN_FILE ? (await readFile(process.env.PROJEKTOR_FILER_TOKEN_FILE, "utf8")).trim() : undefined;
  const server = createInventoryServer({ directory, filerToken });
  server.listen(port, "127.0.0.1", () => console.log(`Inventory: http://127.0.0.1:${server.address().port}`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
}
