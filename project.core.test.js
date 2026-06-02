import assert from "node:assert/strict";
import { createProjectScheduleStateDagUpdate, scheduleProject, topologicalSort } from "./project.core.js";

const tasks = [
  { id: "a", durationDays: 2 },
  { id: "b", durationDays: 3 },
  { id: "c", durationDays: 4 },
  { id: "d", durationDays: 1 },
];

const dependencies = [
  { from: "a", to: "b", type: "FS", lagDays: 0 },
  { from: "a", to: "c", type: "SS", lagDays: 1 },
  { from: "b", to: "d", type: "FS", lagDays: 0 },
  { from: "c", to: "d", type: "FF", lagDays: 0 },
];

const plan = scheduleProject({
  projectId: "test",
  projectStart: "2026-06-01",
  tasks,
  dependencies,
});

assert.deepEqual(plan.topologicalOrder, ["a", "b", "c", "d"]);
assert.equal(plan.projectFinishDay, 6);

const byId = Object.fromEntries(plan.tasks.map((task) => [task.id, task]));
assert.equal(byId.a.earlyStart, 0);
assert.equal(byId.a.earlyFinish, 2);
assert.equal(byId.c.earlyStart, 1);
assert.equal(byId.c.earlyFinish, 5);
assert.equal(byId.d.earlyStart, 5);
assert.equal(byId.d.earlyFinish, 6);
assert.equal(byId.b.totalFloat, 0);
assert.equal(byId.c.totalFloat, 1);
assert.deepEqual(plan.criticalPath, ["a", "b", "d"]);

const update = createProjectScheduleStateDagUpdate({
  projectId: "test",
  projectStart: "2026-06-01",
  tasks,
  dependencies,
}, { managedTaskId: "a", now: 2 });

assert.equal(update.bundle.plan.topologicalStateIds.length, 4);
assert.equal(update.bundle.workload.skillContracts[0].skillId, "project.core.cpm-scheduler");
assert.equal(update.oneIntegration.oneModels.modelClass, "Model");
assert.match(update.oneIntegration.oneCore.stableStringifier, /one\.core/);

assert.throws(
  () =>
    topologicalSort(tasks, [
      ...dependencies,
      { from: "d", to: "a", type: "FS", lagDays: 0 },
    ]),
  /cycle/,
);

assert.throws(
  () =>
    scheduleProject({
      tasks: [{ id: "x", durationDays: -1 }],
      dependencies: [],
    }),
  /non-negative/,
);
