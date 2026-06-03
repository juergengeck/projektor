import { createMatchingSupply } from "../one/packages/matching.core/dist/index.js";
import { createHoaiPlanningDefaults } from "./hoai.core.js";
import { NGO_CAPABILITY, createNgoDemoProjectData } from "./packages/ngo.core/index.js";
import { createProjectPlan, createProjectScheduleStateDagUpdate } from "./packages/project.core/index.js";
import { createProjectSourceBundle, createProjectSourceExportSection } from "./packages/project-source.core/index.js";

export const PROJECT_DATATYPE_KIND = "projektor.one/project";
export const PROJECT_DATATYPE_VERSION = 1;

export const DEMO_DATASET_CREATOR_SKILL = {
  skillId: "projektor.demo-dataset-creator",
  label: "Demo Dataset Creator",
  capability: {
    capabilityId: "projektor.demo-dataset-creator",
    kind: "project-demo-dataset",
    domains: ["project.dataset", "project.schedule", "project.roles", "project.assistant", "ngo.donors", "ngo.participants"],
    inputShapes: ["demo-dataset-plan", "source.git"],
    outputShapes: ["projektor-project-datatype", "ngo-project-datatype", "project-source-bundle"],
    effects: ["generate", "replace-active-project", "export"],
    tags: ["local-first", "scenario-fixture", "planner-ready"],
  },
  guardrails: [
    "Generate complete project datatypes, not loose UI arrays.",
    "Validate every schedule through project.core before the dataset is offered.",
    "Keep generated credentials as source settings metadata only.",
    "Preserve human approval boundaries for roles, costs, permits and access.",
  ],
};

const DATASET_PLANS = [
  {
    id: "kita-2028-expanded",
    label: "Kita 2028 Plus",
    scenario: "Municipal daycare build with funding, permit, document and site handover paths.",
    density: "balanced",
    scale: { contacts: 48, trieRoots: 7, tasks: 10, journal: 8 },
    risk: "Mittel",
    projectStart: "2026-06-01",
  },
  {
    id: "clinic-wing-renovation",
    label: "Clinic Wing Renovation",
    scenario: "Occupied healthcare renovation with infection-control gates and night-work windows.",
    density: "complex",
    scale: { contacts: 86, trieRoots: 9, tasks: 12, journal: 10 },
    risk: "Hoch",
    projectStart: "2026-07-06",
  },
  {
    id: "housing-retrofit-wave",
    label: "Housing Retrofit Wave",
    scenario: "Multi-building energy retrofit with tenant communication, subsidy deadlines and serial site crews.",
    density: "wide",
    scale: { contacts: 132, trieRoots: 8, tasks: 11, journal: 9 },
    risk: "Mittel",
    projectStart: "2026-09-01",
  },
  {
    id: "ngo-supporter-program",
    label: "NGO Unterstützerinnen",
    scenario: "Spenderverwaltung und Teilnehmerinnen-Programm mit Visa-Fristen, Safeguarding und DSGVO-Austritt.",
    density: "domain",
    scale: { contacts: 9, trieRoots: 7, tasks: 8, journal: 7 },
    risk: "Fristen",
    projectStart: "2026-06-03",
  },
];

const ROLE_LIBRARY = {
  owner: {
    label: "Bauherr",
    type: "Projektrolle",
    id: "Budget, Freigaben und Betreiberpflichten",
    summary: "Sieht das Gesamtprojekt, priorisiert Entscheidungen und kontrolliert Budget- und Betreiberauflagen.",
    permissions: ["Gesamtprojekt", "Kostenfreigabe", "Terminkalender", "Journal und Export"],
  },
  architect: {
    label: "Architekt",
    type: "Projektrolle",
    id: "Projektanlage, Koordination und Planstand",
    summary: "Erstellt die Projektstruktur, koordiniert Leistungsphasen und haelt Plan-, Rollen- und Journalspuren zusammen.",
    permissions: ["Projektanlage", "Rolleneinladung", "Dokumentengruppen", "Projektassistenz"],
  },
  controller: {
    label: "Projektsteuerer",
    type: "Projektrolle",
    id: "Kosten, Termine und Berichtslagen",
    summary: "Fuehrt Termin-, Kosten- und Risikoberichte zusammen und bereitet Eskalationen fuer Freigaben vor.",
    permissions: ["Kostentrie", "Terminsteuerung", "Berichte", "Journal lesen"],
  },
  authority: {
    label: "Behoerde",
    type: "Externe Rolle",
    id: "Genehmigung und Nachweise",
    summary: "Sieht nur genehmigungsrelevante Unterlagen, Rueckfragen und Statusantworten.",
    permissions: ["LP4 Dokumente", "Rueckfragen", "Status lesen", "Kein Vollzugriff"],
  },
  trade: {
    label: "Gewerk",
    type: "Externe Rolle",
    id: "Ausfuehrung und Maengel",
    summary: "Arbeitet mit begrenzten Plan-, Termin- und Dokumentengruppen ab Vergabe und Baustelle.",
    permissions: ["Dokumentengruppe", "Termine", "Chat", "Journal begrenzt"],
  },
  specialist: {
    label: "Fachplanung",
    type: "Projektrolle",
    id: "TGA, Statik, Brandschutz und Nachweise",
    summary: "Pflegt Fachbeitraege, Nachweise und Abhaengigkeiten, ohne fremde Freigaben zu ueberschreiben.",
    permissions: ["Fachunterlagen", "Nachweise", "Rueckfragen", "Planstand kommentieren"],
  },
};

const PLAN_BUILDERS = {
  "kita-2028-expanded": buildKitaDataset,
  "clinic-wing-renovation": buildClinicDataset,
  "housing-retrofit-wave": buildHousingDataset,
  "ngo-supporter-program": buildNgoDataset,
};

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function datasetPlanById(planId) {
  const plan = DATASET_PLANS.find((item) => item.id === planId) || DATASET_PLANS[0];
  return clone(plan);
}

function roleSubset(keys) {
  return Object.fromEntries(keys.map((key) => [key, clone(ROLE_LIBRARY[key])]));
}

function root(path, object, owner, visibility, phase = "LP1-LP9") {
  return { path, object, owner, visibility, phase };
}

function createSkillSupply() {
  return createMatchingSupply({
    supplierId: "projektor.demo-dataset-creator",
    capability: DEMO_DATASET_CREATOR_SKILL.capability,
  });
}

function localizedProject({ id, title, subtitle, phase, risk, nodes, projectType = "construction", capabilityIds = [] }) {
  return {
    id,
    projectType,
    capabilityIds,
    objectType: "Projekt-ID",
    shortTitle: { de: title, en: title, fr: title, es: title },
    titles: { de: title, en: title, fr: title, es: title },
    subtitles: { de: subtitle, en: subtitle, fr: subtitle, es: subtitle },
    mapLabel: {
      de: "Aktiver Demo-Datensatz",
      en: "Active demo dataset",
      fr: "Jeu de donnees demo actif",
      es: "Dataset demo activo",
    },
    phase: { de: phase, en: phase, fr: phase, es: phase },
    risk: { de: risk, en: risk, fr: risk, es: risk },
    nodes: { de: nodes, en: nodes, fr: nodes, es: nodes },
  };
}

