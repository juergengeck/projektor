import assert from "node:assert/strict";
import { createDemoProjectSchedule } from "../../demo-kita-2028.project.js";
import { createProjectScheduleStateDagUpdate } from "../project.core/index.js";
import {
  PROJECT_DAG_EXCEL_PROJECTION_TYPE,
  ProjectDagExcelProjectionRecipe,
  createProjectDagExcelProjection,
  csvFromProjectDagExcelSheet,
  getProjectDagExcelSheet,
} from "./index.js";

const update = createProjectScheduleStateDagUpdate(createDemoProjectSchedule(), {
  managedTaskId: "entwurf",
  now: 2,
});

const projection = createProjectDagExcelProjection(update, {
  activePhaseId: "lp3",
  roles: {
    architect: {
      id: "architect",
      label: "Architekt",
      type: "Planung",
      permissions: ["schedule:write"],
    },
  },
  sharedTrieRoots: [
    { path: "/projekt", visibility: { architect: "full" } },
    { path: "/kosten", visibility: { architect: "filtered" } },
  ],
  importModel: {
    source: "test-import",
    previewRows: [["=Bauherr", "Owner", "Projekt", "voll"]],
  },
  exportModel: {
    type: "xlsx",
    sections: [["Journal", "Audit rows"]],
  },
  journalRows: 3,
});

assert.equal(projection.projection.$type$, PROJECT_DAG_EXCEL_PROJECTION_TYPE);
assert.equal(projection.projection.sourcePlanId, update.bundle.plan.planId);
assert.equal(projection.projection.sourceWorkloadId, update.bundle.workload.workloadId);
assert.equal(ProjectDagExcelProjectionRecipe.rule[0].isId, true);

const schedule = getProjectDagExcelSheet(projection, "schedule");
assert.equal(schedule.rows.length, 8);
assert.equal(schedule.rows[0].state_id, "project:demo-kita-2028:schedule-task:bedarf-klaeren");
assert.equal(schedule.columns.some(([key]) => key === "critical"), true);

const edges = getProjectDagExcelSheet(projection, "dag_edges");
assert.equal(edges.rows.length, 8);
assert.equal(edges.rows[2].type, "SS");
assert.equal(edges.rows[2].lag_days, 5);

const planner = getProjectDagExcelSheet(projection, "planner_steps");
assert.equal(planner.rows.length, 6);
assert.equal(planner.rows[0].capability, "project.core.cpm-scheduler");

const workload = getProjectDagExcelSheet(projection, "workload");
assert.equal(workload.rows.length, 8);
assert.equal(workload.rows.filter((row) => row.mutable).length, 6);

const participants = getProjectDagExcelSheet(projection, "participants");
const csv = csvFromProjectDagExcelSheet(participants);
assert.match(csv, /^"Beteiligter","Rolle","E-Mail"/);
assert.match(csv, /"'=Bauherr"/);

const responsibilities = getProjectDagExcelSheet(projection, "responsibilities");
assert.equal(responsibilities.columns.some(([, label]) => label === "Sichtbare Datenbereiche"), true);
assert.equal(JSON.stringify(responsibilities.columns).includes("Trie"), false);

assert.equal(getProjectDagExcelSheet(projection, "missing").sheetId, "schedule");
