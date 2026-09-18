// packages/ci.core/ci-core.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { LANES, REPO_ROOT, laneById } from "./lanes.mjs";

test("every lane resolves to a real suite, route and entry", () => {
  assert.ok(LANES.length >= 2, "lanes under test");
  assert.deepEqual(new Set(LANES.map(lane => lane.id)).size, LANES.length, "lane ids are unique");
  for (const lane of LANES) {
    for (const field of ["title", "packageDir", "route", "entry", "hash", "offerId"]) {
      assert.ok(typeof lane[field] === "string" && lane[field].length > 0, `${lane.id}.${field}`);
    }
    const suite = fs.readdirSync(path.join(REPO_ROOT, lane.packageDir)).filter(file => file.endsWith(".test.ts"));
    assert.ok(suite.length > 0, `${lane.id} has suite files`);
  }
});

test("the runner refuses unknown lanes without running anything", () => {
  const out = spawnSync(process.execPath, ["packages/ci.core/run-lane-suite.mjs", "nope"], { encoding: "utf8", cwd: REPO_ROOT });
  assert.notEqual(out.status, 0);
  assert.match(out.stderr + out.stdout, /unknown lane/);
});

test("laneById resolves every registered lane", () => {
  for (const lane of LANES) assert.equal(laneById(lane.id), lane);
});