function createAssistant({ projectId, label, ref, focus, context, mutable, findings }) {
  return {
    goal: {
      type: "Assistenzauftrag",
      ref,
      objective: `${label}: ${focus}`,
      why: "Der Demo-Datensatz zeigt, wie Projektassistenz nur Luecken, Risiken und naechste Schritte vorbereitet; Freigaben bleiben bei Rollen mit Verantwortung.",
      criteria: findings,
    },
    workload: {
      type: "Arbeitsbereich",
      ref: `${projectId}/assistant/demo-check`,
      context,
      mutable,
      handoff: "Wenn neue Rechte, Kostenfreigaben, Betreiberpflichten oder breitere Quellenzugriffe noetig sind, geht der Lauf an die verantwortliche Projektrolle zurueck.",
    },
    run: {
      type: "Prueflauf",
      ref: "02.06.2026, 09:30",
      steps: [
        ["gelesen", "Projektrollen, Trie-Wurzeln und Terminplan gelesen"],
        ["geplant", "Dataset-Plan gegen schedule.core und HOAI-Kontext geprueft"],
        ["gefunden", `${findings.length} sichtbare Pruefpunkte erzeugt`],
        ["Pruefung", "Menschliche Rolle bewertet Vorschlaege"],
        ["gesichert", "Journalentwurf und Exportabschnitt vorbereitet"],
      ],
    },
  };
}

function createSettings(projectId, mailboxName) {
  return {
    ui: {
      type: "UISettings",
      section: "ui",
      theme: "light",
      language: "de",
      notifications: true,
    },
    imap: {
      section: "sourceImap",
      accountId: `${projectId}-project-mail`,
      host: "imap.architekt.example",
      port: 993,
      secure: true,
      user: `${projectId}@example.org`,
      mailbox: mailboxName,
      enabled: true,
      hasPassword: true,
    },
  };
}

function createImportModel({ source, sheets, previewRows }) {
  return {
    type: "Importvorschau",
    source,
    workbookSheets: sheets,
    previewRows,
  };
}

function createExportModel(projectLabel, sections) {
  return {
    type: "Projekt-Export",
    ref: projectLabel,
    sections,
    warnings: [
      "Passwoerter und Tokens werden nicht exportiert.",
      "Mailinhalte werden nur als Projektbezuege aufgefuehrt.",
      "Zugriffe werden als sichtbare Berechtigungsliste exportiert.",
    ],
  };
}

function createSourceBundle(projectId, plan, files = []) {
  return createProjectSourceBundle({
    source: {
      projectId,
      repoUrl: "https://github.com/juergengeck/projektor.git",
      defaultBranch: "main",
      rootPath: ".",
      detachedWorktreeRoot: "../vger-worktrees/projektor",
      trackedPathGlobs: [
        `projects/${projectId}/**`,
        "docs/**",
        "packages/**",
        "*.project.js",
      ],
    },
    branch: `project/${projectId}`,
    head: "working-tree",
    status: "dirty",
    generatedAt: "2026-06-03T09:30:00.000Z",
    ignoredPaths: ["dist", ".wrangler", "node_modules", ".env"],
    files: [
      { path: `projects/${projectId}/project.json`, kind: "project-graph", owner: "Projektleitung", phase: "LP1-LP9", status: "tracked" },
      { path: `projects/${projectId}/schedule.json`, kind: "schedule", owner: "Projektsteuerung", phase: plan.projectStart, status: "tracked" },
      { path: `projects/${projectId}/journal.ndjson`, kind: "journal", owner: "Projektleitung", phase: "laufend", status: "modified" },
      ...files,
    ],
  });
}

function runtimeFor(roles, phases, flowDomains) {
  return {
    activeRole: roles.architect ? "architect" : Object.keys(roles)[0],
    activePhase: phases.some((phase) => phase.id === "lp3") ? "lp3" : phases[0]?.id,
    activeFlow: flowDomains[0]?.id || "invoices",
    syncAgeMinutes: 12,
    journalExtra: 0,
  };
}

function enrichHoaiPlanning(schedule) {
  const planning = createHoaiPlanningDefaults();
  return {
    phases: planning.phases,
    topics: planning.topics,
    flowDomains: planning.flowDomains,
    schedule,
  };
}

function assertValidDataset(dataset) {
  const update = createProjectScheduleStateDagUpdate(dataset.planning.schedule, {
    managedTaskId: dataset.planning.schedule.tasks[0]?.id,
    supplies: [createSkillSupply()],
    now: 1780402500000,
  });
  return {
    ...dataset,
    creator: {
      skill: clone(DEMO_DATASET_CREATOR_SKILL),
      plan: dataset.creator.plan,
      plannerEvidence: {
        planId: update.bundle.plan.planId,
        skillContracts: [
          ...new Set([
            ...update.bundle.workload.skillContracts.map((contract) => contract.skillId),
            DEMO_DATASET_CREATOR_SKILL.skillId,
          ]),
        ],
        criticalPath: update.schedule.criticalPath,
      },
    },
  };
}

function composeDataset(plan, parts) {
  const planning = enrichHoaiPlanning(createProjectPlan(parts.schedule));
  const projectSource = parts.projectSource || createSourceBundle(parts.project.id, plan);
  const dataset = {
    kind: PROJECT_DATATYPE_KIND,
    schemaVersion: PROJECT_DATATYPE_VERSION,
    creator: {
      skill: clone(DEMO_DATASET_CREATOR_SKILL),
      plan,
      generatedAt: "2026-06-02T09:30:00.000Z",
    },
    project: parts.project,
    cockpit: parts.cockpit,
    roleModel: parts.roleModel,
    planning,
    assistant: parts.assistant,
    settings: parts.settings,
    projectSource,
    ngo: parts.ngo,
    mailPreview: parts.mailPreview,
    importModel: parts.importModel,
    exportModel: {
      ...parts.exportModel,
      sections: [
        ...(parts.exportModel?.sections || []),
        createProjectSourceExportSection(projectSource),
      ],
    },
    journal: parts.journal,
    runtime: runtimeFor(parts.roleModel.roles, planning.phases, planning.flowDomains),
  };
  return assertValidDataset(dataset);
}

