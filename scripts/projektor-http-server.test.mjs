import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createProjektorHttpServer } from "./projektor-http-server.mjs";
import { LANES } from "../packages/ci.core/lanes.mjs";

test("static lane aliases preserve overrides and resolve each built lane shell", async t => {
  const staticDir = await mkdtemp(path.join(os.tmpdir(), "projektor-routes-"));
  await mkdir(path.join(staticDir, "lab"));
  for (const lane of LANES) {
    await writeFile(path.join(staticDir, "lab", `${lane.id}.html`), `<div id="lab-root">${lane.id}</div>`);
  }
  const server = createProjektorHttpServer({ registry: {}, staticDir, port: 0 });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(staticDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const lane of LANES) {
    const search = "?commServer=ws%3A%2F%2F127.0.0.1%3A9";
    for (const slash of ["", "/"]) {
      const alias = await fetch(`${base}${lane.route}${slash}${search}`, { redirect: "manual" });
      assert.equal(alias.status, 302);
      assert.equal(alias.headers.get("location"), `${lane.entry}${search}`);
      const shell = await fetch(`${base}${lane.entry}${slash}`);
      assert.equal(shell.status, 200);
      assert.equal(await shell.text(), `<div id="lab-root">${lane.id}</div>`);
    }
  }
  assert.equal((await fetch(`${base}/lab/unknown`)).status, 404);
});
