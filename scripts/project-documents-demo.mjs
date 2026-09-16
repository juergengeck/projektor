#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

// Explicit demo account only. Import committed demo files with their actual Git revision.
const run = promisify(execFile);
const cwd = fileURLToPath(new URL("..", import.meta.url));
const base = process.env.PROJEKTOR_DEMO_URL || "http://127.0.0.1:4175";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Demo target must be local.");
let cookie;
async function call(route, params) {
  const response = await fetch(`${base}${route}`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(params) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(JSON.stringify(result));
  if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
  return result.product ?? result;
}
await call("/session", { email: "demo@inventory.example", password: "Inventory-Demo-2026" });
let state = await call("/api/projectDocuments/getSnapshot", {});
const projectId = "demo-kita-2028";
if (!state.projects.some(project => project.projectId === projectId)) state = await call("/api/projectDocuments/createProject", { projectId, label: "Kita 2028 Demo", expectedVersion: state.version });
let project = state.projects.find(project => project.projectId === projectId);
const { stdout: head } = await run("git", ["rev-parse", "HEAD"], { cwd });
const revision = head.trim();
for (const path of ["README.md", "demo-kita-2028.project.js"]) {
  if (project.documents.some(document => document.path === path && document.revision === revision)) continue;
  const { stdout: bytes } = await run("git", ["show", `${revision}:${path}`], { cwd, encoding: "buffer", maxBuffer: 1024 * 1024 });
  project = await call("/api/projectDocuments/importDocument", { projectRef: project.ref, expectedVersion: project.version, source: { projectId, repoUrl: new URL("..", import.meta.url).href }, path, revision, contentBase64: bytes.toString("base64"), mediaType: path.endsWith(".md") ? "text/markdown" : "text/javascript" });
}
console.log(JSON.stringify({ project: project.label, documents: project.documents.map(document => ({ path: document.path, size: document.size, revision: document.revision })), filerEndpoint: `${base}/filer/rpc` }, null, 2));