function buildNgoDataset(plan) {
  const projectId = "demo-ngo-supporter-program";
  const ngo = createNgoDemoProjectData();
  const roles = {
    programLead: {
      label: "Programmleitung",
      type: "NGO Rolle",
      id: "Aufnahme, Abschluss, Safeguarding und Datenaufbewahrung",
      summary: "Steuert Aufnahmeentscheidungen, Ehemaligen-Übergänge, Meldewege und Lösch-/Aufbewahrungsregeln.",
      permissions: ["Teilnehmerinnen", "Safeguarding", "Austritt", "Export"],
    },
    caregiver: {
      label: "Betreuerin",
      type: "NGO Rolle",
      id: "Betreuung, Gesundheit, Gespräche und Alltag",
      summary: "Pflegt Eingewöhnung, Betreuungsgespräche, Gesundheit/Therapie und nächste Schritte im Programm.",
      permissions: ["Programmstatus", "Notizen", "Gesundheit", "Visum lesen"],
    },
    education: {
      label: "Bildungsbegleitung",
      type: "NGO Rolle",
      id: "Deutschkurs, Bildung, Ausbildung und Beruf",
      summary: "Koordiniert Deutschkurs, Bildungsplanung, Bewerbungsphase, Verträge und Übergang in Arbeit.",
      permissions: ["Deutschkurs", "Ausbildung", "Beruf", "Export Teilnehmerinnen"],
    },
    fundraising: {
      label: "Fundraising",
      type: "NGO Rolle",
      id: "Spenden, Mitglieder, Dank und Quittungen",
      summary: "Verwaltet Unterstützerinnen, Spenden, Dankstatus, jährliche Quittungsschwelle und Export Einzelspenden.",
      permissions: ["Spender", "Einzelspenden", "Quittungen", "Tags"],
    },
    safeguarding: {
      label: "Safeguarding",
      type: "Pflicht-Ablauf",
      id: "Kinderschutz, Meldewege und Eskalation",
      summary: "Achtet besonders bei Minderjährigen auf Vormundschaft, Meldewege und getrennte Verantwortlichkeiten.",
      permissions: ["Meldungen", "Eskalation", "Minderjährige", "Notfallnotizen"],
    },
  };

  const schedule = {
    projectId,
    projectStart: plan.projectStart,
    tasks: [
      { id: "erstkontakt", label: "Erstkontakt erfassen", owner: "Programmleitung", phase: "Programm", durationDays: 2 },
      { id: "aufnahme", label: "Aufnahmeentscheidung und Stammdaten", owner: "Programmleitung", phase: "Programm", durationDays: 5 },
      { id: "eingewoehnung", label: "Eingewöhnung und Betreuungszuordnung", owner: "Betreuerin", phase: "Programm", durationDays: 21 },
      { id: "deutschkurs", label: "Deutschkurs starten und Fortschritt pflegen", owner: "Betreuerin", phase: "Bildung", durationDays: 60 },
      { id: "bildung-ausbildung", label: "Bildungsplanung und Ausbildungspfad", owner: "Bildungsbegleitung", phase: "Bildung", durationDays: 75 },
      { id: "arbeit", label: "Übergang in Arbeit vorbereiten", owner: "Betreuerin", phase: "Arbeit", durationDays: 45 },
      { id: "verselbststaendigung", label: "Wohnung, Einkommen und Selbstständigkeit prüfen", owner: "Betreuerin", phase: "Austritt", durationDays: 30 },
      { id: "ehemalige", label: "Ehemalige, Löschung und Aufbewahrung anwenden", owner: "Programmleitung", phase: "Austritt", durationDays: 10 },
    ],
    dependencies: [
      { from: "erstkontakt", to: "aufnahme", type: "FS", lagDays: 0 },
      { from: "aufnahme", to: "eingewoehnung", type: "FS", lagDays: 0 },
      { from: "eingewoehnung", to: "deutschkurs", type: "FS", lagDays: 0 },
      { from: "deutschkurs", to: "bildung-ausbildung", type: "SS", lagDays: 20 },
      { from: "bildung-ausbildung", to: "arbeit", type: "FS", lagDays: 0 },
      { from: "arbeit", to: "verselbststaendigung", type: "FS", lagDays: 0 },
      { from: "verselbststaendigung", to: "ehemalige", type: "FS", lagDays: 0 },
    ],
  };

  return composeDataset(plan, {
    project: localizedProject({
      id: projectId,
      title: "Demo: NGO Unterstützerinnen",
      subtitle: "Spenderverwaltung und Teilnehmerinnen-Programm mit Fristen, Safeguarding und DSGVO-Austritt",
      phase: "NGO Programm",
      risk: plan.risk,
      nodes: ["Fundraising", "Programmleitung", "Betreuerin", "Safeguarding"],
      projectType: "ngo",
      capabilityIds: [NGO_CAPABILITY.capabilityId],
    }),
    cockpit: {
      metrics: [
        ["3", "Unterstützer", "Spenderinnen und Mitglieder mit Gesamt-, Dank- und Quittungsstatus."],
        ["860 €", "gesamt eingenommen", "Spenden, Mitgliedsbeiträge und Dauerspenden im aktuellen Demo-Bestand."],
        ["2", "noch zu bedanken", "Offene Dank- oder Quittungsfälle werden zuerst angezeigt."],
        ["3", "Teilnehmerinnen", "Programmstatus, Alter, Kinder und Visum-Fristen werden gemeinsam sichtbar."],
      ],
      lanes: [
        { title: "Spenden", text: "Personen, Einzelspenden, Tags, Dankstatus und Quittungsschwelle bleiben im NGO-Datenblock.", progress: 72 },
        { title: "Teilnehmerinnen", text: "Aktueller Stand ist linear, Visum, Deutschkurs und Ausbildung laufen parallel.", progress: 58 },
        { title: "Pflicht-Abläufe", text: "Safeguarding, Visa-Vorlauf und DSGVO-Austritt sind als eigene Prüfpunkte modelliert.", progress: 64 },
      ],
    },
    roleModel: {
      roles,
      runnerRoleKeys: ["programLead", "caregiver", "education", "fundraising"],
      runnerRoleWindowLayout: defaultRunnerLayout(),
      runnerProtocolSteps: ngoProtocolFor(projectId),
      sharedTrieRoots: [
        root(`/${projectId}/donors`, "NgoDonorTrieRoot", "fundraising", { programLead: "filtered", caregiver: "none", education: "none", fundraising: "full", safeguarding: "none" }),
        root(`/${projectId}/donations`, "NgoDonationTrieRoot", "fundraising", { programLead: "filtered", caregiver: "none", education: "none", fundraising: "full", safeguarding: "none" }),
        root(`/${projectId}/participants`, "NgoParticipantTrieRoot", "programLead", { programLead: "full", caregiver: "filtered", education: "filtered", fundraising: "none", safeguarding: "filtered" }),
        root(`/${projectId}/visa`, "NgoVisaDeadlineTrieRoot", "programLead", { programLead: "full", caregiver: "filtered", education: "filtered", fundraising: "none", safeguarding: "filtered" }),
        root(`/${projectId}/safeguarding`, "NgoSafeguardingTrieRoot", "safeguarding", { programLead: "filtered", caregiver: "filtered", education: "none", fundraising: "none", safeguarding: "full" }),
        root(`/${projectId}/retention`, "NgoRetentionTrieRoot", "programLead", { programLead: "full", caregiver: "none", education: "none", fundraising: "filtered", safeguarding: "filtered" }),
        root(`/${projectId}/journal`, "ProjectJournalTrieRoot", "programLead", { programLead: "full", caregiver: "filtered", education: "filtered", fundraising: "filtered", safeguarding: "filtered" }),
      ],
    },
    schedule,
    assistant: createAssistant({
      projectId,
      label: "NGO Unterstützerinnen",
      ref: "Visa/Safeguarding Check",
      focus: "Offene Visa-Fristen, Minderjährigenregeln und Dank-/Quittungspflichten sichtbar machen.",
      context: ["Teilnehmerinnen", "Visum", "Safeguarding", "Spenden", "Quittungen"],
      mutable: ["Wiedervorlagen", "Dankliste", "Journalentwuerfe"],
      findings: ["Visum Sita Rai im Vorlauf", "Minderjährige ohne Selbstverpflichtung", "Murat Demir braucht Dank und Quittungsprüfung"],
    }),
    settings: createSettings(projectId, "INBOX/Demo NGO"),
    ngo,
    mailPreview: [
      ["Heute", "Ausländerbehörde", "Wiedervorlage Schülerinnnenvisum", "visum"],
      ["Gestern", "Murat Demir", "Projektbesuch und Spendenquittung", "fundraising"],
      ["Mo", "Betreuerin", "Betreuungsgespräch und Safeguarding-Notiz", "programm"],
    ],
    importModel: createImportModel({
      source: "NGO Demo Dataset",
      sheets: [
        ["Spender", "Personen", 3, "Kontakt, Mitgliedschaft, Einwilligung, Dank und Quittungen"],
        ["Einzelspenden", "Beiträge", 6, "Typ, Betrag, Datum und Verwendungszweck"],
        ["Teilnehmerinnen", "Programm", 3, "Stammdaten, Status, Visum, Bildung und Betreuung"],
        ["Pflicht-Abläufe", "Compliance", 4, "Safeguarding, Visum, Betreuungsgespräch und DSGVO-Austritt"],
      ],
      previewRows: [
        ["Anne Keller", "Mitglied", `/${projectId}/donors`, "Fundraising voll"],
        ["Maya Rai", "Teilnehmerin", `/${projectId}/participants`, "Programmleitung voll"],
        ["Sita Rai", "Minderjährige", `/${projectId}/safeguarding`, "Safeguarding gefiltert"],
        ["Murat Demir", "Spender", `/${projectId}/donations`, "Quittung prüfen"],
      ],
    }),
    exportModel: createExportModel("Demo: NGO Unterstützerinnen", baseExportSections(["Spender", "Einzelspenden", "Teilnehmerinnen", "Safeguarding", "DSGVO-Austritt"])),
    journal: [
      ["2026-06-03 09:10", "NGO-Datensatz erzeugt", "Demo Dataset Creator hat Spender und Teilnehmerinnen als NGO-Projektgraph vorbereitet.", "NGO 001"],
      ["2026-06-03 09:18", "Visum markiert", "Sita Rai hat eine Frist im Vorlauf-Alarm.", "NGO 002"],
      ["2026-06-03 09:26", "Minderjährigkeit geprüft", "Selbstverpflichtung bleibt deaktiviert; Vormundschaft/Safeguarding beachten.", "NGO 003"],
      ["2026-06-03 09:40", "Dank offen", "Murat Demir und Lena Schulz stehen in der offenen Dankliste.", "NGO 004"],
    ],
  });
}

