export const REQUIREMENT_STATUSES = Object.freeze(["planned", "inProgress", "ready", "accepted"]);

const READY_STATUSES = new Set(["ready", "accepted"]);

function clone(value) {
  return structuredClone(value);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
}

function assertUniqueIds(items, label) {
  const ids = new Set();
  items.forEach((item) => {
    if (!item?.id) throw new TypeError(`Every ${label} needs an id.`);
    if (ids.has(item.id)) throw new Error(`${label} ids must be unique: ${item.id}`);
    ids.add(item.id);
  });
  return ids;
}

function normalizeSourceRef(sourceRef) {
  if (typeof sourceRef === "string") {
    return { ref: sourceRef, label: sourceRef, kind: "source" };
  }
  if (!sourceRef?.ref || !sourceRef?.label) {
    throw new TypeError("Requirement source references need ref and label.");
  }
  return {
    kind: "source",
    ...clone(sourceRef),
  };
}

export function normalizeProjectRequirements(input) {
  if (!input?.projectId) throw new TypeError("Project requirement plan needs a projectId.");
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1) {
    throw new TypeError(`Unsupported project requirement schema version: ${input.schemaVersion}`);
  }
  assertArray(input.handoverPoints, "Handover points");
  assertArray(input.requirements, "Requirements");

  const handoverPointIds = assertUniqueIds(input.handoverPoints, "handover point");
  assertUniqueIds(input.requirements, "requirement");

  const handoverPoints = input.handoverPoints.map((point) => ({
    ...clone(point),
    type: "ProjectHandoverPoint",
    requirementIds: [],
  }));

  const requirements = input.requirements.map((requirement) => {
    if (!handoverPointIds.has(requirement.handoverPointId)) {
      throw new Error(`Requirement ${requirement.id} references unknown handover point: ${requirement.handoverPointId}`);
    }
    const status = requirement.status || "planned";
    if (!REQUIREMENT_STATUSES.includes(status)) {
      throw new TypeError(`Unsupported requirement status: ${status}`);
    }
    assertArray(requirement.acceptanceCriteria || [], `Acceptance criteria for ${requirement.id}`);
    assertArray(requirement.sourceRefs || [], `Source references for ${requirement.id}`);
    return {
      ...clone(requirement),
      type: "ProjectRequirement",
      status,
      acceptanceCriteria: clone(requirement.acceptanceCriteria || []),
      sourceRefs: (requirement.sourceRefs || []).map(normalizeSourceRef),
    };
  });

  const requirementIdsByPoint = new Map(handoverPoints.map((point) => [point.id, []]));
  requirements.forEach((requirement) => requirementIdsByPoint.get(requirement.handoverPointId).push(requirement.id));
  handoverPoints.forEach((point) => {
    point.requirementIds = requirementIdsByPoint.get(point.id);
  });

  return {
    ...clone(input),
    type: "ProjectRequirementPlan",
    schemaVersion: 1,
    handoverPoints,
    requirements,
  };
}

export function isRequirementReady(requirement) {
  return READY_STATUSES.has(requirement?.status);
}

export function summarizeRequirementPlan(input) {
  const plan = normalizeProjectRequirements(input);
  const summaries = plan.handoverPoints.map((point) => {
    const requirements = plan.requirements.filter((requirement) => requirement.handoverPointId === point.id);
    const ready = requirements.filter(isRequirementReady).length;
    const accepted = requirements.filter((requirement) => requirement.status === "accepted").length;
    return {
      ...point,
      requirementCount: requirements.length,
      readyCount: ready,
      acceptedCount: accepted,
      readiness: requirements.length ? Math.round((ready / requirements.length) * 100) : 0,
    };
  });

  const readyCount = plan.requirements.filter(isRequirementReady).length;
  return {
    requirementCount: plan.requirements.length,
    readyCount,
    acceptedCount: plan.requirements.filter((requirement) => requirement.status === "accepted").length,
    readiness: plan.requirements.length ? Math.round((readyCount / plan.requirements.length) * 100) : 0,
    handoverPoints: summaries,
  };
}

export function setRequirementStatus(input, requirementId, status) {
  if (!REQUIREMENT_STATUSES.includes(status)) {
    throw new TypeError(`Unsupported requirement status: ${status}`);
  }
  const plan = normalizeProjectRequirements(input);
  const requirement = plan.requirements.find((item) => item.id === requirementId);
  if (!requirement) throw new Error(`Unknown requirement: ${requirementId}`);
  requirement.status = status;
  return normalizeProjectRequirements(plan);
}
