import assert from "node:assert/strict";
import {
  DEMO_DATASET_CREATOR_SKILL,
  PROJECT_DATATYPE_KIND,
  PROJECT_DATATYPE_VERSION,
  createDemoDatasetProject,
  listDemoDatasetPlans,
} from "./demo-dataset.creator.js";
import { createProjectScheduleStateDagUpdate } from "./packages/project.core/index.js";

const plans = listDemoDatasetPlans();

assert.equal(DEMO_DATASET_CREATOR_SKILL.skillId, "projektor.demo-dataset-creator");
assert.ok(plans.length >= 3);

for (const plan of plans) {
  const dataset = createDemoDatasetProject(plan.id);

  assert.equal(dataset.kind, PROJECT_DATATYPE_KIND);
  assert.equal(dataset.schemaVersion, PROJECT_DATATYPE_VERSION);
  assert.equal(dataset.creator.plan.id, plan.id);
  assert.equal(dataset.creator.skill.skillId, DEMO_DATASET_CREATOR_SKILL.skillId);
  assert.ok(dataset.project.id);
  assert.ok(dataset.roleModel.sharedTrieRoots.length >= 5);
  assert.equal(dataset.planning.schedule.tasks.length, plan.scale.tasks);
  assert.ok(dataset.assistant.goal.criteria.length >= 3);
  assert.ok(dataset.importModel.previewRows.length >= 4);

  const update = createProjectScheduleStateDagUpdate(dataset.planning.schedule, {
    managedTaskId: dataset.planning.schedule.tasks[0].id,
    now: 1780402500000,
  });

  assert.equal(update.schedule.tasks.length, plan.scale.tasks);
  assert.ok(update.schedule.criticalPath.length > 0);
  assert.ok(dataset.creator.plannerEvidence.skillContracts.includes("project.core.cpm-scheduler"));
  assert.ok(dataset.creator.plannerEvidence.skillContracts.includes("projektor.demo-dataset-creator"));
}

assert.equal(createDemoDatasetProject("missing-plan").creator.plan.id, plans[0].id);