function buildKitaDataset(plan) {
  const projectId = "demo-kita-2028-plus";
  const roles = roleSubset(["owner", "architect", "controller", "authority", "trade", "specialist"]);
  const schedule = {
    projectId,
    projectStart: plan.projectStart,
    tasks: [
      { id: "bedarf-klaeren", label: "Bedarf und Nutzerprogramm klaeren", owner: "Bauherr", phase: "LP1", durationDays: 8 },
      { id: "foerderkulisse", label: "Foerderkulisse und Mittelbindung pruefen", owner: "Projektsteuerer", phase: "LP2", durationDays: 12 },
      { id: "vorplanung", label: "Varianten und Kostenrahmen abstimmen", owner: "Architekt", phase: "LP2", durationDays: 15 },
      { id: "entwurf", label: "Entwurf und Kostenberechnung freigeben", owner: "Architekt", phase: "LP3", durationDays: 20 },
      { id: "fachplanung", label: "Fachplanung TGA und Brandschutz synchronisieren", owner: "Fachplanung", phase: "LP3", durationDays: 16 },
      { id: "genehmigungsmappe", label: "Genehmigungsmappe erstellen", owner: "Architekt", phase: "LP4", durationDays: 18 },
      { id: "behoerdenlauf", label: "Behoerdenlauf und Rueckfragen", owner: "Behoerde", phase: "LP4", durationDays: 30 },
      { id: "ausfuehrungsplanung", label: "Ausfuehrungsplanung freigeben", owner: "Architekt", phase: "LP5", durationDays: 24 },
      { id: "vergabe-rohbau", label: "Rohbau ausschreiben und beauftragen", owner: "Gewerk", phase: "LP6-LP7", durationDays: 22 },
      { id: "rohbau", label: "Rohbau starten und Baustellenast aktivieren", owner: "Gewerk", phase: "LP8", durationDays: 35 },
    ],
    dependencies: [
      { from: "bedarf-klaeren", to: "foerderkulisse", type: "SS", lagDays: 3 },
      { from: "bedarf-klaeren", to: "vorplanung", type: "FS", lagDays: 0 },
      { from: "foerderkulisse", to: "entwurf", type: "FF", lagDays: 2 },
      { from: "vorplanung", to: "entwurf", type: "FS", lagDays: 0 },
      { from: "entwurf", to: "fachplanung", type: "SS", lagDays: 4 },
      { from: "entwurf", to: "genehmigungsmappe", type: "FS", lagDays: 2 },
      { from: "fachplanung", to: "genehmigungsmappe", type: "FF", lagDays: 0 },
      { from: "genehmigungsmappe", to: "behoerdenlauf", type: "FS", lagDays: 0 },
      { from: "behoerdenlauf", to: "ausfuehrungsplanung", type: "FS", lagDays: -5 },
      { from: "ausfuehrungsplanung", to: "vergabe-rohbau", type: "SS", lagDays: 6 },
      { from: "vergabe-rohbau", to: "rohbau", type: "FS", lagDays: 3 },
    ],
  };

  const trieRoots = [
    root(`/${projectId}/project-mail`, "ProjectMailTrieRoot", "architect", { owner: "full", architect: "full", controller: "full", authority: "filtered", trade: "filtered", specialist: "filtered" }),
    root(`/${projectId}/lp3/costs-din276`, "CostControlTrieRoot", "controller", { owner: "full", architect: "full", controller: "full", authority: "none", trade: "none", specialist: "filtered" }, "LP3"),
    root(`/${projectId}/lp4/permit-documents`, "ProjectDocumentTrieRoot", "architect", { owner: "full", architect: "full", controller: "filtered", authority: "filtered", trade: "none", specialist: "full" }, "LP4"),
    root(`/${projectId}/lp4/authority-questions`, "ProjectQuestionTrieRoot", "authority", { owner: "filtered", architect: "full", controller: "filtered", authority: "full", trade: "none", specialist: "filtered" }, "LP4"),
    root(`/${projectId}/lp5/planstand`, "PlanStateTrieRoot", "architect", { owner: "filtered", architect: "full", controller: "filtered", authority: "none", trade: "filtered", specialist: "full" }, "LP5"),
    root(`/${projectId}/lp8/site`, "ConstructionSiteTrieRoot", "architect", { owner: "filtered", architect: "full", controller: "filtered", authority: "none", trade: "filtered", specialist: "filtered" }, "LP8"),
    root(`/${projectId}/journal`, "ProjectJournalTrieRoot", "architect", { owner: "full", architect: "full", controller: "full", authority: "filtered", trade: "filtered", specialist: "filtered" }),
  ];

  return composeDataset(plan, {
    project: localizedProject({
      id: projectId,
      title: "Demo: Kita 2028 Plus",
      subtitle: "Kommunaler Kita-Neubau mit Foerderung, Fachplanung, Behoerdenlauf und Baustelle",
      phase: "3 Entwurf",
      risk: plan.risk,
      nodes: ["Bauherr", "Architekt", "Behoerde", "Gewerk"],
    }),
    cockpit: {
      metrics: [
        ["48", "Beteiligte", "Bauherr, Planung, Fachplanung, Pruefung, Behoerde und Gewerke."],
        ["7", "Trie-Wurzeln", "Projektmail, Kosten, Genehmigung, Rueckfragen, Planstand, Baustelle und Journal."],
        ["10", "Terminaufgaben", "CPM-faehiger Plan mit Foerder- und Genehmigungsabhaengigkeiten."],
        ["8", "Journalspuren", "Freigaben, Nachweise, Rollen, Quellen und Exportabschnitte."],
      ],
      lanes: [
        { title: "Foerderung", text: "Mittelbindung und Gremientermin bleiben mit Entwurf und Kosten verknuepft.", progress: 62 },
        { title: "Genehmigung", text: "Rueckfragen haengen am LP4-Ast statt an verstreuten Mails.", progress: 58 },
        { title: "Baustelle", text: "Gewerke erhalten erst nach Planstand-Freigabe den gefilterten Ausfuehrungsast.", progress: 37 },
      ],
    },
    roleModel: {
      roles,
      runnerRoleKeys: ["architect", "owner", "authority", "trade"],
      runnerRoleWindowLayout: defaultRunnerLayout(),
      runnerProtocolSteps: protocolFor(projectId, "LP3-Kostenfreigabe", "Stellplatznachweis und Brandschutzverweis"),
      sharedTrieRoots: trieRoots,
    },
    schedule,
    assistant: createAssistant({
      projectId,
      label: "Kita 2028 Plus",
      ref: "LP3/LP4 Uebergabe",
      focus: "Genehmigungsfaehigkeit und Foerdertermin ohne Nebenspuren absichern.",
      context: ["Planstand LP3", "Kosten DIN 276", "Foerderkulisse", "Behoerdenfragen", "Projektmail"],
      mutable: ["Aufgaben", "Risikohinweise", "Journalentwuerfe"],
      findings: ["Foerdertermin gesichert", "Brandschutz offen", "Stellplatznachweis offen", "Planstand LP5 gesperrt"],
    }),
    settings: createSettings(projectId, "INBOX/Demo Kita 2028 Plus"),
    mailPreview: [
      ["Heute", "Bauherr", "Kostenberechnung LP3 fuer Gremium vorbereiten", "entscheidung"],
      ["Gestern", "Behoerde", "Rueckfrage Stellplatznachweis", "lp4"],
      ["Mo", "Fachplanung TGA", "Energieannahmen aktualisiert", "fachplanung"],
    ],
    importModel: createImportModel({
      source: "Demo Dataset Creator",
      sheets: [
        ["Beteiligte", "Kontakte", 48, "Hauptkontakte, Stellvertretungen und Gewerke"],
        ["Rollen", "Zugriff", 22, "Projektrollen und Sichtbarkeit nach Leistungsphase"],
        ["Termine", "Kalender", 34, "Gremien, Behoerdenlauf und Bauzeitenplan"],
        ["Dokumente", "Planstand", 83, "Planstaende, Nachweise und Freigaben"],
      ],
      previewRows: [
        ["Bauherr Darmstadt", "Bauherr", `/${projectId}/lp3/costs-din276`, "voll"],
        ["Amt Bauaufsicht", "Behoerde", `/${projectId}/lp4/permit-documents`, "gefiltert"],
        ["TGA Fachplanung", "Fachplanung", `/${projectId}/lp5/planstand`, "lesen/schreiben"],
        ["Gewerk Rohbau", "Gewerk", `/${projectId}/lp8/site`, "begrenzt"],
      ],
    }),
    exportModel: createExportModel("Demo: Kita 2028 Plus", baseExportSections()),
    journal: [
      ["2026-06-02 09:12", "Datensatz erzeugt", "Demo Dataset Creator hat Kita 2028 Plus als Projektgraph vorbereitet.", "Dataset 001"],
      ["2026-06-02 09:20", "Foerderung verknuepft", "Foerderkulisse als Termin- und Kostenabhaengigkeit aufgenommen.", "Journal 002"],
      ["2026-06-02 09:28", "Rolle erweitert", "Fachplanung erhaelt eigenen gefilterten Trie-Ast.", "Journal 003"],
      ["2026-06-02 09:35", "Planstand gesperrt", "LP5 bleibt fuer Gewerke begrenzt, bis LP4-Rueckfrage geklaert ist.", "Journal 004"],
    ],
  });
}

