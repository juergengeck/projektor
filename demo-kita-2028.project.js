import { createProjectPlan } from "./project.core.js";

export const demoProjectBoundary = {
  projectId: "demo-kita-2028",
  dataOwner: "active project graph",
  appLogic: [
    "route state and rendering",
    "ONE package wiring",
    "planner.core/updater.core orchestration",
    "CPM calculation and schedule projection",
    "project import/export envelope",
  ],
  domainCore: [
    "HOAI.core phases and cross-cutting topics",
    "HOAI.core workflow templates",
    "project.core schedule validation and CPM solver",
  ],
  projectSpecific: [
    "project title and localized labels",
    "roles and visible trie roots",
    "task ids, durations, owners, phase refs and dependencies",
    "mail preview, import preview and journal entries",
  ],
};

export function createDemoProjectSchedule() {
  return createProjectPlan({
    projectId: "demo-kita-2028",
    projectStart: "2026-06-01",
    tasks: [
      {
        id: "bedarf-klaeren",
        label: "Bedarf und Nutzerprogramm klären",
        owner: "Bauherr",
        phase: "LP1",
        durationDays: 8,
      },
      {
        id: "vorplanung",
        label: "Varianten und Kostenrahmen abstimmen",
        owner: "Architekt",
        phase: "LP2",
        durationDays: 15,
      },
      {
        id: "entwurf",
        label: "Entwurf und Kostenberechnung freigeben",
        owner: "Architekt",
        phase: "LP3",
        durationDays: 20,
      },
      {
        id: "foerdermittel",
        label: "Fördermitteltermin sichern",
        owner: "Projektsteuerer",
        phase: "LP3",
        durationDays: 10,
      },
      {
        id: "genehmigungsmappe",
        label: "Genehmigungsmappe erstellen",
        owner: "Architekt",
        phase: "LP4",
        durationDays: 18,
      },
      {
        id: "behoerdenlauf",
        label: "Behördenlauf und Rückfragen",
        owner: "Behörde",
        phase: "LP4",
        durationDays: 30,
      },
      {
        id: "ausfuehrungsplanung",
        label: "Ausführungsplanung freigeben",
        owner: "Architekt",
        phase: "LP5",
        durationDays: 24,
      },
      {
        id: "rohbau",
        label: "Rohbau beauftragen und starten",
        owner: "Gewerk",
        phase: "LP6-LP8",
        durationDays: 35,
      },
    ],
    dependencies: [
      { from: "bedarf-klaeren", to: "vorplanung", type: "FS", lagDays: 0 },
      { from: "vorplanung", to: "entwurf", type: "FS", lagDays: 0 },
      { from: "entwurf", to: "foerdermittel", type: "SS", lagDays: 5 },
      { from: "entwurf", to: "genehmigungsmappe", type: "FS", lagDays: 2 },
      { from: "foerdermittel", to: "genehmigungsmappe", type: "FF", lagDays: 0 },
      { from: "genehmigungsmappe", to: "behoerdenlauf", type: "FS", lagDays: 0 },
      { from: "behoerdenlauf", to: "ausfuehrungsplanung", type: "FS", lagDays: -5 },
      { from: "ausfuehrungsplanung", to: "rohbau", type: "FS", lagDays: 3 },
    ],
  });
}
