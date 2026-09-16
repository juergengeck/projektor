import assert from "node:assert/strict";
import {
  normalizeProjectRequirements,
  setRequirementStatus,
  summarizeRequirementPlan,
} from "./index.js";

const input = {
  projectId: "demo",
  handoverPoints: [
    { id: "design", label: "Design release", targetDate: "2026-08-01" },
    { id: "operation", label: "Operational handover", targetDate: "2027-08-01" },
  ],
  requirements: [
    {
      id: "plan",
      title: "Approved plan",
      handoverPointId: "design",
      status: "accepted",
      acceptanceCriteria: ["Approval is attributable"],
      sourceRefs: [{ ref: "source:plan", label: "Plan V14", kind: "drawing" }],
    },
    {
      id: "cost",
      title: "Cost calculation",
      handoverPointId: "design",
      status: "inProgress",
      acceptanceCriteria: [],
      sourceRefs: [],
    },
    {
      id: "manual",
      title: "Operator manual",
      handoverPointId: "operation",
      status: "ready",
      acceptanceCriteria: [],
      sourceRefs: ["source:manual"],
    },
  ],
};

const normalized = normalizeProjectRequirements(input);
assert.equal(normalized.type, "ProjectRequirementPlan");
assert.deepEqual(normalized.handoverPoints[0].requirementIds, ["plan", "cost"]);
assert.equal(normalized.requirements[2].sourceRefs[0].label, "source:manual");

const summary = summarizeRequirementPlan(input);
assert.equal(summary.requirementCount, 3);
assert.equal(summary.readyCount, 2);
assert.equal(summary.readiness, 67);
assert.equal(summary.handoverPoints[0].readiness, 50);

const advanced = setRequirementStatus(input, "cost", "ready");
assert.equal(advanced.requirements.find((item) => item.id === "cost").status, "ready");
assert.equal(input.requirements.find((item) => item.id === "cost").status, "inProgress");

assert.throws(
  () => normalizeProjectRequirements({ ...input, requirements: [{ ...input.requirements[0], handoverPointId: "missing" }] }),
  /unknown handover point/,
);
assert.throws(() => setRequirementStatus(input, "cost", "unknown"), /Unsupported requirement status/);
assert.throws(() => normalizeProjectRequirements({ ...input, schemaVersion: 2 }), /Unsupported project requirement schema version/);