function buildClinicDataset(plan) {
  const projectId = "demo-clinic-wing-renovation";
  const roles = roleSubset(["owner", "architect", "controller", "authority", "trade", "specialist"]);
  roles.operator = {
    label: "Betreiber",
    type: "Projektrolle",
    id: "Klinikbetrieb und Sperrzeiten",
    summary: "Steuert Betriebsfenster, Hygieneauflagen und Patientenschutz waehrend der Sanierung.",
    permissions: ["Betriebsfenster", "Hygieneauflagen", "Sperrbereiche", "Journal lesen"],
  };
  const schedule = {
    projectId,
    projectStart: plan.projectStart,
    tasks: [
      { id: "bestand-erheben", label: "Bestand und Schadstoffe erheben", owner: "Architekt", phase: "LP1", durationDays: 14 },
      { id: "betriebskonzept", label: "Betriebskonzept und Sperrzeiten abstimmen", owner: "Betreiber", phase: "LP2", durationDays: 18 },
      { id: "hygieneplan", label: "Hygiene- und Infektionsschutzplan freigeben", owner: "Fachplanung", phase: "LP2", durationDays: 16 },
      { id: "entwurf", label: "Sanierungsentwurf und Kosten freigeben", owner: "Architekt", phase: "LP3", durationDays: 24 },
      { id: "brandschutz", label: "Brandschutz und Fluchtwege nachweisen", owner: "Fachplanung", phase: "LP3", durationDays: 20 },
      { id: "genehmigung", label: "Nutzungsgenehmigung und Betreiberfreigabe", owner: "Behoerde", phase: "LP4", durationDays: 28 },
      { id: "ausfuehrungsplanung", label: "Bauabschnittsplaene einfrieren", owner: "Architekt", phase: "LP5", durationDays: 26 },
      { id: "ausschreibung", label: "Nacht- und Staubschutzgewerke vergeben", owner: "Projektsteuerer", phase: "LP6-LP7", durationDays: 24 },
      { id: "provisorien", label: "Provisorien und Schutzschleusen bauen", owner: "Gewerk", phase: "LP8", durationDays: 18 },
      { id: "bauteil-a", label: "Bauteil A nachts sanieren", owner: "Gewerk", phase: "LP8", durationDays: 36 },
      { id: "bauteil-b", label: "Bauteil B nachts sanieren", owner: "Gewerk", phase: "LP8", durationDays: 32 },
      { id: "abnahme", label: "Hygieneabnahme und Wiederinbetriebnahme", owner: "Betreiber", phase: "LP8", durationDays: 10 },
    ],
    dependencies: [
      { from: "bestand-erheben", to: "betriebskonzept", type: "SS", lagDays: 5 },
      { from: "bestand-erheben", to: "hygieneplan", type: "FS", lagDays: 0 },
      { from: "betriebskonzept", to: "entwurf", type: "FS", lagDays: 0 },
      { from: "hygieneplan", to: "entwurf", type: "FF", lagDays: 0 },
      { from: "entwurf", to: "brandschutz", type: "SS", lagDays: 6 },
      { from: "brandschutz", to: "genehmigung", type: "FS", lagDays: 0 },
      { from: "genehmigung", to: "ausfuehrungsplanung", type: "FS", lagDays: -4 },
      { from: "ausfuehrungsplanung", to: "ausschreibung", type: "SS", lagDays: 8 },
      { from: "ausschreibung", to: "provisorien", type: "FS", lagDays: 2 },
      { from: "provisorien", to: "bauteil-a", type: "FS", lagDays: 0 },
      { from: "bauteil-a", to: "bauteil-b", type: "FS", lagDays: 3 },
      { from: "bauteil-b", to: "abnahme", type: "FS", lagDays: 0 },
    ],
  };

  return composeDataset(plan, {
    project: localizedProject({
      id: projectId,
      title: "Demo: Klinikfluegel Sanierung",
      subtitle: "Sanierung im laufenden Betrieb mit Hygiene, Sperrzeiten und gestaffelter Ausfuehrung",
      phase: "3 Sanierungsentwurf",
      risk: plan.risk,
      nodes: ["Betreiber", "Architekt", "Behoerde", "Gewerk"],
    }),
    cockpit: {
      metrics: [
        ["86", "Beteiligte", "Klinikbetrieb, Planung, Hygiene, Brandschutz, Behoerde und Gewerke."],
        ["9", "Trie-Wurzeln", "Betrieb, Hygiene, Brandschutz, Sperrzeiten, Vergabe, Baustelle und Journal."],
        ["12", "Terminaufgaben", "Bauabschnitte mit Nachtfenstern und Betreiberfreigaben."],
        ["10", "Journalspuren", "Betriebsauflagen, Sperrbereiche, Nachweise und Abnahmen."],
      ],
      lanes: [
        { title: "Betrieb", text: "Sperrzeiten und Patientenschutz bestimmen die Bauabschnittsfreigaben.", progress: 51 },
        { title: "Hygiene", text: "Infektionsschutz ist als eigener Nachweis- und Abnahmeast sichtbar.", progress: 63 },
        { title: "Ausfuehrung", text: "Nachtarbeit und Provisorien sind terminbestimmende Abhaengigkeiten.", progress: 34 },
      ],
    },
    roleModel: {
      roles,
      runnerRoleKeys: ["architect", "owner", "operator", "trade"],
      runnerRoleWindowLayout: defaultRunnerLayout(),
      runnerProtocolSteps: protocolFor(projectId, "Hygieneschleuse", "Nachtfenster und Staubschutzfreigabe", "operator"),
      sharedTrieRoots: [
        root(`/${projectId}/operation/windows`, "OperationWindowTrieRoot", "operator", { owner: "full", architect: "full", controller: "filtered", authority: "none", trade: "filtered", specialist: "filtered", operator: "full" }, "LP2-LP8"),
        root(`/${projectId}/hygiene`, "HygieneEvidenceTrieRoot", "specialist", { owner: "filtered", architect: "full", controller: "filtered", authority: "filtered", trade: "filtered", specialist: "full", operator: "full" }),
        root(`/${projectId}/fire-safety`, "FireSafetyTrieRoot", "specialist", { owner: "full", architect: "full", controller: "filtered", authority: "filtered", trade: "none", specialist: "full", operator: "filtered" }),
        root(`/${projectId}/project-mail`, "ProjectMailTrieRoot", "architect", { owner: "full", architect: "full", controller: "full", authority: "filtered", trade: "filtered", specialist: "filtered", operator: "filtered" }),
        root(`/${projectId}/site/night-work`, "ConstructionSiteTrieRoot", "trade", { owner: "filtered", architect: "full", controller: "filtered", authority: "none", trade: "filtered", specialist: "filtered", operator: "filtered" }),
      ],
    },
    schedule,
    assistant: createAssistant({
      projectId,
      label: "Klinikfluegel Sanierung",
      ref: "Betrieb/Hygiene Check",
      focus: "Bauabschnitte, Hygieneauflagen und Betreiberfreigaben synchron halten.",
      context: ["Betriebsfenster", "Hygieneplan", "Brandschutz", "Nachtarbeit", "Projektmail"],
      mutable: ["Sperrbereich-Aufgaben", "Abnahmehinweise", "Journalentwuerfe"],
      findings: ["Hygieneabnahme terminbestimmend", "Brandschutz vor Genehmigung kritisch", "Nachtfenster limitiert Bauabschnitt B"],
    }),
    settings: createSettings(projectId, "INBOX/Demo Klinikfluegel"),
    mailPreview: [
      ["Heute", "Betreiber", "Sperrzeit Bauteil A nur nachts moeglich", "betrieb"],
      ["Gestern", "Hygiene", "Schleusenplan muss vor Vergabe vorliegen", "hygiene"],
      ["Mo", "Behoerde", "Brandschutzverweis fuer Nutzungsgenehmigung", "lp4"],
    ],
    importModel: createImportModel({
      source: "Demo Dataset Creator",
      sheets: [
        ["Beteiligte", "Kontakte", 86, "Klinikbetrieb, Planung, Fachstellen und Gewerke"],
        ["Sperrzeiten", "Kalender", 18, "Betriebsfenster und Nachtarbeit"],
        ["Nachweise", "Dokumente", 74, "Hygiene, Brandschutz und Betreiberfreigaben"],
        ["Bauabschnitte", "Terminplan", 12, "Abschnittslogik mit Provisorien"],
      ],
      previewRows: [
        ["Klinikbetrieb", "Betreiber", `/${projectId}/operation/windows`, "voll"],
        ["Hygienefachplanung", "Fachplanung", `/${projectId}/hygiene`, "voll"],
        ["Brandschutzpruefer", "Behoerde", `/${projectId}/fire-safety`, "gefiltert"],
        ["Trockenbau Nachtteam", "Gewerk", `/${projectId}/site/night-work`, "begrenzt"],
      ],
    }),
    exportModel: createExportModel("Demo: Klinikfluegel Sanierung", baseExportSections(["Betrieb", "Hygiene"])),
    journal: [
      ["2026-06-02 09:12", "Datensatz erzeugt", "Demo Dataset Creator hat Klinikfluegel Sanierung vorbereitet.", "Dataset 001"],
      ["2026-06-02 09:19", "Betrieb abgestimmt", "Sperrzeiten als sichtbarer Projektast angelegt.", "Journal 002"],
      ["2026-06-02 09:27", "Hygiene verknuepft", "Hygieneplan steuert Vergabe und Abnahme.", "Journal 003"],
      ["2026-06-02 09:41", "Abnahme geplant", "Wiederinbetriebnahme bleibt von Bauteil B und Hygieneabnahme abhaengig.", "Journal 004"],
    ],
  });
}

