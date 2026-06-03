function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`[hoai.core] ${name} must be an array.`);
  }
}

function normalizeId(value, field) {
  const id = String(value || "").trim();
  if (!id) throw new Error(`[hoai.core] ${field} is required`);
  return id;
}

export const HOAI_CORE_VERSION = "0.1.0";

export const HOAI_PHASES = [
  {
    id: "lp1",
    short: "LP1",
    title: "Grundlagenermittlung",
    decision: "Bedarf, Flächen, Beteiligte und erste Projektstruktur klären.",
    risk: "Unklare Anforderungen werden später teuer.",
  },
  {
    id: "lp2",
    short: "LP2",
    title: "Vorplanung",
    decision: "Varianten, Kostenrahmen und Förderlogik zusammenbringen.",
    risk: "Förderbedingungen und Nutzerbedarf laufen auseinander.",
  },
  {
    id: "lp3",
    short: "LP3",
    title: "Entwurfsplanung",
    decision: "Entwurf, Kostenberechnung und Terminpfad beschlussfähig machen.",
    risk: "Bauherr, Fachplaner und Nachhaltigkeitsanforderungen sind nicht synchron.",
  },
  {
    id: "lp4",
    short: "LP4",
    title: "Genehmigungsplanung",
    decision: "Unterlagen, Behördenrückfragen und Nachweise vollständig halten.",
    risk: "Rückfragen verschwinden in Mailverläufen.",
  },
  {
    id: "lp5",
    short: "LP5",
    title: "Ausführungsplanung",
    decision: "Planstände, Freigaben und Änderungen kontrolliert verteilen.",
    risk: "Gewerke arbeiten mit abweichenden Planständen.",
  },
  {
    id: "lp8",
    short: "LP8",
    title: "Bauüberwachung",
    decision: "Mängel, Termine, Protokolle und Nachträge im Takt führen.",
    risk: "Baustellenereignisse sind nicht beweisfest verknüpft.",
  },
];

export const HOAI_CROSS_CUTTING_TOPICS = [
  ["Kosten", "DIN 276 Fortschreibung, Freigaben, Budgetabweichungen"],
  ["Termine", "Meilensteine, Gremien, Behördenlaufzeiten, Bauzeitenplan"],
  ["Fördermittel", "Nachweise, Fristen, Zweckbindung und Dokumentationspflicht"],
  ["Kommunikation", "Projektmail, Gruppenchat, Aufgaben, Eskalationen"],
  ["Nachhaltigkeit", "GEG, BNB-Optionen, Energie- und Materialnachweise"],
];

export const HOAI_PLANNING_LABELS = {
  eyebrow: "HOAI Leistungsphasen",
  title: "Phasen, Querschnittsthemen und offene Entscheidungen",
  phaseLabel: "Projektphase",
  riskLabel: "Aktuelles Risiko",
  statusPhasePrefix: "LP",
  topicTitle: "Kontinuierliche Projektkontrolle",
  flowsEyebrow: "Projektflows",
  flowsTitle: "Verbindliche Abläufe für Dokumente, Termine und Änderungen",
  flowCheckText: "muss vor Statuswechsel sichtbar sein",
};

