# Projekt Requirements and Handover Plan

Status: first prototype slice implemented.

## Product outcome

Projektor gives every project role a shared, explicit view of what a successful
handover contains. Requirements are structured project data stored locally.
They remain connected to the source material delivered by planners, contractors,
authorities, and the client.

The first UI slice answers four questions:

1. Which handover points are planned?
2. Which requirements belong to each handover point?
3. Who is accountable and what confirms acceptance?
4. Which original sources support the structured project state?

## Structured model

`ProjectRequirementPlan` owns:

- one project reference;
- ordered `ProjectHandoverPoint` records;
- `ProjectRequirement` records assigned to exactly one handover point.

Each requirement contains:

- stable project-local ID;
- title and category;
- accountable role;
- target date;
- explicit acceptance criteria;
- status: `planned`, `inProgress`, `ready`, or `accepted`;
- one or more typed source references where source material exists.

Each handover point contains:

- stable project-local ID;
- label and phase transition;
- target date;
- a benefit statement;
- the requirement IDs assigned to it.

Readiness is a projection. `ready` and `accepted` requirements count toward the
handover percentage; the requirements remain the authoritative structured
records.

## Local state and sources

The prototype stores changed requirement statuses in browser-local storage,
scoped by project ID. The complete requirement plan remains part of the local
Projektor project datatype. Source references do not replace or flatten the
source artifacts: original drawings, documents, tables, mail, and journal
evidence remain separate source material and are shipped with the project.

## UI surface

The dedicated **Anforderungen** area contains:

- overall handover readiness;
- counts for requirements, handover points, and linked original sources;
- one visible card per handover point;
- a handover filter;
- a requirements table with accountability, target date, acceptance criteria,
  source links, and an editable status.

The initial construction demo plans these points explicitly:

1. Entwurf → Genehmigungsplanung
2. Genehmigungsmappe → Behörde
3. Ausführungsplanung → Vergabe
4. Bauwerk → Betrieb

## Next implementation slices

1. Replace browser-local status persistence with registered ONE objects in the
   owning runtime while retaining the same UI projection.
2. Add create/edit operations for requirements and handover points.
3. Bind source references to real `ProjectSourceArtifact`/BLOB references.
4. Add attributable acceptance and supersession journal events.
5. Add requirement templates for project-specific standards without making a
   template the authoritative project record.
6. Include requirements and handover projections in project tables and exports
   while continuing to ship their referenced source material.

Commercial packaging and service-model decisions are intentionally outside this
plan.