function buildHousingDataset(plan) {
  const projectId = "demo-housing-retrofit-wave";
  const roles = roleSubset(["owner", "architect", "controller", "authority", "trade", "specialist"]);
  roles.tenant = {
    label: "Mietervertretung",
    type: "Externe Rolle",
    id: "Ankuendigung, Zugang und Rueckmeldungen",
    summary: "Sieht Ankuendigungen, Terminfenster und Rueckmeldekanal, aber keine Kosten- oder Vertragsdetails.",
    permissions: ["Terminfenster", "Ankuendigungen", "Rueckmeldungen", "Keine Kosten"],
  };
  const schedule = {
    projectId,
    projectStart: plan.projectStart,
    tasks: [
      { id: "portfolio-schnitt", label: "Gebaeudecluster und Bauabschnitte schneiden", owner: "Projektsteuerer", phase: "LP1", durationDays: 10 },
      { id: "energieaudit", label: "Energieaudit und Foerderfaehigkeit pruefen", owner: "Fachplanung", phase: "LP2", durationDays: 18 },
      { id: "mieterkommunikation", label: "Mieterkommunikation und Zugangsfelder planen", owner: "Bauherr", phase: "LP2", durationDays: 16 },
      { id: "entwurf", label: "Serienentwurf und Kostenpakete freigeben", owner: "Architekt", phase: "LP3", durationDays: 22 },
      { id: "foerderantrag", label: "Foerderantrag je Cluster einreichen", owner: "Projektsteuerer", phase: "LP3", durationDays: 20 },
      { id: "genehmigung", label: "Fassaden- und Geruestgenehmigung", owner: "Behoerde", phase: "LP4", durationDays: 26 },
      { id: "detailplanung", label: "Details fuer serielles Gewerkepaket einfrieren", owner: "Architekt", phase: "LP5", durationDays: 24 },
      { id: "rahmenvergabe", label: "Rahmenvergabe Fassaden und Fenster", owner: "Projektsteuerer", phase: "LP6-LP7", durationDays: 28 },
      { id: "cluster-a", label: "Cluster A ausfuehren", owner: "Gewerk", phase: "LP8", durationDays: 30 },
      { id: "cluster-b", label: "Cluster B ausfuehren", owner: "Gewerk", phase: "LP8", durationDays: 30 },
      { id: "monitoring", label: "Energie-Monitoring und Maengelwelle", owner: "Fachplanung", phase: "LP8-LP9", durationDays: 14 },
    ],
    dependencies: [
      { from: "portfolio-schnitt", to: "energieaudit", type: "FS", lagDays: 0 },
      { from: "portfolio-schnitt", to: "mieterkommunikation", type: "SS", lagDays: 2 },
      { from: "energieaudit", to: "entwurf", type: "FS", lagDays: 0 },
      { from: "mieterkommunikation", to: "entwurf", type: "FF", lagDays: 0 },
      { from: "entwurf", to: "foerderantrag", type: "SS", lagDays: 5 },
      { from: "entwurf", to: "genehmigung", type: "FS", lagDays: 1 },
      { from: "foerderantrag", to: "detailplanung", type: "FF", lagDays: 4 },
      { from: "genehmigung", to: "detailplanung", type: "FS", lagDays: -3 },
      { from: "detailplanung", to: "rahmenvergabe", type: "SS", lagDays: 7 },
      { from: "rahmenvergabe", to: "cluster-a", type: "FS", lagDays: 2 },
      { from: "cluster-a", to: "cluster-b", type: "FS", lagDays: -8 },
      { from: "cluster-b", to: "monitoring", type: "FS", lagDays: 0 },
    ],
  };

  return composeDataset(plan, {
    project: localizedProject({
      id: projectId,
      title: "Demo: Wohnungsbestand Sanierungswelle",
      subtitle: "Serielle energetische Sanierung mit Mietenden, Foerderfristen und Cluster-Takten",
      phase: "3 Serienentwurf",
      risk: plan.risk,
      nodes: ["Eigentuemer", "Architekt", "Mieter", "Gewerk"],
    }),
    cockpit: {
      metrics: [
        ["132", "Beteiligte", "Eigentuemer, Mietendenvertretung, Planung, Foerderstellen und Gewerke."],
        ["8", "Trie-Wurzeln", "Cluster, Ankuendigungen, Foerderung, Genehmigung, Vergabe, Baustelle und Journal."],
        ["11", "Terminaufgaben", "Serielle Aufgaben mit ueberlappenden Cluster-Takten."],
        ["9", "Journalspuren", "Ankuendigungen, Zugang, Foerderung, Vergabe und Maengelwelle."],
      ],
      lanes: [
        { title: "Cluster", text: "Gebaeude werden in wiederholbare Bauabschnitte mit eigenen Sichtbarkeiten geschnitten.", progress: 69 },
        { title: "Mietende", text: "Ankuendigung und Zugang sind eigene Projektobjekte, nicht nur Mailtexte.", progress: 54 },
        { title: "Foerderung", text: "Foerderantraege haengen an Energieaudit und Serienentwurf.", progress: 47 },
      ],
    },
    roleModel: {
      roles,
      runnerRoleKeys: ["architect", "owner", "tenant", "trade"],
      runnerRoleWindowLayout: defaultRunnerLayout(),
      runnerProtocolSteps: protocolFor(projectId, "Cluster-A Ankuendigung", "Zugangstermine und Foerderfrist", "tenant"),
      sharedTrieRoots: [
        root(`/${projectId}/cluster-a`, "ProjectClusterTrieRoot", "architect", { owner: "full", architect: "full", controller: "filtered", authority: "none", trade: "filtered", specialist: "filtered", tenant: "filtered" }),
        root(`/${projectId}/tenant-notices`, "TenantNoticeTrieRoot", "owner", { owner: "full", architect: "full", controller: "filtered", authority: "none", trade: "filtered", specialist: "none", tenant: "filtered" }),
        root(`/${projectId}/funding`, "FundingTrieRoot", "controller", { owner: "full", architect: "full", controller: "full", authority: "none", trade: "none", specialist: "filtered", tenant: "none" }),
        root(`/${projectId}/energy-audit`, "EnergyEvidenceTrieRoot", "specialist", { owner: "filtered", architect: "full", controller: "filtered", authority: "filtered", trade: "none", specialist: "full", tenant: "none" }),
        root(`/${projectId}/site/windows`, "ConstructionWindowTrieRoot", "trade", { owner: "filtered", architect: "full", controller: "filtered", authority: "none", trade: "filtered", specialist: "filtered", tenant: "filtered" }),
      ],
    },
    schedule,
    assistant: createAssistant({
      projectId,
      label: "Wohnungsbestand Sanierungswelle",
      ref: "Cluster/Foerder Check",
      focus: "Cluster-Takte, Mietendenkommunikation und Foerderfristen zusammenhalten.",
      context: ["Clusterplan", "Energieaudit", "Mieterankuendigung", "Foerderantrag", "Baustellenfenster"],
      mutable: ["Zugangshinweise", "Foerderrisiken", "Journalentwuerfe"],
      findings: ["Foerderantrag hat wenig Puffer", "Cluster B ueberlappt Cluster A", "Mieterankuendigung beeinflusst Entwurfsfreigabe"],
    }),
    settings: createSettings(projectId, "INBOX/Demo Sanierungswelle"),
    mailPreview: [
      ["Heute", "Mietervertretung", "Zugang Cluster A braucht zwei Ersatztermine", "mieter"],
      ["Gestern", "Foerderstelle", "Antragsfrist fuer Paket 02 bestaetigt", "foerderung"],
      ["Mo", "Gewerk Fenster", "Serientakt nur mit fixiertem Detail moeglich", "lp5"],
    ],
    importModel: createImportModel({
      source: "Demo Dataset Creator",
      sheets: [
        ["Gebaeude", "Cluster", 18, "Abschnitte, Adressen und Zugangspunkte"],
        ["Mietende", "Kontakte", 132, "Ankuendigungen und Rueckmeldekanaele"],
        ["Foerderung", "Termine", 9, "Fristen und Nachweisketten"],
        ["Gewerke", "Vergabe", 14, "Rahmenlose und Ausfuehrungsfenster"],
      ],
      previewRows: [
        ["Cluster A", "Projektcluster", `/${projectId}/cluster-a`, "voll"],
        ["Mietervertretung", "Mieter", `/${projectId}/tenant-notices`, "gefiltert"],
        ["Energieberatung", "Fachplanung", `/${projectId}/energy-audit`, "voll"],
        ["Fensterbau Los 02", "Gewerk", `/${projectId}/site/windows`, "begrenzt"],
      ],
    }),
    exportModel: createExportModel("Demo: Wohnungsbestand Sanierungswelle", baseExportSections(["Cluster", "Mietende"])),
    journal: [
      ["2026-06-02 09:12", "Datensatz erzeugt", "Demo Dataset Creator hat Sanierungswelle vorbereitet.", "Dataset 001"],
      ["2026-06-02 09:21", "Cluster geschnitten", "Gebaeudecluster und Sichtbarkeiten angelegt.", "Journal 002"],
      ["2026-06-02 09:36", "Mietende verknuepft", "Ankuendigungen haengen am Termin- und Zugangsast.", "Journal 003"],
      ["2026-06-02 09:45", "Foerderung geprueft", "Foerderantrag als Terminrisiko im CPM sichtbar.", "Journal 004"],
    ],
  });
}

