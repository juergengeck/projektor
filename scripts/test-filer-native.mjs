#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const tokenFile = process.env.PROJEKTOR_FILER_TOKEN_FILE;
if (!tokenFile) throw new Error("Set PROJEKTOR_FILER_TOKEN_FILE to the local runtime's token file.");
const token = (await readFile(tokenFile, "utf8")).trim();
const endpoint = process.env.PROJEKTOR_FILER_ENDPOINT || "http://127.0.0.1:4175/filer/rpc";
if (!["127.0.0.1", "localhost"].includes(new URL(endpoint).hostname)) throw new Error("Native test endpoint must be local.");
async function rpc(method, path) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { path } }) });
  const value = await response.json();
  if (!response.ok || value.error) throw new Error(JSON.stringify(value));
  return value.result;
}
const { children } = await rpc("readDir", "/Projekte");
const matches = children.filter(name => name.startsWith("Kita 2028 Demo ["));
if (matches.length !== 1) throw new Error("Run filer:demo before the native test.");
const path = `/Projekte/${matches[0]}/Dokumente/README.md`;
const metadata = await rpc("stat", path);
const child = spawn("swift", ["test", "--filter", "ReadOnlyDomainRpcTests"], {
  cwd: fileURLToPath(new URL("../../filer/one.provider", import.meta.url)),
  stdio: "inherit",
  env: { ...process.env, ONE_FILER_DOMAIN_TEST_ENDPOINT: endpoint, ONE_FILER_DOMAIN_TEST_TOKEN: token, ONE_FILER_DOMAIN_TEST_PATH: path, ONE_FILER_DOMAIN_TEST_SHA256: metadata.contentHash },
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
