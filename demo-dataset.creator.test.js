import assert from "node:assert/strict";
import {
  DEMO_DATASET_CREATOR_SKILL,
  PROJECT_DATATYPE_KIND,
  PROJECT_DATATYPE_VERSION,
  createDemoDatasetProject,
  listDemoDatasetPlans,
} from "./demo-dataset.creator.js";
import { createProjectScheduleStateDagUpdate } from "./packages/project.core/index.js";
import { summarizeProjectFileIndex } from "./packages/project-source.core/index.js";

const plans = listDemoDatasetPlans();
const userFacingInternalVocabulary = /Trie|Leseast|Kostentrie|Trie-Pfad|Trie-Wurzeln|Trie-Ast|Projektast|Baustellenast|Ausfuehrungsast|Zugangsast|Nachweis- und Abnahmeast|LP4-Ast/;

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
  assert.equal(dataset.projectSource.source.adapter, "source.git");
  assert.equal(dataset.projectSource.index.projectId, dataset.project.id);
  assert.ok(dataset.exportModel.sections.some(([section]) => section === "Git-Quelle"));
  assert.ok(summarizeProjectFileIndex(dataset.projectSource).totalFiles >= 3);
  assert.ok(dataset.importModel.previewRows.length >= 4);
  assert.equal(userFacingInternalVocabulary.test(JSON.stringify({
    roles: dataset.roleModel.roles,
    cockpit: dataset.cockpit,
    assistant: dataset.assistant,
    journal: dataset.journal,
    importModel: dataset.importModel,
  })), false);

  const update = createProjectScheduleStateDagUpdate(dataset.planning.schedule, {
    managedTaskId: dataset.planning.schedule.tasks[0].id,
    now: 1780402500000,
  });

  assert.equal(update.schedule.tasks.length, plan.scale.tasks);
  assert.ok(update.schedule.criticalPath.length > 0);
  assert.ok(dataset.creator.plannerEvidence.skillContracts.includes("project.core.cpm-scheduler"));
  assert.ok(dataset.creator.plannerEvidence.skillContracts.includes("projektor.demo-dataset-creator"));
}

const ngoDataset = createDemoDatasetProject("ngo-supporter-program");
assert.equal(ngoDataset.planning.labels.eyebrow, "NGO Programmphasen");
assert.equal(ngoDataset.planning.labels.statusPhasePrefix, "");
assert.equal(ngoDataset.planning.labels.flowsEyebrow, "NGO Abläufe");
assert.equal(ngoDataset.planning.phases[0].id, "programm");
assert.equal(ngoDataset.planning.flowDomains[0].id, "donations");
assert.equal(
  ngoDataset.planning.flowDomains.some((flow) => flow.id === "invoices"),
  false,
);
assert.equal(
  ngoDataset.planning.topics.some(([, text]) => text.includes("DIN 276")),
  false,
);
assert.equal(JSON.stringify(ngoDataset.assistant).includes("HOAI-Kontext"), false);
assert.equal(JSON.stringify(ngoDataset.assistant).includes("Kostenfreigaben"), false);
assert.equal(JSON.stringify(ngoDataset.assistant).includes("Betreiberpflichten"), false);

const kitaDataset = createDemoDatasetProject("kita-2028-expanded");
assert.equal(
  kitaDataset.planning.topics.some(([, text]) => text.includes("DIN 276")),
  true,
);

assert.equal(createDemoDatasetProject("missing-plan").creator.plan.id, plans[0].id);