function baseExportSections(extraSections = []) {
  return [
    ["Projekt", "Titel, aktive Leistungsphase, Exportzeit"],
    ["Beteiligte", "Kontakte, Rollen und Stellvertretungen"],
    ["Zugriff", "Projektbereiche und sichtbare Berechtigungen"],
    ["Terminplan", "Aufgaben, Abhaengigkeiten und kritischer Pfad"],
    ["Dokumente", "Planstaende, Nachweise und aktueller Status"],
    ...extraSections.map((section) => [section, "Projektbereich mit eigener Sichtbarkeit und Journalspur"]),
    ["Mail", "Projektmail-Bezuege ohne Mailpasswort"],
    ["Assistenz", "Pruefauftrag, Quellen und Ergebnisstand"],
    ["Journal", "Nachvollziehbare Ereignisse"],
  ];
}

function defaultRunnerLayout() {
  return {
    architect: { left: 40, top: 60, width: 470, height: 640 },
    owner: { left: 540, top: 60, width: 470, height: 640 },
    authority: { left: 1040, top: 60, width: 470, height: 640 },
    trade: { left: 1540, top: 60, width: 470, height: 640 },
    operator: { left: 1040, top: 60, width: 470, height: 640 },
    tenant: { left: 1040, top: 60, width: 470, height: 640 },
    programLead: { left: 40, top: 60, width: 470, height: 640 },
    caregiver: { left: 540, top: 60, width: 470, height: 640 },
    education: { left: 1040, top: 60, width: 470, height: 640 },
    fundraising: { left: 1540, top: 60, width: 470, height: 640 },
    safeguarding: { left: 1040, top: 60, width: 470, height: 640 },
  };
}

