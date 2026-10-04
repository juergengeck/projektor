// packages/lab.core/shell/urls.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK, IGM } from "../brand.ts";
import { labAppUrl, laneFromHostPath, laneHostUrl } from "./urls.ts";

test("addresses the lane app with instance and session", () => {
  assert.equal(
    labAppUrl("https://example.com/lab/", AMWAY, "admin", "abc12345"),
    "https://example.com/browser/app/?lane=amway&labInstance=admin&labSession=abc12345",
  );
  assert.equal(
    labAppUrl("http://127.0.0.1:3001/eklab/", EK, "seller", "s01"),
    "http://127.0.0.1:3001/browser/app/?lane=ek&labInstance=seller&labSession=s01",
  );
  assert.equal(
    labAppUrl("https://projektor.one/igm/lab", IGM, "customer", "abc12345"),
    "https://projektor.one/browser/app/?lane=igm&labInstance=customer&labSession=abc12345",
  );
});

test("replaces the lane path and query instead of appending", () => {
  assert.equal(
    labAppUrl("https://example.com/browser/lab/?lane=amway", AMWAY, "manager", "mid99"),
    "https://example.com/browser/app/?lane=amway&labInstance=manager&labSession=mid99",
  );
});

test("forwards a commserver override to the iframe, rejecting non-ws values", () => {
  assert.equal(
    labAppUrl("https://example.com/browser/lab/?commServer=ws%3A%2F%2F127.0.0.1%3A4001", AMWAY, "admin", "abc12345"),
    "https://example.com/browser/app/?lane=amway&labInstance=admin&labSession=abc12345&commServer=ws%3A%2F%2F127.0.0.1%3A4001",
  );
  assert.equal(
    labAppUrl("https://example.com/browser/lab/?commServer=https%3A%2F%2Fexample.com", AMWAY, "admin", "abc12345"),
    "https://example.com/browser/app/?lane=amway&labInstance=admin&labSession=abc12345",
  );
});

test("lane host lives at /lab/<lane>", () => {
  assert.equal(laneHostUrl("https://projektor.one", AMWAY), "https://projektor.one/lab/amway");
  assert.equal(laneHostUrl("http://127.0.0.1:4276", EK), "http://127.0.0.1:4276/lab/ek");
  assert.equal(laneHostUrl("https://projektor.one", IGM), "https://projektor.one/lab/igm");
  assert.equal(laneFromHostPath("/lab/amway"), "amway");
  assert.equal(laneFromHostPath("/lab/ek/"), "ek");
  assert.equal(laneFromHostPath("/lab/igm"), "igm");
  assert.equal(laneFromHostPath("/browser/lab/"), null);
  assert.equal(laneFromHostPath("/lab/"), null);
});