export const HOAI_FLOW_TEMPLATES = [
  {
    id: "invoices",
    label: "Rechnungen",
    object: "ProjectInvoiceFlow",
    trigger: "Rechnung geht per Projektmail, Upload oder ERP-Import ein.",
    owners: ["Architekt", "Projektsteuerer", "Bauherr", "Buchhaltung"],
    steps: [
      "Eingang erkennen und Auftrag, Vertrag, Gewerk und Kostenstelle zuordnen.",
      "Leistungsstand, Aufmaß, Freigaben und Zahlungsplan gegen den Vertrag prüfen.",
      "Abweichungen als Rückfrage, Mangel, Nachtrag oder Sperre markieren.",
      "Freigabe mit Budgetwirkung, Skonto, Frist und Zahlungsempfänger dokumentieren.",
      "Zahlungsstatus und Gewährleistungsbezug ins Journal schreiben.",
    ],
    checks: ["Vertragsbezug", "Zahlungsplan", "Leistungsstand", "Freigabe", "Journalspur"],
    output: "Freigegebene, gekürzte oder zurückgewiesene Rechnung mit nachvollziehbarer Prüfkette.",
  },
  {
    id: "contracts",
    label: "Verträge",
    object: "ProjectContractFlow",
    trigger: "Angebot, Beauftragung, Vertragsentwurf oder Rahmenvereinbarung wird abgelegt.",
    owners: ["Bauherr", "Architekt", "Projektsteuerer", "Juristische Prüfung"],
    steps: [
      "Vertragspartner, Leistungsbild, Vergütung, Termine und Anlagen erfassen.",
      "Leistungssoll, Qualitätsanforderungen, Haftung, Versicherung und Kündigungsregeln prüfen.",
      "Freigaben und Signaturstatus je Rolle festhalten.",
      "Pflichten, Fristen, Zahlungsplan und Gewährleistung als verknüpfte Objekte anlegen.",
      "Änderungen nur als versionierte Vertragsänderung oder Nachtrag fortschreiben.",
    ],
    checks: ["Leistungssoll", "Anlagen", "Zeichnung", "Fristen", "Rechte"],
    output: "Vertragsakte mit aktiven Pflichten, Terminen, Zahlungsregeln und Änderungsverlauf.",
  },
  {
    id: "calendar",
    label: "Kalender",
    object: "ProjectCalendarFlow",
    trigger: "Gremientermin, Behördenfrist, Planlauf, Baubesprechung oder Abnahme wird geplant.",
    owners: ["Architekt", "Projektsteuerer", "Bauherr", "Beteiligte Rollen"],
    steps: [
      "Terminart, Verantwortliche, Fristgrund und betroffene Leistungsphase definieren.",
      "Abhängigkeiten zu Planstand, Entscheidung, Genehmigung oder Gewerk sichtbar machen.",
      "Einladungen mit Rollenrechten und benötigten Unterlagen verteilen.",
      "Erinnerungen, Konflikte und Verschiebungen als Ereignisse protokollieren.",
      "Ergebnis, Protokoll, Entscheidung und Folgeaufgaben an den Termin hängen.",
    ],
    checks: ["Fristgrund", "Abhängigkeiten", "Teilnehmer", "Unterlagen", "Folgeaufgaben"],
    output: "Projektkalender, der Entscheidungen, Dokumente und Fristen beweisbar verbindet.",
  },
  {
    id: "changes",
    label: "Planung, Nachträge, Leistungsänderungen",
    object: "ProjectChangeFlow",
    trigger: "Planänderung, Bedenkenanzeige, Nachtragsforderung oder Leistungsänderung entsteht.",
    owners: ["Architekt", "Projektsteuerer", "Bauherr", "Gewerk", "Fachplanung"],
    steps: [
      "Anlass, Quelle, betroffene Pläne, Vertrag und Leistungsphase erfassen.",
      "Kosten-, Termin-, Qualitäts- und Genehmigungswirkung bewerten.",
      "Entscheidungsvorlage mit Alternativen, Risiken und benötigten Freigaben erstellen.",
      "Freigegebenen Planstand und geändertes Leistungssoll rollenbasiert verteilen.",
      "Umsetzung, Nachweis, Nachtrag und Rechnungsbezug schließen.",
    ],
    checks: ["Ursache", "Kostenfolge", "Terminfolge", "Planstand", "Freigabe"],
    output: "Geprüfte Änderung mit klarem Status: offen, freigegeben, abgelehnt oder umgesetzt.",
  },
  {
    id: "standards",
    label: "Qualitätsstandards, Health & Safety, DIN",
    object: "ProjectComplianceFlow",
    trigger: "Neue Vorschrift, DIN-Änderung, H&S-Regel oder projektspezifischer Qualitätsstandard wird relevant.",
    owners: ["Architekt", "Fachplanung", "SiGeKo", "Bauherr", "Gewerk"],
    steps: [
      "Quelle, Gültigkeit, betroffene Bauteile, Gewerke und Leistungsphasen einordnen.",
      "Relevanz für Vertrag, Leistungssoll, Planstand, Baustelle und Dokumentation prüfen.",
      "Anforderungen als Qualitätskriterium, Aufgabe, Unterweisung oder Sperrpunkt anlegen.",
      "Nachweise, Prüfungen und Fotodokumentation rollenbasiert einfordern.",
      "Abweichungen als Mangel, Risiko oder Änderungsbedarf ins Journal übernehmen.",
    ],
    checks: ["Quelle", "Gültigkeit", "Betroffenheit", "Nachweis", "Abweichung"],
    output: "Aktive Regelmatrix mit Anforderungen, Verantwortlichen und Nachweisstand.",
  },
  {
    id: "scope",
    label: "Leistungssoll",
    object: "ProjectScopeFlow",
    trigger: "Qualitätsanforderung, Termin oder geschuldete Leistung wird definiert oder geändert.",
    owners: ["Bauherr", "Architekt", "Projektsteuerer", "Fachplanung", "Gewerk"],
    steps: [
      "Leistung mit Quelle, Vertrag, Planstand, Bauteil, Gewerk und Leistungsphase erfassen.",
      "Qualitätsanforderungen, Toleranzen, Prüfkriterien und Akzeptanznachweise ergänzen.",
      "Termine, Vorleistungen, Abhängigkeiten und Verantwortliche verknüpfen.",
      "Sollstand versionieren und bei Änderungen betroffene Rollen informieren.",
      "Abnahme, Mangel, Nachtrag oder Rechnung gegen diesen Sollstand prüfen.",
    ],
    checks: ["Quelle", "Qualität", "Termin", "Verantwortung", "Abnahme"],
    output: "Versioniertes Leistungssoll mit Qualitätskriterien, Terminen und Prüfbezug.",
  },
  {
    id: "warranty",
    label: "Zahlungsplan und Gewährleistung",
    object: "ProjectWarrantyFlow",
    trigger: "Zahlungsmeilenstein, Abnahme, Schlussrechnung oder Gewährleistungsfall tritt ein.",
    owners: ["Bauherr", "Projektsteuerer", "Architekt", "Gewerk", "Buchhaltung"],
    steps: [
      "Zahlungsplan mit Vertrag, Meilensteinen, Sicherheiten und Einbehalten verknüpfen.",
      "Fälligkeit gegen Leistungsstand, Abnahme, Mängel und Freigaben prüfen.",
      "Gewährleistungsbeginn, Fristen, Sicherheiten und Verantwortliche starten.",
      "Mängelmeldungen, Fristsetzungen und Nachbesserungen dem Anspruch zuordnen.",
      "Erledigung, Verjährung, Auszahlung oder Anspruchsdurchsetzung journalisieren.",
    ],
    checks: ["Fälligkeit", "Abnahme", "Einbehalt", "Frist", "Anspruch"],
    output: "Zahlungs- und Gewährleistungsakte mit Fristen, Sicherheiten und Anspruchsstatus.",
  },
];

