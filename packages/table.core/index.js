import { stringify as oneStableStringify } from "../../../one/packages/one.core/lib/util/sorted-stringify.js";

export const PROJECT_DAG_EXCEL_PROJECTION_TYPE = "ProjectDagExcelProjection";
export const PROJECT_DAG_EXCEL_SCHEMA_VERSION = "0.1.0";

export const ProjectDagExcelProjectionRecipe = {
  $type$: "Recipe",
  name: PROJECT_DAG_EXCEL_PROJECTION_TYPE,
  rule: [
    { itemprop: "projectionId", itemtype: { type: "string" }, isId: true },
    { itemprop: "projectId", itemtype: { type: "string" } },
    { itemprop: "sourcePlanId", itemtype: { type: "string" } },
    { itemprop: "sourceWorkloadId", itemtype: { type: "string" } },
    { itemprop: "managedStateId", itemtype: { type: "string" }, optional: true },
    { itemprop: "sheetIds", itemtype: { type: "array", item: { type: "string" } } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
    { itemprop: "createdAt", itemtype: { type: "integer" } },
  ],
};

export const TableCoreRecipes = [ProjectDagExcelProjectionRecipe];
export const TableCoreReverseMaps = [];
export const TableCoreReverseMapsForIdObjects = [];

export const PROJECT_DAG_TABLE_VIEWS = [
  ["schedule", "Fortschritt", "Schedule DAG"],
  ["dag_edges", "DAG Kanten", "Dependencies"],
  ["planner_steps", "Planner", "State steps"],
  ["workload", "Workload", "Read/target/mutable"],
  ["responsibilities", "Verantwortung", "Responsibilities"],
  ["participants", "Beteiligte", "Participants"],
  ["export_manifest", "Export", "XLSX manifest"],
];

const COLUMN_DEFS = {
  schedule: [
    ["task_id", "Task ID", "text"],
    ["state_id", "State ID", "text"],
    ["task", "Aufgabe", "text"],
    ["phase", "Phase", "text"],
    ["owner", "Verantwortlich", "text"],
    ["status", "Status", "text"],
    ["progress_pct", "Fortschritt %", "number"],
    ["start", "Start", "date"],
    ["finish", "Fertig", "date"],
    ["duration_days", "Dauer Tage", "number"],
    ["float_days", "Puffer Tage", "number"],
    ["critical", "Kritisch", "boolean"],
  ],
  dag_edges: [
    ["edge_id", "Edge ID", "text"],
    ["from_task", "Von Task", "text"],
    ["to_task", "Zu Task", "text"],
    ["from_state_id", "Von State", "text"],
    ["to_state_id", "Zu State", "text"],
    ["type", "Typ", "text"],
    ["lag_days", "Lag Tage", "number"],
    ["reason", "Grund", "text"],
    ["critical_edge", "Kritische Kante", "boolean"],
  ],
  planner_steps: [
    ["ordinal", "Nr.", "number"],
    ["task_id", "Task ID", "text"],
    ["state_id", "State ID", "text"],
    ["status", "Status", "text"],
    ["depends_on_steps", "Abhängige Steps", "number"],
    ["capability", "Capability", "text"],
    ["match_score", "Match Score", "number"],
    ["explanation", "Erklärung", "text"],
  ],
  workload: [
    ["state_id", "State ID", "text"],
    ["task_id", "Task ID", "text"],
    ["read", "Read", "boolean"],
    ["target", "Target", "boolean"],
    ["mutable", "Mutable", "boolean"],
    ["mode", "Modus", "text"],
    ["skill_contracts", "Skill Contracts", "number"],
    ["constraints", "Constraints", "number"],
  ],
  responsibilities: [
    ["role_key", "Role Key", "text"],
    ["role", "Rolle", "text"],
    ["type", "Typ", "text"],
    ["responsibility", "Verantwortung", "text"],
    ["permissions", "Berechtigungen", "text"],
    ["visible_roots", "Sichtbare Datenbereiche", "number"],
    ["access_scope", "Zugriff", "text"],
    ["handoff", "Uebergabe", "text"],
  ],
  participants: [
    ["participant", "Beteiligter", "text"],
    ["role", "Rolle", "text"],
    ["email", "E-Mail", "text"],
    ["project_area", "Projektbereich", "text"],
    ["access", "Zugriff", "text"],
    ["phase", "Phase", "text"],
    ["source", "Quelle", "text"],
  ],
  export_manifest: [
    ["sheet_id", "Sheet ID", "text"],
    ["sheet_name", "XLSX Sheet", "text"],
    ["rows", "Zeilen", "number"],
    ["columns", "Spalten", "number"],
    ["source", "Quelle", "text"],
    ["update_rule", "Aktualisierung", "text"],
  ],
};

const VIEW_LABELS = new Map(PROJECT_DAG_TABLE_VIEWS.map(([id, label, ref]) => [id, { label, ref }]));

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array.`);
  }
}

function stableId(prefix, values) {
  const text = oneStableStringify(values);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${prefix}:${hash.toString(36)}`;
}

