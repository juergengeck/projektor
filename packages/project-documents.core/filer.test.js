import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInventoryServer } from "../../scripts/inventory-server.mjs";
import { ProjectDocumentsPlan } from "./ProjectDocumentsPlan.js";
import { ProjektorFileSystem } from "./ProjektorFileSystem.js";
import { documentPath, validateDocumentPaths } from "./paths.js";

test("Filer projects use authenticated native documents, preserve bytes, reject stale writes and survive restart", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "projektor-filer-"));
  const filerToken = "test-filer-token-".repeat(4);
  let server, base, cookie, owner;
  async function start() {
    server = createInventoryServer({ directory, filerToken });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
    cookie = undefined;
  }
  async function close() {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server = undefined;
  }
  async function post(route, params, headers) {
    const response = await fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(params) });
    return { response, value: await response.json() };
  }
  async function login() {
    const { response, value } = await post("/session", { email: "filer-test@example.invalid", password: "filer-test-secret" }, { Origin: base });
    assert.equal(response.status, 200, JSON.stringify(value));
    cookie = response.headers.get("set-cookie").split(";")[0];
    owner = value.owner;
  }
  async function operation(method, params = {}, shouldFail = false) {
    const { response, value } = await post(`/api/projectDocuments/${method}`, params, { Origin: base, Cookie: cookie });
    if (shouldFail) { assert.ok(!response.ok || value.error, JSON.stringify(value)); return; }
    assert.equal(response.status, 200, JSON.stringify(value));
    assert.ok(!value.error, JSON.stringify(value));
    return value.product;
  }
  async function rpc(method, params = {}, token = filerToken, extraHeaders = {}) {
    return post("/filer/rpc", { jsonrpc: "2.0", id: 1, method, params }, { Authorization: `Bearer ${token}`, ...extraHeaders });
  }
  try {
    await start();
    assert.equal((await rpc("ping")).response.status, 401);
    await login();
    assert.equal((await rpc("ping", {}, "wrong")).response.status, 401);
    assert.equal((await rpc("ping", {}, filerToken, { Origin: "https://foreign.example" })).response.status, 403);
    assert.equal((await post("/filer/rpc", { jsonrpc: "2.0", id: 1, method: "ping" }, { Origin: base, Cookie: cookie })).response.status, 401);
    let catalog = await operation("getSnapshot");
    catalog = await operation("createProject", { projectId: "demo", label: "Demo / Kita", expectedVersion: catalog.version });
    let project = catalog.projects[0];
    catalog = await operation("createProject", { projectId: "other", label: "Demo / Kita", expectedVersion: catalog.version });
    const bytes = Buffer.from([0, 1, 2, 255, 128, 13, 10, 65]);
    const input = { projectRef: project.ref, expectedVersion: project.version, source: { projectId: "demo", repoUrl: "file:///demo" }, path: "Plans/design.bin", revision: "test-fixture-v1", contentBase64: bytes.toString("base64") };
    project = await operation("importDocument", input);
    await operation("importDocument", input, true);
    await operation("importDocument", { ...input, expectedVersion: project.version, source: { projectId: "other", repoUrl: "file:///other" } }, true);
    for (const invalid of ["../escape.bin", "/absolute.bin", "Plans/./file.bin", "plans/other.bin", "Plans/design.bin/child", "Plans/DESIGN.bin", "\\escape.bin"]) {
      await operation("importDocument", { ...input, path: invalid, expectedVersion: project.version }, true);
    }
    const root = (await rpc("readDir", { path: "/" })).value.result;
    assert.deepEqual(root.children, ["Projekte"]);
    const folders = (await rpc("readDir", { path: "/Projekte" })).value.result.children;
    assert.equal(new Set(folders).size, 2);
    const folder = folders.find(folder => folder.includes(project.ref));
    const nativePath = `/Projekte/${folder}/Dokumente/Plans/design.bin`;
    assert.match(folder, /Demo %2F Kita/);
    assert.deepEqual((await rpc("stat", { path: nativePath })).value.result, { mode: 0o100444, size: bytes.length, contentHash: project.documents[0].blob, metadataHash: project.documents[0].ref });
    const initialRead = await rpc("readFile", { path: nativePath });
    assert.ok(initialRead.value.result, JSON.stringify(initialRead.value));
    assert.deepEqual(Buffer.from(initialRead.value.result.content, "base64"), bytes);
    const downloadUrl = `${base}/documents/${project.ref}/${project.documents[0].ref}`;
    assert.equal((await fetch(downloadUrl)).status, 401);
    const downloaded = await fetch(downloadUrl, { headers: { Cookie: cookie } });
    assert.match(downloaded.headers.get("content-disposition"), /attachment/);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    assert.deepEqual(Buffer.from((await rpc("readFileInChunks", { path: nativePath, length: 3, position: 2 })).value.result.content, "base64"), bytes.subarray(2, 5));
    for (const params of [{ length: -1, position: 0 }, { length: 1, position: 0.5 }]) assert.equal((await rpc("readFileInChunks", { path: nativePath, ...params })).value.error.code, -22);
    assert.equal((await rpc("readFile", { path: "/Projekte" })).value.error.code, -21);
    assert.equal((await rpc("readDir", { path: nativePath })).value.error.code, -20);
    assert.equal((await rpc("readDir", { path: "/Projekte/../objects" })).value.error.code, -22);
    for (const method of ["writeFile", "createFile", "createDir", "rename", "unlink", "rmdir"]) {
      assert.equal((await rpc(method, { path: nativePath, content: "YQ==" })).value.error.code, -13);
    }
    assert.equal((await operation("getProject", { projectRef: project.ref })).version, project.version);
    const plan = new ProjectDocumentsPlan({ owner });
    await plan.init();
    const artifactRef = project.documents[0].ref;
    await assert.rejects(plan.readDocument({ projectRef: catalog.projects[1].ref, artifactRef }), /no longer published/);
    const expected = await operation("getSnapshot");
    await close();
    await start();
    await login();
    assert.deepEqual(await operation("getSnapshot"), expected);
    assert.deepEqual(Buffer.from((await rpc("readFile", { path: nativePath })).value.result.content, "base64"), bytes);
    const concurrent = await Promise.all([
      operation("importDocument", { ...input, expectedVersion: project.version, revision: "test-fixture-v2", contentBase64: "YQ==" }).then(value => ({ value }), error => ({ error })),
      operation("importDocument", { ...input, expectedVersion: project.version, revision: "test-fixture-v3", contentBase64: "Yg==" }).then(value => ({ value }), error => ({ error })),
    ]);
    assert.equal(concurrent.filter(result => result.value).length, 1);
    project = await operation("getProject", { projectRef: project.ref });
    const freshPlan = new ProjectDocumentsPlan({ owner });
    await freshPlan.init();
    await assert.rejects(freshPlan.readDocument({ projectRef: project.ref, artifactRef }), /no longer published/);
    await operation("removeDocument", { projectRef: project.ref, expectedVersion: project.version, artifactRef: project.documents[0].ref });
    assert.equal((await rpc("readFile", { path: nativePath })).value.error.code, -2);
    await assert.rejects(freshPlan.readDocument({ projectRef: project.ref, artifactRef: project.documents[0].ref }), /no longer published/);
    await close();
    await start();
    await login();
    assert.equal((await rpc("readFile", { path: nativePath })).value.error.code, -2);
  } finally {
    if (server) await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("projection rechecks domain read authority after resolving metadata", async () => {
  const projectRef = "a".repeat(64);
  const fs = new ProjektorFileSystem({
    getSnapshot: async () => ({ projects: [{ ref: projectRef, label: "Demo", documents: [{ path: "a.txt", ref: "b".repeat(64), size: 1 }] }] }),
    readDocument: async () => { throw new Error("Permission revoked"); },
  });
  await assert.rejects(fs.readFile(`/Projekte/Demo [${projectRef}]/Dokumente/a.txt`), /Permission revoked/);
});

test("native names are reversible and reject normalization collisions", () => {
  assert.equal(documentPath("a%2Fb/c:d.txt"), "a%252Fb/c%3Ad.txt");
  for (const paths of [["a", "a/b"], ["A/b", "a/c"], ["é.txt", "e\u0301.txt"], ["a.txt", "a.txt"]]) assert.throws(() => validateDocumentPaths(paths), /Conflicting/);
  validateDocumentPaths(["a/b.txt", "a/c.txt", "d.txt"]);
});