function ngoProtocolFor(projectId) {
  return [
    {
      from: "programLead",
      to: "caregiver",
      text: `Bitte prüfe die Visumsfrist Sita Rai im Projekt ${projectId}.`,
      journal: "Programmleitung fordert Betreuerin-Prüfung zur Visumsfrist an.",
    },
    {
      from: "caregiver",
      to: "safeguarding",
      text: "Sita ist minderjährig; bitte Vormundschaft und Safeguarding-Notiz gegenzeichnen.",
      journal: "Betreuerin eskaliert Minderjährigenregel an Safeguarding.",
    },
    {
      from: "safeguarding",
      to: "programLead",
      text: "Keine Selbstverpflichtung durch Minderjährige; Vormundschaft und Meldeweg bleiben Pflichtspur.",
      journal: "Safeguarding bestätigt Pflichtspur ohne Selbstverpflichtung.",
    },
    {
      from: "fundraising",
      to: "programLead",
      text: "Murat Demir braucht Dank und Quittungsprüfung; Programmbezug Bildung / Ausbildung ist sichtbar.",
      journal: "Fundraising meldet offene Dank- und Quittungsaufgabe.",
    },
    {
      from: "education",
      to: "caregiver",
      text: "Maya Rai ist in Bewerbungsphase; nächster Schritt Praktikum oder Arbeit vorbereiten.",
      journal: "Bildungsbegleitung ergänzt nächsten Schritt für Maya Rai.",
    },
  ];
}

function protocolFor(projectId, decision, openPoint, thirdRole = "authority") {
  return [
    {
      from: "architect",
      to: "owner",
      text: `Bitte pruefe ${decision} fuer ${projectId}.`,
      journal: `Architekt fordert Bauherr-Freigabe fuer ${decision} an.`,
    },
    {
      from: "owner",
      to: "architect",
      text: `Freigabe vorbereitet, solange ${openPoint} sichtbar verfolgt wird.`,
      journal: `Bauherr gibt ${decision} mit Auflage frei.`,
    },
    {
      from: "architect",
      to: thirdRole,
      text: `${openPoint}: Rueckfrage bitte an den passenden Projektast haengen.`,
      journal: `Architekt teilt gefilterten Trie-Ast mit ${thirdRole}.`,
    },
    {
      from: thirdRole,
      to: "architect",
      text: `${openPoint} liegt als Rueckfrage vor und braucht sichtbaren Abschluss.`,
      journal: `${thirdRole} meldet offene Rueckfrage.`,
    },
    {
      from: "architect",
      to: "trade",
      text: "Ausfuehrungsast bleibt begrenzt, bis die offene Rueckfrage geschlossen ist.",
      journal: "Gewerk erhaelt begrenzten Vorabhinweis ohne Planfreigabe.",
    },
  ];
}

export function listDemoDatasetPlans() {
  return clone(DATASET_PLANS);
}

export function createDemoDatasetCreatorSupply() {
  return createSkillSupply();
}

export function createDemoDatasetProject(planId = DATASET_PLANS[0].id) {
  const plan = datasetPlanById(planId);
  return PLAN_BUILDERS[plan.id](plan);
}