export function createHoaiPlanningDefaults() {
  return {
    labels: clone(HOAI_PLANNING_LABELS),
    phases: clone(HOAI_PHASES),
    topics: clone(HOAI_CROSS_CUTTING_TOPICS),
    flowDomains: clone(HOAI_FLOW_TEMPLATES),
  };
}

export function normalizeHoaiPlanning(input = {}) {
  const defaults = createHoaiPlanningDefaults();
  const planning = {
    labels: input.labels || defaults.labels,
    phases: input.phases || defaults.phases,
    topics: input.topics || defaults.topics,
    flowDomains: input.flowDomains || defaults.flowDomains,
  };
  assertArray(planning.phases, "phases");
  assertArray(planning.topics, "topics");
  assertArray(planning.flowDomains, "flowDomains");

  const phases = planning.phases.map((phase) => ({
    ...phase,
    id: normalizeId(phase.id, "phase.id"),
    short: phase.short || phase.id.toUpperCase(),
  }));
  const phaseIds = new Set(phases.map((phase) => phase.id));
  if (phaseIds.size !== phases.length) {
    throw new Error("[hoai.core] phase ids must be unique");
  }

  return {
    labels: { ...defaults.labels, ...(planning.labels || {}) },
    phases,
    topics: planning.topics.map(([title, text]) => [normalizeId(title, "topic.title"), String(text || "")]),
    flowDomains: planning.flowDomains.map((flow) => ({
      ...flow,
      id: normalizeId(flow.id, "flow.id"),
      owners: clone(flow.owners || []),
      steps: clone(flow.steps || []),
      checks: clone(flow.checks || []),
    })),
  };
}

export function phaseById(phases, phaseId) {
  return phases.find((phase) => phase.id === phaseId);
}