function projectPhaseNumber(value) {
  const match = String(value || "").match(/LP(\d)/i);
  return match ? Number(match[1]) : 99;
}

function taskIdFromStateId(stateId) {
  return String(stateId || "").split(":schedule-task:").at(-1) || String(stateId || "");
}

function taskStateId(projectId, taskId) {
  return `project:${projectId || "project"}:schedule-task:${taskId}`;
}

function projectDayToDate(projectStart, day) {
  const start = new Date(`${projectStart || "2026-06-01"}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + Math.round(Number(day || 0)));
  return start.toISOString().slice(0, 10);
}

function progressStatusForTask(task, activePhaseId) {
  const activePhase = projectPhaseNumber(activePhaseId);
  const taskPhase = projectPhaseNumber(task.phase);
  if (taskPhase < activePhase) return "abgeschlossen";
  if (taskPhase === activePhase && task.isCritical) return "Freigabe";
  if (taskPhase === activePhase) return "in Arbeit";
  return "geplant";
}

function progressPercentForTask(task, activePhaseId) {
  const status = progressStatusForTask(task, activePhaseId);
  if (status === "abgeschlossen") return 100;
  if (status === "Freigabe") return 72;
  if (status === "in Arbeit") return 54;
  return 0;
}

function accessSummaryForRole(roleKey, sharedTrieRoots) {
  const roots = sharedTrieRoots.filter((root) => root.visibility?.[roleKey] && root.visibility[roleKey] !== "none");
  const full = roots.filter((root) => root.visibility[roleKey] === "full").length;
  const filtered = roots.filter((root) => root.visibility[roleKey] === "filtered").length;
  return {
    roots,
    label: `${full} voll / ${filtered} gefiltert`,
  };
}

function makeSheet(sheetId, rows, ref) {
  const view = VIEW_LABELS.get(sheetId);
  return {
    sheetId,
    title: view?.label || sheetId,
    ref: ref || view?.ref || sheetId,
    columns: COLUMN_DEFS[sheetId],
    rows,
  };
}

function scheduleRows(update, activePhaseId) {
  const projectId = update.schedule.projectId || "project";
  return update.schedule.tasks.map((task) => ({
    task_id: task.id,
    state_id: taskStateId(projectId, task.id),
    task: task.label || task.id,
    phase: task.phase || "",
    owner: task.owner || "",
    status: progressStatusForTask(task, activePhaseId),
    progress_pct: progressPercentForTask(task, activePhaseId),
    start: projectDayToDate(update.schedule.projectStart, task.earlyStart),
    finish: projectDayToDate(update.schedule.projectStart, task.earlyFinish),
    duration_days: task.durationDays,
    float_days: task.totalFloat,
    critical: Boolean(task.isCritical),
  }));
}

function dagEdgeRows(update) {
  const projectId = update.schedule.projectId || "project";
  const tasksById = new Map(update.schedule.tasks.map((task) => [task.id, task]));
  const dependenciesByEdge = new Map(
    update.schedule.dependencies.map((dependency) => [
      `${taskStateId(projectId, dependency.from)}>${taskStateId(projectId, dependency.to)}`,
      dependency,
    ]),
  );

  return update.dependencyEdges.map((edge, index) => {
    const dependency = dependenciesByEdge.get(`${edge.fromStateId}>${edge.toStateId}`) || {};
    const fromTask = taskIdFromStateId(edge.fromStateId);
    const toTask = taskIdFromStateId(edge.toStateId);
    return {
      edge_id: stableId("edge", [edge.fromStateId, edge.toStateId, edge.reason, index]),
      from_task: fromTask,
      to_task: toTask,
      from_state_id: edge.fromStateId,
      to_state_id: edge.toStateId,
      type: dependency.type || String(edge.reason || "").split(" ")[0],
      lag_days: Number(dependency.lagDays || 0),
      reason: edge.reason || "",
      critical_edge: Boolean(tasksById.get(fromTask)?.isCritical && tasksById.get(toTask)?.isCritical),
    };
  });
}

function plannerStepRows(update) {
  return update.bundle.plan.steps.map((step) => ({
    ordinal: step.ordinal,
    task_id: taskIdFromStateId(step.stateId),
    state_id: step.stateId,
    status: step.status,
    depends_on_steps: step.dependsOnStepIds?.length || 0,
    capability: step.selectedMatch?.capabilityId || "",
    match_score: step.selectedMatch?.score || 0,
    explanation: step.explanation || "",
  }));
}

function workloadRows(update) {
  const workload = update.bundle.workload;
  const read = new Set(workload.readStateIds || []);
  const target = new Set(workload.targetStateIds || []);
  const mutable = new Set(workload.mutableStateIds || []);
  const stateIds = [...new Set([...target, ...read, ...mutable])];

  return stateIds.map((stateId) => ({
    state_id: stateId,
    task_id: taskIdFromStateId(stateId),
    read: read.has(stateId),
    target: target.has(stateId),
    mutable: mutable.has(stateId),
    mode: workload.mode,
    skill_contracts: workload.skillContracts?.length || 0,
    constraints: workload.constraints?.length || 0,
  }));
}

function responsibilityRows(roles, sharedTrieRoots) {
  return Object.entries(roles || {}).map(([roleKey, role]) => {
    const access = accessSummaryForRole(roleKey, sharedTrieRoots || []);
    return {
      role_key: roleKey,
      role: role.label || roleKey,
      type: role.type || "",
      responsibility: role.id || roleKey,
      permissions: (role.permissions || []).join("; "),
      visible_roots: access.roots.length,
      access_scope: access.label,
      handoff: roleKey === "architect" ? "koordiniert" : roleKey === "owner" ? "gibt frei" : "antwortet begrenzt",
    };
  });
}

function participantRows(importModel) {
  return (importModel?.previewRows || []).map(([participant, role, projectArea, access], index) => ({
    participant,
    role,
    email: `${String(role || "rolle").toLowerCase().replaceAll(" ", "-")}-${index + 1}@example.org`,
    project_area: projectArea,
    access,
    phase: index === 0 ? "LP1-LP9" : index === 1 ? "LP4" : index === 2 ? "LP5" : "LP6-LP8",
    source: importModel.source || "import",
  }));
}

function exportManifestRows(sheets, context) {
  const baseRows = sheets.map((sheet) => ({
    sheet_id: sheet.sheetId,
    sheet_name: sheet.title,
    rows: sheet.rows.length,
    columns: sheet.columns.length,
    source: sheet.ref,
    update_rule: "state-DAG projection",
  }));
  const exportSections = context.exportModel?.sections || [];
  return [
    ...baseRows,
    ...exportSections.map(([section, purpose]) => ({
      sheet_id: stableId("export-section", [section, purpose]),
      sheet_name: section,
      rows: section === "Journal" ? context.journalRows || 0 : 1,
      columns: 4,
      source: context.exportModel?.type || "export",
      update_rule: purpose,
    })),
  ];
}

export function createProjectDagExcelProjection(update, context = {}) {
  assertPlainObject(update, "Project DAG update");
  assertPlainObject(update.bundle, "Project DAG update bundle");
  assertPlainObject(update.bundle.plan, "Project DAG plan");
  assertPlainObject(update.bundle.workload, "Project DAG workload");
  assertPlainObject(update.schedule, "Project DAG schedule");
  assertArray(update.dependencyEdges, "Project DAG dependency edges");

  const projectId = context.projectId || update.schedule.projectId || "project";
  const createdAt = context.createdAt ?? update.bundle.plan.createdAt ?? Date.now();
  const sourcePlanId = update.bundle.plan.planId;
  const sourceWorkloadId = update.bundle.workload.workloadId;
  const projectionId = context.projectionId || stableId("project-dag-excel", [
    projectId,
    sourcePlanId,
    sourceWorkloadId,
    context.activePhaseId || "",
  ]);

  const coreSheets = [
    makeSheet("schedule", scheduleRows(update, context.activePhaseId), "project.core/state-dag:schedule"),
    makeSheet("dag_edges", dagEdgeRows(update), "project.core/state-dag:dependency-edges"),
    makeSheet("planner_steps", plannerStepRows(update), "planner.core:ReactiveDataFlowPlan.steps"),
    makeSheet("workload", workloadRows(update), "planner.core:PreparedWorkload"),
    makeSheet("responsibilities", responsibilityRows(context.roles || {}, context.sharedTrieRoots || []), "project.roles/access-projection"),
    makeSheet("participants", participantRows(context.importModel || {}), "import.previewRows"),
  ];
  const manifest = makeSheet("export_manifest", exportManifestRows(coreSheets, context), "table.core:ProjectDagExcelProjection");
  const sheets = [...coreSheets, manifest];
  const sheetIds = sheets.map((sheet) => sheet.sheetId);

  return {
    projection: {
      $type$: PROJECT_DAG_EXCEL_PROJECTION_TYPE,
      projectionId,
      projectId,
      sourcePlanId,
      sourceWorkloadId,
      ...(update.managedStateId ? { managedStateId: update.managedStateId } : {}),
      sheetIds,
      schemaVersion: PROJECT_DAG_EXCEL_SCHEMA_VERSION,
      createdAt,
    },
    sheets: Object.fromEntries(sheets.map((sheet) => [sheet.sheetId, sheet])),
    recipes: TableCoreRecipes,
    reverseMaps: TableCoreReverseMaps,
    reverseMapsForIdObjects: TableCoreReverseMapsForIdObjects,
  };
}

export function getProjectDagExcelSheet(projection, sheetId) {
  assertPlainObject(projection, "Project DAG Excel projection");
  const sheetIds = projection.projection.sheetIds;
  const activeSheetId = sheetIds.includes(sheetId) ? sheetId : sheetIds[0];
  return projection.sheets[activeSheetId];
}

export function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function csvFromProjectDagExcelSheet(sheet) {
  assertPlainObject(sheet, "Project DAG Excel sheet");
  const header = sheet.columns.map(([, label]) => label);
  const rows = sheet.rows.map((row) => sheet.columns.map(([key]) => row[key]));
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
