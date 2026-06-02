import assert from "node:assert/strict";
import {
  createHoaiPlanningDefaults,
  HOAI_CORE_VERSION,
  normalizeHoaiPlanning,
  phaseById,
} from "./hoai.core.js";

const defaults = createHoaiPlanningDefaults();

assert.equal(HOAI_CORE_VERSION, "0.1.0");
assert.ok(defaults.phases.length >= 6);
assert.ok(defaults.flowDomains.some((flow) => flow.id === "calendar"));
assert.equal(phaseById(defaults.phases, "lp3").title, "Entwurfsplanung");

const normalized = normalizeHoaiPlanning({
  phases: [{ id: "custom", title: "Custom phase" }],
  topics: [["Termine", "Schedule control"]],
  flowDomains: [{ id: "custom-flow", steps: ["do it"] }],
});

assert.equal(normalized.phases[0].short, "CUSTOM");
assert.deepEqual(normalized.flowDomains[0].owners, []);

assert.throws(
  () => normalizeHoaiPlanning({ phases: [{ id: "x" }, { id: "x" }] }),
  /unique/,
);
