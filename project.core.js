import { createMatchingSupply } from "../one/packages/matching.core/dist/index.js";
import { createPlannerGoal, createStateCapabilityDemand } from "../one/packages/planner.core/dist/index.js";
import { createStateDagNodeUpdate, createStateDagUpdate } from "../one/packages/updater.core/dist/index.js";
import { stringify as oneStableStringify } from "../one/packages/one.core/lib/util/sorted-stringify.js";
import { Model } from "../one/packages/one.models/lib/models/Model.js";
import { PropertyTree } from "../one/packages/one.models/lib/models/SettingsModel.js";

const DEPENDENCY_TYPES = new Set(["FS", "SS", "FF", "SF"]);

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function assertPlainArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array.`);
  }
}

function normalizeLagDays(value) {
  const lagDays = Number(value || 0);
  if (!Number.isFinite(lagDays)) {
    throw new TypeError("Dependency lagDays must be a finite number.");
  }
  return lagDays;
}

function normalizeDurationDays(value) {
  const durationDays = Number(value);
  if (!Number.isFinite(durationDays) || durationDays < 0) {
    throw new TypeError("Task durationDays must be a non-negative number.");
  }
  return durationDays;
}

function normalizeProjectPlan(input) {
  assertPlainArray(input?.tasks, "Project tasks");
  assertPlainArray(input?.dependencies, "Project dependencies");

  const tasks = input.tasks.map((task) => {
    if (!task?.id) throw new TypeError("Every task needs an id.");
    return {
      ...clone(task),
      durationDays: normalizeDurationDays(task.durationDays),
    };
  });

  const taskIds = new Set(tasks.map((task) => task.id));
  if (taskIds.size !== tasks.length) {
    throw new Error("Task ids must be unique.");
  }

  const dependencies = input.dependencies.map((dependency) => {
    const type = dependency?.type || "FS";
    if (!DEPENDENCY_TYPES.has(type)) {
      throw new TypeError(`Unsupported dependency type: ${type}`);
    }
    if (!taskIds.has(dependency.from)) {
      throw new Error(`Dependency references unknown predecessor task: ${dependency.from}`);
    }
    if (!taskIds.has(dependency.to)) {
      throw new Error(`Dependency references unknown successor task: ${dependency.to}`);
    }
    if (dependency.from === dependency.to) {
      throw new Error(`Task cannot depend on itself: ${dependency.from}`);
    }

    return {
      ...clone(dependency),
      type,
      lagDays: normalizeLagDays(dependency.lagDays),
    };
  });

  return {
    ...clone(input),
    tasks,
    dependencies,
  };
}

function buildAdjacency(tasks, dependencies) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const outgoing = new Map(tasks.map((task) => [task.id, []]));
  const incoming = new Map(tasks.map((task) => [task.id, []]));

  dependencies.forEach((dependency) => {
    outgoing.get(dependency.from).push(dependency);
    incoming.get(dependency.to).push(dependency);
  });

  return { byId, outgoing, incoming };
}

export function topologicalSort(tasks, dependencies) {
  const { outgoing, incoming } = buildAdjacency(tasks, dependencies);
  const remainingIncoming = new Map(tasks.map((task) => [task.id, incoming.get(task.id).length]));
  const queue = tasks.filter((task) => remainingIncoming.get(task.id) === 0).map((task) => task.id);
  const sorted = [];

  while (queue.length) {
    const taskId = queue.shift();
    sorted.push(taskId);

    outgoing.get(taskId).forEach((dependency) => {
      const nextCount = remainingIncoming.get(dependency.to) - 1;
      remainingIncoming.set(dependency.to, nextCount);
      if (nextCount === 0) queue.push(dependency.to);
    });
  }

  if (sorted.length !== tasks.length) {
    const cycleNodes = tasks
      .filter((task) => remainingIncoming.get(task.id) > 0)
      .map((task) => task.id);
    const error = new Error(`Project graph contains a cycle: ${cycleNodes.join(" -> ")}`);
    error.cycleNodes = cycleNodes;
    throw error;
  }

  return sorted;
}

function forwardStartConstraint(predecessor, successor, dependency) {
  const lag = dependency.lagDays;
  if (dependency.type === "FS") return predecessor.earlyFinish + lag;
  if (dependency.type === "SS") return predecessor.earlyStart + lag;
  if (dependency.type === "FF") return predecessor.earlyFinish + lag - successor.durationDays;
  return predecessor.earlyStart + lag - successor.durationDays;
}

function latestConstraint(predecessor, successor, dependency) {
  const lag = dependency.lagDays;
  if (dependency.type === "FS") return { field: "lateFinish", value: successor.lateStart - lag };
  if (dependency.type === "SS") return { field: "lateStart", value: successor.lateStart - lag };
  if (dependency.type === "FF") return { field: "lateFinish", value: successor.lateFinish - lag };
  return { field: "lateStart", value: successor.lateFinish - lag };
}

function applyLateConstraint(task, constraint) {
  if (constraint.field === "lateFinish") {
    task.lateFinish = Math.min(task.lateFinish, constraint.value);
    task.lateStart = task.lateFinish - task.durationDays;
    return;
  }

  task.lateStart = Math.min(task.lateStart, constraint.value);
  task.lateFinish = task.lateStart + task.durationDays;
}

function stableId(prefix, values) {
  return `${prefix}:${values.map((value) => encodeURIComponent(String(value))).join(":")}`;
}

function unique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function taskStateId(projectId, taskId) {
  return `project:${projectId || "project"}:schedule-task:${taskId}`;
}

function taskIdFromStateId(stateId) {
  return String(stateId).split(":schedule-task:").at(-1);
}

function stableTaskContentHash(task, incomingDependencies) {
  return oneStableStringify({
    id: task.id,
    durationDays: task.durationDays,
    startNoEarlierThanDay: task.startNoEarlierThanDay ?? null,
    owner: task.owner ?? null,
    phase: task.phase ?? null,
    dependencies: incomingDependencies
      .map((dependency) => ({
        from: dependency.from,
        type: dependency.type,
        lagDays: dependency.lagDays,
      }))
      .sort((left, right) => `${left.from}:${left.type}`.localeCompare(`${right.from}:${right.type}`)),
  });
}

function scheduleDependencyEdges(plan) {
  return plan.dependencies.map((dependency) => ({
    fromStateId: taskStateId(plan.projectId, dependency.from),
    toStateId: taskStateId(plan.projectId, dependency.to),
    reason: `${dependency.type}${dependency.lagDays ? ` ${dependency.lagDays}d` : ""}`,
  }));
}

export function scheduleProject(input) {
  const plan = normalizeProjectPlan(input);
  const { byId, outgoing, incoming } = buildAdjacency(plan.tasks, plan.dependencies);
  const order = topologicalSort(plan.tasks, plan.dependencies);
  const scheduled = new Map();

  order.forEach((taskId) => {
    const task = byId.get(taskId);
    const constrainedStart = Number.isFinite(task.startNoEarlierThanDay) ? task.startNoEarlierThanDay : 0;
    const earlyStart = incoming.get(taskId).reduce((latestStart, dependency) => {
      const predecessor = scheduled.get(dependency.from);
      const successor = { durationDays: task.durationDays };
      return Math.max(latestStart, forwardStartConstraint(predecessor, successor, dependency));
    }, constrainedStart);

    scheduled.set(taskId, {
      ...clone(task),
      earlyStart,
      earlyFinish: earlyStart + task.durationDays,
    });
  });

  const projectFinish = Number.isFinite(plan.finishNoLaterThanDay)
    ? plan.finishNoLaterThanDay
    : Math.max(0, ...Array.from(scheduled.values()).map((task) => task.earlyFinish));

  [...order].reverse().forEach((taskId) => {
    const task = scheduled.get(taskId);
    task.lateFinish = projectFinish;
    task.lateStart = projectFinish - task.durationDays;
  });

  [...order].reverse().forEach((taskId) => {
    const predecessor = scheduled.get(taskId);
    outgoing.get(taskId).forEach((dependency) => {
      const successor = scheduled.get(dependency.to);
      applyLateConstraint(predecessor, latestConstraint(predecessor, successor, dependency));
    });
  });

  const tasks = order.map((taskId) => {
    const task = scheduled.get(taskId);
    const totalFloat = task.lateStart - task.earlyStart;
    return {
      ...task,
      totalFloat,
      isCritical: Math.abs(totalFloat) < 0.000001,
    };
  });

  return {
    projectId: plan.projectId,
    projectStart: plan.projectStart,
    projectFinishDay: projectFinish,
    topologicalOrder: order,
    criticalPath: tasks.filter((task) => task.isCritical).map((task) => task.id),
    tasks,
    dependencies: clone(plan.dependencies),
  };
}

export function createProjectSchedulePlannerGoal(input, options = {}) {
  const plan = normalizeProjectPlan(input);
  const dependenciesByTarget = new Map(plan.tasks.map((task) => [task.id, []]));
  plan.dependencies.forEach((dependency) => {
    dependenciesByTarget.get(dependency.to).push(dependency);
  });

  const targetStateRefs = plan.tasks.map((task) => ({
    stateId: taskStateId(plan.projectId, task.id),
    contentHash: stableTaskContentHash(task, dependenciesByTarget.get(task.id) || []),
    role: "target",
    description: task.label || task.id,
  }));
  const createdAt = options.createdAt ?? options.now ?? Date.now();
  const updatedAt = options.updatedAt ?? createdAt;

  return createPlannerGoal({
    goalId: options.goalId || stableId("project-schedule-goal", [plan.projectId || "project", plan.projectStart || "", createdAt]),
    title: options.title || `Resolve project schedule for ${plan.projectId || "project"}`,
    status: options.status || "active",
    targetStateRefs,
    ...(options.observedStateRefs ? { observedStateRefs: clone(options.observedStateRefs) } : {}),
    assumptions: unique([
      "Typed project dependencies are acyclic state-DAG edges.",
      "CPM forward/backward passes resolve temporal bounds after planner.core orders impacted state.",
      ...(options.assumptions || []),
    ]),
    createdAt,
    updatedAt,
  });
}

export function getOneIntegrationSurface() {
  const model = new Model();
  const propertyTree = new PropertyTree();
  return {
    oneCore: {
      stableStringifier: "one.core/lib/util/sorted-stringify.stringify",
      sampleHashInput: oneStableStringify({ project: "projektor.one", graph: "schedule" }),
    },
    oneModels: {
      modelClass: model.constructor.name,
      initialModelState: model.state?.currentState || "Uninitialised",
      propertyTreeClass: propertyTree.constructor.name,
      propertyTreeEvents: Boolean(propertyTree.onSettingChange),
    },
  };
}

export function createProjectScheduleStateDagUpdate(input, options = {}) {
  const planInput = normalizeProjectPlan(input);
  const schedule = scheduleProject(planInput);
  const now = options.now ?? Date.now();
  const goal = createProjectSchedulePlannerGoal(planInput, {
    goalId: options.goalId,
    title: options.title,
    now,
  });
  const dependencyEdges = scheduleDependencyEdges(planInput);
  const allStateIds = planInput.tasks.map((task) => taskStateId(planInput.projectId, task.id));
  const changedStateIds = options.changedTaskIds?.length
    ? options.changedTaskIds.map((taskId) => taskStateId(planInput.projectId, taskId))
    : allStateIds;
  const diagnostics = [
    {
      kind: "critical-path",
      message: `${schedule.criticalPath.length} critical task states`,
      stateIds: schedule.criticalPath.map((taskId) => taskStateId(planInput.projectId, taskId)),
    },
    ...(options.diagnostics || []),
  ];
  const supplies = [
    createMatchingSupply({
      supplierId: "project.core",
      capability: {
        capabilityId: "project.core.cpm-scheduler",
        kind: "critical-path-schedule",
        domains: ["project.schedule"],
        inputShapes: ["project.task-dag"],
        outputShapes: ["project.schedule-state"],
        effects: ["compute"],
        tags: ["cpm", "dag", "temporal-boundary-solver"],
      },
    }),
    ...(options.supplies || []),
  ];
  const demandForState = (state) => createStateCapabilityDemand({
    demanderId: "project.core",
    stateId: state.stateId,
    kind: "critical-path-schedule",
    domains: ["project.schedule"],
    inputShapes: ["project.task-dag"],
    outputShapes: ["project.schedule-state"],
  });
  const adapters = {
    createDiagnosticMemories: ({ diagnostics: items, bundle, now: memoryCreatedAt }) =>
      items.map((diagnostic) => ({
        memoryId: stableId("project-schedule-memory", [bundle.plan.planId, diagnostic.kind || "diagnostic"]),
        diagnostic,
        createdAt: memoryCreatedAt,
      })),
    ...(options.adapters || {}),
  };
  const updateParams = {
    goal,
    dependencyEdges,
    changedStateIds,
    supplies,
    demandForState,
    diagnostics,
    adapters,
    constraints: unique([
      "Reject cyclic task graphs before scheduling.",
      "Preserve typed edge semantics and lag in the CPM solver.",
      ...(options.constraints || []),
    ]),
    evidenceRefs: options.evidenceRefs,
    now,
  };
  const update = options.managedTaskId
    ? createStateDagNodeUpdate({
      ...updateParams,
      managedStateId: taskStateId(planInput.projectId, options.managedTaskId),
    })
    : createStateDagUpdate(updateParams);
  return {
    ...update,
    schedule,
    dependencyEdges,
    oneIntegration: getOneIntegrationSurface(),
  };
}

export function createProjectPlan(plan) {
  return normalizeProjectPlan(plan);
}
