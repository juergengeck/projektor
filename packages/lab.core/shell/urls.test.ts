// packages/lab.core/shell/urls.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK } from "../brand.ts";
import { labAppUrl } from "./urls.ts";

test("addresses the lane app with instance and session", () => {
  assert.equal(
    labAppUrl("https://example.com/lab/", AMWAY, "admin", "abc12345"),
    "https://example.com/browser/app/?lane=amway&labInstance=admin&labSession=abc12345",
  );
  assert.equal(
    labAppUrl("http://127.0.0.1:3001/eklab/", EK, "seller", "s01"),
    "http://127.0.0.1:3001/browser/app/?lane=ek&labInstance=seller&labSession=s01",
  );
});

test("replaces the lane path and query instead of appending", () => {
  assert.equal(
    labAppUrl("https://example.com/browser/lab/?lane=amway", AMWAY, "manager", "mid99"),
    "https://example.com/browser/app/?lane=amway&labInstance=manager&labSession=mid99",
  );
});
