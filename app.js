import { createProjectPlan, createProjectScheduleStateDagUpdate } from "./packages/project.core/index.js";
import { createDemoProjectSchedule } from "./demo-kita-2028.project.js";
import { createProjectEditorWorkbench } from "./content-editors.project.js";
import {
  DEMO_DATASET_CREATOR_SKILL,
  PROJECT_DATATYPE_KIND,
  PROJECT_DATATYPE_VERSION,
  createDemoDatasetProject,
  createNgoAssistant,
  createNgoPlanningOverrides,
  listDemoDatasetPlans,
} from "./demo-dataset.creator.js";
import { createHoaiPlanningDefaults, normalizeHoaiPlanning, phaseById } from "./hoai.core.js";
import {
  PROJECT_DAG_TABLE_VIEWS,
  createProjectDagExcelProjection,
  csvFromProjectDagExcelSheet,
  getProjectDagExcelSheet,
} from "./packages/table.core/index.js";
import {
  DONATION_TYPES,
  addNgoDonor,
  addNgoDonation,
  addNgoParticipant,
  createNgoBackup,
  createNgoProjectData,
  csvFromNgoDonations,
  csvFromNgoParticipants,
  csvFromNgoPeople,
  donorMetrics,
  normalizeNgoProjectData,
  participantMetrics,
  queryNgoDonors,
  queryNgoParticipants,
  restoreNgoBackup,
} from "./packages/ngo.core/index.js";
import {
  createProjectSourceBundle,
  normalizeProjectSourceBundle,
  summarizeProjectFileIndex,
} from "./packages/project-source.core/index.js";

const state = {
  activePanel: "cockpit",
  activeCockpitSummary: null,
  activeRole: "architect",
  activePhase: "lp3",
  activeFlow: "invoices",
  theme: localStorage.getItem("projektor-theme") || localStorage.getItem("steering-theme") || "light",
  language: localStorage.getItem("projektor-language") || localStorage.getItem("steering-language") || "de",
  onboardingStep: localStorage.getItem("projektor-onboarding-complete") === "true" ? "done" : "identity",
  onboarding: {
    name: localStorage.getItem("projektor-profile-name") || "",
    email: localStorage.getItem("projektor-profile-email") || "",
    password: "",
    passwordConfirm: "",
    statsConsent: localStorage.getItem("projektor-usage-stats") === "true",
    error: "",
  },
  runStep: 1,
  syncCount: 18,
  journalExtra: 0,
  imapStatus: "idle",
  importStatus: "idle",
  importFileName: "",
  datasetCreatorStatus: "bereit",
  runnerStatus: "idle",
  runnerSessionId: localStorage.getItem("projektor-runner-session") || "",
  runnerWindows: {},
  runnerLog: [],
  runnerMessages: [],
  runnerProtocolStep: 0,
  settingsView: "configuration",
  activeProjectVisual: "gantt",
  activeTableView: "schedule",
  activeNgoView: "donors",
  donorSearch: "",
  donorSort: "open",
  donorOnlyOpen: false,
  ngoMetricFilter: null,
  activeNgoDonorId: "",
  activeNgoParticipantId: "",
  participantSearch: "",
  participantSort: "visa",
};

const runtimeWindowId = `projektor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const runnerWindowRefs = new Map();
let activeRunnerAbort = false;
const runnerRoleParam = new URLSearchParams(window.location.search).get("runnerRole");
const isRunnerRoleWindow = ["architect", "owner", "authority", "trade", "operator", "tenant", "programLead", "caregiver", "education", "fundraising", "safeguarding"].includes(runnerRoleParam);

const navItems = [
  ["cockpit", "CP", "navCockpit"],
  ["roles", "RO", "navRoles"],
  ["phases", "LP", "navPhases"],
  ["flows", "FL", "navFlows"],
  ["data", "DA", "navData"],
  ["ngo", "NG", "navNgo"],
  ["ai", "AS", "navAi"],
  ["journal", "JO", "navJournal"],
  ["settings", "SE", "navSettings"],
];

const settingsViews = ["configuration", "feedback"];

const projectVisualTypes = [
  ["gantt", "Gantt", "Terminbalken"],
  ["kanban", "Kanban", "Arbeitsfluss"],
  ["pert", "PERT", "Abhängigkeiten"],
  ["burn", "Burn", "Fortschritt"],
  ["wbs", "WBS", "Lieferstruktur"],
  ["flowchart", "Flowchart", "Ablauf"],
];

const languages = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  es: "Español",
};

const onboardingSteps = ["identity", "web", "password", "stats", "review"];

const onboardingCopy = {
  de: {
    appStoreStep: "Web",
    back: "Zurück",
    continue: "Weiter",
    email: "E-Mail",
    emailHelp: "Wir verwenden deine E-Mail als lokale ID, nicht als Login bei unseren Servern.",
    emailPlaceholder: "du@architekturburo.example",
    finish: "projektor.one starten",
    identityStep: "Identität",
    intro: "Ein lokaler Start für Architektur-Projekte, Rollen, Projektmail und Entscheidungen.",
    localPromise:
      "Alle Projekt- und Nutzerdaten bleiben auf deinem Rechner, in deinem Browser. projektor.one lädt Projektinhalte nicht automatisch auf unsere Server.",
    localPromiseTitle: "Deine Daten bleiben lokal",
    name: "Anrede / Name",
    namePlaceholder: "z. B. Alex, Frau Meyer oder Team LP3",
    nextStore:
      "Der Browser wird hier wie ein App Store genutzt: du öffnest oder installierst projektor.one direkt aus dem Web, ohne zentrale Store-Freigabe.",
    nextStoreTitle: "Das Web ist der App Store",
    optional: "optional",
    password: "Passwort",
    passwordConfirm: "Passwort wiederholen",
    passwordHelp:
      "Dieses Passwort ist nur für den Schutz deiner lokalen Daten gedacht. Es ist kein Konto-Passwort und wird in diesem Prototyp nicht gespeichert.",
    passwordPlaceholder: "lokales Schutzpasswort",
    passwordStep: "Schutz",
    passwordTitle: "Lokales Passwort nur, wenn du es möchtest",
    profileTitle: "Wie soll das System dich ansprechen?",
    resetOnboarding: "Onboarding zurücksetzen",
    reviewEmail: "Identitäts-E-Mail",
    reviewName: "Anrede",
    reviewPasswordOff: "ohne lokales Passwort",
    reviewPasswordOn: "lokaler Schutz aktiviert",
    reviewStatsOff: "nicht freigegeben",
    reviewStatsOn: "freigegeben",
    reviewStep: "Start",
    reviewTitle: "Alles bereit für dein lokales Projekt-Cockpit",
    secureEmail: "Bitte gib deine E-Mail ein, damit du dich sicher identifizieren kannst.",
    skipPassword: "Ohne Passwort weiter",
    statsConsent:
      "Ich stimme zu, dass projektor.one Nutzungsstatistiken für Beschaffung und Einführung auswerten darf.",
    statsHelp:
      "Erfasst werden nur Nutzungsereignisse wie geöffnete Bereiche, Sitzungen und technische Kategorie. Projektinhalte, Dokumente, Mailtexte und Dateinamen gehören nicht dazu.",
    statsStep: "Statistik",
    statsTitle: "Nutzungsstatistiken nur mit deiner Zustimmung",
    validationEmail: "Bitte gib eine plausible E-Mail-Adresse ein.",
    validationName: "Bitte gib ein, wie projektor.one dich ansprechen soll.",
    validationPassword: "Die Passwörter müssen übereinstimmen.",
  },
  en: {
    appStoreStep: "Web",
    back: "Back",
    continue: "Continue",
    email: "Email",
    emailHelp: "We use your email as a local identity ID, not as a login to our servers.",
    emailPlaceholder: "you@architecture-office.example",
    finish: "Start projektor.one",
    identityStep: "Identity",
    intro: "A local start for architecture projects, roles, project mail and decisions.",
    localPromise:
      "All project and user data stays on your machine, in your browser. projektor.one does not upload project content to our servers automatically.",
    localPromiseTitle: "Your data stays local",
    name: "How should we address you?",
    namePlaceholder: "e.g. Alex, Ms Meyer or Team LP3",
    nextStore:
      "The browser works like an app store here: you open or install projektor.one directly from the web, without a central store gatekeeper.",
    nextStoreTitle: "The web is the app store",
    optional: "optional",
    password: "Password",
    passwordConfirm: "Repeat password",
    passwordHelp:
      "This password is only for protecting your local data. It is not an account password and this prototype does not store it.",
    passwordPlaceholder: "local protection password",
    passwordStep: "Protection",
    passwordTitle: "Use a local password only if you want one",
    profileTitle: "How should the system address you?",
    resetOnboarding: "Reset onboarding",
    reviewEmail: "Identity email",
    reviewName: "Addressed as",
    reviewPasswordOff: "no local password",
    reviewPasswordOn: "local protection enabled",
    reviewStatsOff: "not allowed",
    reviewStatsOn: "allowed",
    reviewStep: "Start",
    reviewTitle: "Ready for your local project cockpit",
    secureEmail: "Please enter your email so you can identify yourself securely.",
    skipPassword: "Continue without password",
    statsConsent:
      "I agree that projektor.one may evaluate usage statistics for procurement and rollout reporting.",
    statsHelp:
      "Only usage events such as opened areas, sessions and technical category are covered. Project content, documents, mail bodies and file names are not included.",
    statsStep: "Statistics",
    statsTitle: "Usage statistics only with your consent",
    validationEmail: "Please enter a plausible email address.",
    validationName: "Please enter how projektor.one should address you.",
    validationPassword: "The passwords must match.",
  },
  fr: {
    appStoreStep: "Web",
    back: "Retour",
    continue: "Continuer",
    email: "E-mail",
    emailHelp: "Nous utilisons ton e-mail comme identifiant local, pas comme connexion à nos serveurs.",
    emailPlaceholder: "toi@cabinet-architecture.example",
    finish: "Démarrer projektor.one",
    identityStep: "Identité",
    intro: "Un démarrage local pour projets d'architecture, rôles, mail projet et décisions.",
    localPromise:
      "Toutes les données projet et utilisateur restent sur ta machine, dans ton navigateur. projektor.one n'envoie pas automatiquement les contenus projet vers nos serveurs.",
    localPromiseTitle: "Tes données restent locales",
    name: "Comment devons-nous t'appeler ?",
    namePlaceholder: "p. ex. Alex, Mme Meyer ou équipe LP3",
    nextStore:
      "Le navigateur agit ici comme une boutique d'apps : tu ouvres ou installes projektor.one directement depuis le web, sans gatekeeper central.",
    nextStoreTitle: "Le web est la boutique d'apps",
    optional: "optionnel",
    password: "Mot de passe",
    passwordConfirm: "Répéter le mot de passe",
    passwordHelp:
      "Ce mot de passe sert uniquement à protéger tes données locales. Ce n'est pas un mot de passe de compte et le prototype ne l'enregistre pas.",
    passwordPlaceholder: "mot de passe local",
    passwordStep: "Protection",
    passwordTitle: "Mot de passe local seulement si tu le souhaites",
    profileTitle: "Comment le système doit-il s'adresser à toi ?",
    resetOnboarding: "Réinitialiser l'onboarding",
    reviewEmail: "E-mail d'identité",
    reviewName: "Appellation",
    reviewPasswordOff: "sans mot de passe local",
    reviewPasswordOn: "protection locale activée",
    reviewStatsOff: "non autorisées",
    reviewStatsOn: "autorisées",
    reviewStep: "Départ",
    reviewTitle: "Prêt pour ton cockpit projet local",
    secureEmail: "Indique ton e-mail afin de pouvoir t'identifier de manière sûre.",
    skipPassword: "Continuer sans mot de passe",
    statsConsent:
      "J'accepte que projektor.one analyse des statistiques d'utilisation pour les achats et le déploiement.",
    statsHelp:
      "Seuls les événements d'utilisation comme les zones ouvertes, sessions et catégories techniques sont concernés. Les contenus projet, documents, corps de mails et noms de fichiers sont exclus.",
    statsStep: "Statistiques",
    statsTitle: "Statistiques d'utilisation uniquement avec ton accord",
    validationEmail: "Indique une adresse e-mail plausible.",
    validationName: "Indique comment projektor.one doit s'adresser à toi.",
    validationPassword: "Les mots de passe doivent correspondre.",
  },
  es: {
    appStoreStep: "Web",
    back: "Atrás",
    continue: "Continuar",
    email: "Correo",
    emailHelp: "Usamos tu correo como ID local de identidad, no como inicio de sesión en nuestros servidores.",
    emailPlaceholder: "tu@estudio-arquitectura.example",
    finish: "Iniciar projektor.one",
    identityStep: "Identidad",
    intro: "Un inicio local para proyectos de arquitectura, roles, correo de proyecto y decisiones.",
    localPromise:
      "Todos los datos de proyecto y usuario permanecen en tu máquina, en tu navegador. projektor.one no sube contenido de proyecto automáticamente a nuestros servidores.",
    localPromiseTitle: "Tus datos permanecen locales",
    name: "¿Cómo debemos dirigirnos a ti?",
    namePlaceholder: "p. ej. Alex, Sra. Meyer o equipo LP3",
    nextStore:
      "El navegador funciona aquí como una tienda de apps: abres o instalas projektor.one directamente desde la web, sin un intermediario central.",
    nextStoreTitle: "La web es la tienda de apps",
    optional: "opcional",
    password: "Contraseña",
    passwordConfirm: "Repetir contraseña",
    passwordHelp:
      "Esta contraseña solo protege tus datos locales. No es una contraseña de cuenta y este prototipo no la guarda.",
    passwordPlaceholder: "contraseña local",
    passwordStep: "Protección",
    passwordTitle: "Contraseña local solo si la quieres",
    profileTitle: "¿Cómo debe dirigirse el sistema a ti?",
    resetOnboarding: "Restablecer onboarding",
    reviewEmail: "Correo de identidad",
    reviewName: "Tratamiento",
    reviewPasswordOff: "sin contraseña local",
    reviewPasswordOn: "protección local activada",
    reviewStatsOff: "no permitido",
    reviewStatsOn: "permitido",
    reviewStep: "Inicio",
    reviewTitle: "Listo para tu panel local de proyecto",
    secureEmail: "Introduce tu correo para poder identificarte de forma segura.",
    skipPassword: "Continuar sin contraseña",
    statsConsent:
      "Acepto que projektor.one evalúe estadísticas de uso para compras e implantación.",
    statsHelp:
      "Solo se incluyen eventos de uso como áreas abiertas, sesiones y categoría técnica. No se incluyen contenidos del proyecto, documentos, textos de correo ni nombres de archivo.",
    statsStep: "Estadísticas",
    statsTitle: "Estadísticas de uso solo con tu consentimiento",
    validationEmail: "Introduce un correo plausible.",
    validationName: "Indica cómo debe dirigirse projektor.one a ti.",
    validationPassword: "Las contraseñas deben coincidir.",
  },
};

let demoProject = {
  id: "demo-kita-2028",
  objectType: "Projekt-ID",
  titles: {
    de: "Demo: Kita 2028 - Neubau einer kommunalen Kindertagesstätte",
    en: "Demo: Kita 2028 - New municipal daycare building",
    fr: "Démo : Kita 2028 - construction d'une crèche municipale",
    es: "Demo: Kita 2028 - nueva guardería municipal",
  },
  subtitles: {
    de: "Kommunales Bauprojekt mit Rollen, Terminen, Dokumenten und Projektmail",
    en: "Municipal building project with roles, dates, documents and project mail",
    fr: "Projet public avec rôles, dates, documents et mail projet",
    es: "Proyecto municipal con roles, fechas, documentos y correo de proyecto",
  },
  mapLabel: {
    de: "Aktives Demo-Projekt",
    en: "Active demo project",
    fr: "Projet démo actif",
    es: "Proyecto demo activo",
  },
  phase: {
    de: "3 Entwurf",
    en: "3 Design",
    fr: "3 Conception",
    es: "3 Diseño",
  },
  risk: {
    de: "Mittel",
    en: "Medium",
    fr: "Moyen",
    es: "Medio",
  },
  nodes: {
    de: ["Bauherr", "Architekt", "Behörde", "Gewerk"],
    en: ["Client", "Architect", "Authority", "Trade"],
    fr: ["Maître d'ouvrage", "Architecte", "Autorité", "Entreprise"],
    es: ["Cliente", "Arquitecto", "Autoridad", "Contrata"],
  },
};

const i18n = {
  de: {
    navCockpit: "Cockpit",
    navRoles: "Rollen",
    navPhases: "Phasen",
    navFlows: "Flows",
    navData: "Daten",
    navNgo: "NGO",
    navAi: "Assistenz",
    navJournal: "Journal",
    navSettings: "Einstellungen",
    brandSubtitle: "Architektur-Projekte",
    topEyebrow: "Projektmanagement für Architekturbüros",
    statusRiskLabel: "Risiko",
    statusSync: "Sync",
    dark: "Dark",
    light: "Light",
    simulateSync: "Sync simulieren",
    cockpitEyebrow: "Projektsteuerung",
    cockpitTitle: "Ein Büro, viele Projekte, klare Datenbereiche",
    rolesEyebrow: "Team und Zugriff",
    rolesTitle: "Rollen, Berechtigungen und Zugriff",
    phasesEyebrow: "HOAI Leistungsphasen",
    phasesTitle: "Phasen, Querschnittsthemen und offene Entscheidungen",
    flowsEyebrow: "Projektflows",
    flowsTitle: "Verbindliche Abläufe für Dokumente, Termine und Änderungen",
    dataEyebrow: "Projektdateien",
    dataTitle: "Datenimport, Vorschau und Projekt-Export",
    template: "Template",
    export: "Export",
    aiEyebrow: "Projektassistenz",
    aiTitle: "Prüfung von Lücken, Risiken und nächsten Schritten",
    advanceRun: "Nächsten Schritt prüfen",
    journalEyebrow: "Projektjournal",
    journalTitle: "Fälschungssichere Ereignisse als Bedienoberfläche",
    demoEvent: "Demo-Ereignis",
    settingsEyebrow: "Einstellungen",
    settingsTitle: "Einstellungen, Darstellung und IMAP-Projektmail",
    settingsConfigTitle: "Einstellungen, Darstellung und IMAP-Projektmail",
    settingsFeedbackTitle: "Feedback und Marktvalidierung",
    settingsConfig: "Konfiguration",
    settingsFeedback: "Feedback",
    feedbackMarketTitle: "Marktvalidierung",
    feedbackMarketText:
      "Der Fragebogen sammelt priorisierte Rückmeldungen zu Schmerz, Kosten, Integrationen, Pilotbereitschaft und Datenschutz.",
    feedbackOpen: "Separat öffnen",
    testImap: "IMAP prüfen",
    importPick: "Importdatei wählen",
    importHint: "XLSX/CSV aus Projektliste, Terminplan oder Kontaktliste",
    simulateImport: "Import simulieren",
    dataPreviewTitle: "Vorschau vor Schreibzugriff",
    dataPreviewText: "Projektor prüft die Datei zuerst und zeigt Änderungen an, bevor Daten übernommen werden.",
    sourceBundleTitle: "Git-Quelle",
    sourceBundleText: "Projektdateien, offene Änderungen und ignorierte Laufzeitpfade.",
    sourceAdapter: "Adapter",
    sourceBranch: "Branch",
    sourceHead: "Head",
    sourceFiles: "Dateien",
    sourceDirty: "Offen",
    sourceIgnored: "Ignoriert",
    exportBundleTitle: "Export-Bundle",
    exportBundleText: "Der Export sammelt Kontakte, Rollen, Termine, Dokumente, Mailbezug und Journal in einer nachvollziehbaren Projektdatei.",
    ngoEyebrow: "NGO Capability",
    ngoTitle: "Spender und Teilnehmerinnen-Programm",
    roleAllowed: "erlaubt",
    accessArea: "Bereich",
    accessContents: "Inhalte",
    accessFull: "voll",
    accessFiltered: "gefiltert",
    accessNone: "kein Zugriff",
    accessCycle: "Zugriff ändern",
    status: "Status",
    parser: "Dateityp",
    importSource: "Quelle",
    noImportFile: "Keine Importdatei gewählt",
    importReady: "bereit zur Vorschau",
    importPreview: "Vorschau erzeugt, 4 Konflikte prüfen",
    imported: "Demo-Import journalisiert",
  },
  en: {
    navCockpit: "Cockpit",
    navRoles: "Roles",
    navPhases: "Phases",
    navFlows: "Flows",
    navData: "Data",
    navNgo: "NGO",
    navAi: "Assistant",
    navJournal: "Journal",
    navSettings: "Settings",
    brandSubtitle: "Architecture projects",
    topEyebrow: "Project management for architecture offices",
    statusRiskLabel: "Risk",
    statusSync: "Sync",
    dark: "Dark",
    light: "Light",
    simulateSync: "Simulate sync",
    cockpitEyebrow: "Project steering",
    cockpitTitle: "One office, many projects, clear data areas",
    rolesEyebrow: "Team and access",
    rolesTitle: "Roles, permissions and access",
    phasesEyebrow: "HOAI phases",
    phasesTitle: "Phases, cross-cutting topics and open decisions",
    flowsEyebrow: "Project flows",
    flowsTitle: "Binding workflows for documents, dates and changes",
    dataEyebrow: "Project files",
    dataTitle: "Data import, preview and project export",
    template: "Template",
    export: "Export",
    aiEyebrow: "Project assistant",
    aiTitle: "Review gaps, risks and next steps",
    advanceRun: "Check next step",
    journalEyebrow: "Project journal",
    journalTitle: "Tamper-evident events as an operating surface",
    demoEvent: "Demo event",
    settingsEyebrow: "Settings",
    settingsTitle: "Settings, theme and IMAP project mail",
    settingsConfigTitle: "Settings, theme and IMAP project mail",
    settingsFeedbackTitle: "Feedback and market validation",
    settingsConfig: "Configuration",
    settingsFeedback: "Feedback",
    feedbackMarketTitle: "Market validation",
    feedbackMarketText:
      "The questionnaire collects prioritized feedback on pain, costs, integrations, pilot readiness and data protection.",
    feedbackOpen: "Open separately",
    testImap: "Check IMAP",
    importPick: "Choose import file",
    importHint: "XLSX/CSV from a project list, schedule or contact list",
    simulateImport: "Simulate import",
    dataPreviewTitle: "Preview before write access",
    dataPreviewText: "Projektor checks the file first and previews changes before anything is imported.",
    sourceBundleTitle: "Git source",
    sourceBundleText: "Project files, open changes and ignored runtime paths.",
    sourceAdapter: "Adapter",
    sourceBranch: "Branch",
    sourceHead: "Head",
    sourceFiles: "Files",
    sourceDirty: "Open",
    sourceIgnored: "Ignored",
    exportBundleTitle: "Export bundle",
    exportBundleText: "The export collects contacts, roles, dates, documents, mail references and journal entries in one traceable project file.",
    ngoEyebrow: "NGO capability",
    ngoTitle: "Donors and participant program",
    roleAllowed: "allowed",
    accessArea: "Area",
    accessContents: "Contents",
    accessFull: "full",
    accessFiltered: "filtered",
    accessNone: "no access",
    accessCycle: "Change access",
    status: "Status",
    parser: "File type",
    importSource: "Source",
    noImportFile: "No import file selected",
    importReady: "ready for preview",
    importPreview: "Preview created, review 4 conflicts",
    imported: "Demo import journaled",
  },
  fr: {
    navCockpit: "Cockpit",
    navRoles: "Rôles",
    navPhases: "Phases",
    navFlows: "Flux",
    navData: "Données",
    navNgo: "NGO",
    navAi: "Surface IA",
    navJournal: "Journal",
    navSettings: "Réglages",
    brandSubtitle: "Projets d'architecture",
    topEyebrow: "Gestion de projet pour cabinets d'architecture",
    statusRiskLabel: "Risque",
    statusSync: "Sync",
    dark: "Sombre",
    light: "Clair",
    simulateSync: "Simuler la sync",
    cockpitEyebrow: "Pilotage de projet",
    cockpitTitle: "Un cabinet, plusieurs projets, des espaces de données clairs",
    rolesEyebrow: "Équipe et accès",
    rolesTitle: "Rôles, droits et accès",
    phasesEyebrow: "Phases HOAI",
    phasesTitle: "Phases, thèmes transversaux et décisions ouvertes",
    flowsEyebrow: "Flux projet",
    flowsTitle: "Processus contraignants pour documents, dates et changements",
    dataEyebrow: "Fichiers projet",
    dataTitle: "Import, aperçu et export du projet",
    template: "Modèle",
    export: "Exporter",
    aiEyebrow: "Assistant projet",
    aiTitle: "Vérifier les manques, risques et prochaines étapes",
    advanceRun: "Vérifier l'étape suivante",
    journalEyebrow: "Journal projet",
    journalTitle: "Événements infalsifiables comme surface opérationnelle",
    demoEvent: "Événement démo",
    settingsEyebrow: "Réglages",
    settingsTitle: "Réglages, thème et mail projet IMAP",
    settingsConfigTitle: "Réglages, thème et mail projet IMAP",
    settingsFeedbackTitle: "Feedback et validation marché",
    settingsConfig: "Configuration",
    settingsFeedback: "Feedback",
    feedbackMarketTitle: "Validation marché",
    feedbackMarketText:
      "Le questionnaire recueille des retours priorisés sur la douleur, les coûts, les intégrations, la disposition au pilote et la protection des données.",
    feedbackOpen: "Ouvrir séparément",
    testImap: "Vérifier IMAP",
    importPick: "Choisir un fichier",
    importHint: "XLSX/CSV depuis une liste projet, un planning ou une liste de contacts",
    simulateImport: "Simuler l'import",
    dataPreviewTitle: "Aperçu avant écriture",
    dataPreviewText: "Projektor vérifie d'abord le fichier et affiche les changements avant toute importation.",
    sourceBundleTitle: "Source git",
    sourceBundleText: "Fichiers projet, changements ouverts et chemins d'exécution ignorés.",
    sourceAdapter: "Adaptateur",
    sourceBranch: "Branche",
    sourceHead: "Head",
    sourceFiles: "Fichiers",
    sourceDirty: "Ouverts",
    sourceIgnored: "Ignorés",
    exportBundleTitle: "Bundle d'export",
    exportBundleText: "L'export rassemble contacts, rôles, dates, documents, références mail et journal dans un fichier projet traçable.",
    ngoEyebrow: "Capability NGO",
    ngoTitle: "Donateurs et programme participantes",
    roleAllowed: "autorisé",
    accessArea: "Espace",
    accessContents: "Contenu",
    accessFull: "complet",
    accessFiltered: "filtré",
    accessNone: "aucun accès",
    accessCycle: "Modifier l'accès",
    status: "Statut",
    parser: "Type de fichier",
    importSource: "Source import",
    noImportFile: "Aucun fichier sélectionné",
    importReady: "prêt pour l'aperçu",
    importPreview: "Aperçu créé, 4 conflits à vérifier",
    imported: "Import démo journalisé",
  },
  es: {
    navCockpit: "Panel",
    navRoles: "Roles",
    navPhases: "Fases",
    navFlows: "Flujos",
    navData: "Datos",
    navNgo: "NGO",
    navAi: "Superficie IA",
    navJournal: "Diario",
    navSettings: "Ajustes",
    brandSubtitle: "Proyectos de arquitectura",
    topEyebrow: "Gestión de proyectos para estudios de arquitectura",
    statusRiskLabel: "Riesgo",
    statusSync: "Sync",
    dark: "Oscuro",
    light: "Claro",
    simulateSync: "Simular sync",
    cockpitEyebrow: "Dirección de proyecto",
    cockpitTitle: "Un estudio, varios proyectos, áreas de datos claras",
    rolesEyebrow: "Equipo y acceso",
    rolesTitle: "Roles, permisos y acceso",
    phasesEyebrow: "Fases HOAI",
    phasesTitle: "Fases, temas transversales y decisiones abiertas",
    flowsEyebrow: "Flujos del proyecto",
    flowsTitle: "Procesos vinculantes para documentos, fechas y cambios",
    dataEyebrow: "Archivos de proyecto",
    dataTitle: "Importación, vista previa y exportación del proyecto",
    template: "Plantilla",
    export: "Exportar",
    aiEyebrow: "Asistente de proyecto",
    aiTitle: "Revisar vacíos, riesgos y próximos pasos",
    advanceRun: "Revisar siguiente paso",
    journalEyebrow: "Diario del proyecto",
    journalTitle: "Eventos verificables como superficie operativa",
    demoEvent: "Evento demo",
    settingsEyebrow: "Ajustes",
    settingsTitle: "Ajustes, tema y correo IMAP del proyecto",
    settingsConfigTitle: "Ajustes, tema y correo IMAP del proyecto",
    settingsFeedbackTitle: "Feedback y validación de mercado",
    settingsConfig: "Configuración",
    settingsFeedback: "Feedback",
    feedbackMarketTitle: "Validación de mercado",
    feedbackMarketText:
      "El cuestionario recoge comentarios priorizados sobre dolor, costes, integraciones, disposición a piloto y protección de datos.",
    feedbackOpen: "Abrir por separado",
    testImap: "Comprobar IMAP",
    importPick: "Elegir archivo",
    importHint: "XLSX/CSV de lista de proyecto, cronograma o lista de contactos",
    simulateImport: "Simular importación",
    dataPreviewTitle: "Vista previa antes de escribir",
    dataPreviewText: "Projektor revisa primero el archivo y muestra los cambios antes de importar datos.",
    sourceBundleTitle: "Fuente git",
    sourceBundleText: "Archivos del proyecto, cambios abiertos y rutas de ejecución ignoradas.",
    sourceAdapter: "Adaptador",
    sourceBranch: "Rama",
    sourceHead: "Head",
    sourceFiles: "Archivos",
    sourceDirty: "Abiertos",
    sourceIgnored: "Ignorados",
    exportBundleTitle: "Paquete de exportación",
    exportBundleText: "La exportación reúne contactos, roles, fechas, documentos, referencias de correo y diario en un archivo trazable.",
    ngoEyebrow: "Capacidad NGO",
    ngoTitle: "Donantes y programa de participantes",
    roleAllowed: "permitido",
    accessArea: "Área",
    accessContents: "Contenido",
    accessFull: "completo",
    accessFiltered: "filtrado",
    accessNone: "sin acceso",
    accessCycle: "Cambiar acceso",
    status: "Estado",
    parser: "Tipo de archivo",
    importSource: "Fuente import",
    noImportFile: "Ningún archivo seleccionado",
    importReady: "listo para vista previa",
    importPreview: "Vista previa creada, revisar 4 conflictos",
    imported: "Importación demo registrada",
  },
};

function tr(key) {
  return i18n[state.language]?.[key] ?? i18n.de[key] ?? key;
}

function onb(key) {
  return onboardingCopy[state.language]?.[key] ?? onboardingCopy.de[key] ?? key;
}

function projectText(field) {
  return demoProject[field]?.[state.language] ?? demoProject[field]?.de ?? "";
}

function normalizeRouteHash(hash = window.location.hash) {
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

function applyRouteFromLocation() {
  const [panel, view, routeParam] = normalizeRouteHash();
  if (panel && navItems.some(([id]) => id === panel)) {
    state.activePanel = panel;
  }
  state.activeCockpitSummary = null;
  if (state.activePanel === "cockpit" && view === "summary" && routeParam) {
    state.activeCockpitSummary = routeParam;
  }
  if (state.activePanel === "settings" && settingsViews.includes(view)) {
    state.settingsView = view;
  }
}

function routeHash(panel = state.activePanel, settingsView = state.settingsView) {
  return `#/${panel}${panel === "settings" ? `/${settingsView}` : ""}`;
}

function cockpitSummaryHash(sectionId) {
  return `#/cockpit/summary/${sectionId}`;
}

function navigateTo(panel, settingsView = state.settingsView) {
  state.activePanel = panel;
  if (panel !== "cockpit") {
    state.activeCockpitSummary = null;
  }
  if (panel === "settings" && settingsViews.includes(settingsView)) {
    state.settingsView = settingsView;
  }
  const nextHash = routeHash();
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  } else {
    render();
  }
}

function navigateSettings(view) {
  navigateTo("settings", view);
}

let metrics = [
  ["100", "Beteiligte", "Schätzung für Bauherr, Planer, Prüfer, Gutachter und Gewerke."],
  ["42", "aktive Kontakte", "Hauptkontakte und Stellvertreter mit direkter Einladung oder delegierter Rolle."],
  ["9", "Leistungsphasen", "Von Grundlagenermittlung bis Objektbetreuung und Dokumentation."],
  ["5", "Querschnittsthemen", "Kosten, Termine, Fördermittel, Kommunikation und Nachhaltigkeit."],
];

let lanes = [
  {
    title: "Kommunikation",
    text: "Projektmail, Chat und Termine bleiben pro Projektbereich nachvollziehbar.",
    progress: 72,
  },
  {
    title: "Dokumente",
    text: "Pläne, Nachweise und Freigaben werden mit Status und Verantwortlichen geteilt.",
    progress: 58,
  },
  {
    title: "Entscheidungen",
    text: "Freigaben, Rückfragen und Konflikte landen im Journal statt in Nebenspuren.",
    progress: 44,
  },
];

let roles = {
  owner: {
    label: "Bauherr",
    type: "Projektrolle",
    id: "Vollzugriff auf Entscheidungen und Budget",
    summary:
      "Sieht das Gesamtprojekt, gibt Budgets und Entscheidungen frei und kann Stellvertreter mit identischer Rolle einladen.",
    permissions: ["Alle Projektrouten", "Kostenfreigabe", "Terminkalender", "Journal und Export"],
  },
  architect: {
    label: "Architekt",
    type: "Projektrolle",
    id: "Koordination und Projektanlage",
    summary:
      "Zentraler Koordinator über 4 bis 7 Jahre. Erstellt das Projekt, lädt Beteiligte ein und steuert Rechte pro Leistungsphase.",
    permissions: ["Projektanlage", "Rolleneinladung", "Dokumentengruppen", "Projektassistenz"],
  },
  controller: {
    label: "Projektsteuerer",
    type: "Projektrolle",
    id: "Termine, Kosten und Berichtslagen",
    summary:
      "Koordiniert Termine, Kosten und Berichtslagen, falls diese Rolle im Projekt eingesetzt wird.",
    permissions: ["Kostenbereich", "Terminsteuerung", "Berichte", "Journal lesen"],
  },
  authority: {
    label: "Behörde",
    type: "Externe Rolle",
    id: "Begrenzter Zugriff für Genehmigung",
    summary:
      "Erhält begrenzten Zugriff auf genehmigungsrelevante Dokumente, Rückfragen und Freigaben.",
    permissions: ["LP4 Dokumente", "Rückfragen", "Status lesen", "Kein Vollzugriff"],
  },
  trade: {
    label: "Gewerk",
    type: "Externe Rolle",
    id: "Begrenzter Zugriff für Ausführung",
    summary:
      "Arbeitet mit eingeschränkten Plan-, Termin- und Dokumentengruppen in der Ausführung.",
    permissions: ["Dokumentengruppe", "Termine", "Chat", "Journal begrenzt"],
  },
};

let runnerRoleKeys = ["architect", "owner", "authority", "trade"];

let runnerRoleWindowLayout = {
  architect: { left: 40, top: 60, width: 470, height: 640 },
  owner: { left: 540, top: 60, width: 470, height: 640 },
  authority: { left: 1040, top: 60, width: 470, height: 640 },
  trade: { left: 1540, top: 60, width: 470, height: 640 },
};

let runnerProtocolSteps = [
  {
    from: "architect",
    to: "owner",
    text: "Bitte prüfe die LP3-Kostenfreigabe für Demo: Kita 2028.",
    journal: "Architekt fordert Bauherr-Freigabe für LP3 an.",
  },
  {
    from: "owner",
    to: "architect",
    text: "Freigabe unter der Bedingung, dass der Fördermitteltermin im Projektkalender bleibt.",
    journal: "Bauherr gibt LP3 mit Terminauflage frei.",
  },
  {
    from: "architect",
    to: "authority",
    text: "Genehmigungsmappe LP4 ist vorbereitet. Rückfrage Stellplatznachweis bitte im LP4-Bereich ergänzen.",
    journal: "Architekt gibt LP4-Unterlagen für Behörde frei.",
  },
  {
    from: "authority",
    to: "architect",
    text: "Rückfrage liegt vor: Stellplatznachweis und Brandschutzverweis fehlen noch.",
    journal: "Behörde meldet zwei offene Nachweise.",
  },
  {
    from: "architect",
    to: "trade",
    text: "Vorabinfo: Planstand LP5 bleibt gesperrt, bis LP4-Rückfrage geklärt ist.",
    journal: "Gewerk erhält begrenzten Vorabhinweis ohne Planfreigabe.",
  },
  {
    from: "trade",
    to: "architect",
    text: "Verstanden. Baustellenbereich wartet auf freigegebenen Planstand.",
    journal: "Gewerk bestätigt begrenzten Zugriff.",
  },
];

let sharedTrieRoots = [
  {
    path: "/demo-kita-2028/project-mail",
    object: "ProjectMailTrieRoot",
    owner: "architect",
    visibility: { owner: "full", architect: "full", controller: "full", authority: "filtered", trade: "filtered" },
  },
  {
    path: "/demo-kita-2028/source/imap",
    object: "SourceEntryTrieRoot",
    owner: "architect",
    visibility: { owner: "filtered", architect: "full", controller: "filtered", authority: "none", trade: "none" },
  },
  {
    path: "/demo-kita-2028/lp4/permit-documents",
    object: "ProjectDocumentTrieRoot",
    owner: "architect",
    visibility: { owner: "full", architect: "full", controller: "filtered", authority: "filtered", trade: "none" },
  },
  {
    path: "/demo-kita-2028/costs/din276",
    object: "CostControlTrieRoot",
    owner: "controller",
    visibility: { owner: "full", architect: "full", controller: "full", authority: "none", trade: "none" },
  },
  {
    path: "/demo-kita-2028/lp8/site",
    object: "ConstructionSiteTrieRoot",
    owner: "architect",
    visibility: { owner: "filtered", architect: "full", controller: "filtered", authority: "none", trade: "filtered" },
  },
];

let { labels: planningLabels, phases, topics, flowDomains } = createHoaiPlanningDefaults();

let projectSchedule = createDemoProjectSchedule();

let ai = {
  goal: {
    type: "Assistenzauftrag",
    ref: "LP3 zu LP4 vorbereiten",
    objective: "LP3 nach LP4 übergabefähig machen, ohne Rückfragen und Nachweise in Nebenspuren zu verlieren.",
    why: "Das Architekturbüro trägt die Koordination. Der AI-Agent soll nicht entscheiden, sondern Lücken, Risiken und widersprüchliche Dokumentstände sichtbar machen.",
    criteria: ["Genehmigungsmappe vollständig", "Kosten- und Terminannahmen verknüpft", "Behördenfragen nachvollziehbar", "Freigabe durch Bauherr dokumentiert"],
  },
  workload: {
    type: "Arbeitsbereich",
    ref: "Genehmigungscheck 002",
    context: ["Planstand LP3", "Kosten DIN 276", "Meilensteine", "Entscheidungen", "Projektmail"],
    mutable: ["Aufgaben", "Risikohinweise", "Journalentwürfe"],
    handoff: "Wenn ein fehlender Nachweis eine neue Rolle, neue Einwilligung oder breiteren Dokumentzugriff braucht, Rückgabe an Architekt statt Autokorrektur.",
  },
  run: {
    type: "Prüflauf",
    ref: "27.05.2026, 17:40",
    steps: [
      ["gelesen", "Quellen und Rollenrechte gelesen"],
      ["vorbereitet", "Genehmigungscheck auf LP3/LP4 begrenzt"],
      ["gefunden", "3 offene Nachweise und 1 Rollenfrage gefunden"],
      ["Prüfung", "Architekt prüft Vorschläge"],
      ["gesichert", "Entscheidung im Journal dokumentieren"],
    ],
  },
};

let settingsModel = {
  ui: {
    type: "UISettings",
    section: "ui",
    theme: state.theme,
    language: state.language,
    notifications: true,
  },
  imap: {
    section: "sourceImap",
    accountId: "demo-kita-2028-project-mail",
    host: "imap.architekt.example",
    port: 993,
    secure: true,
    user: "projekt-demo-kita-2028@example.org",
    mailbox: "INBOX/Demo: Kita 2028",
    enabled: true,
    hasPassword: true,
  },
};

let mailPreview = [
  ["Heute", "Bauherr", "Kostenberechnung LP3 freigeben", "entscheidung"],
  ["Gestern", "Behörde", "Rückfrage Stellplatznachweis", "lp4"],
  ["Mo", "Fachplaner TGA", "Energieannahmen aktualisiert", "nachhaltigkeit"],
];

let dataImportModel = {
  type: "Importvorschau",
  source: "Projektdatei",
  workbookSheets: [
    ["Beteiligte", "Kontakte", 42, "Ansprechpartner, Stellvertreter, Gewerke und Kontaktrollen"],
    ["Rollen", "Zugriff", 18, "Projektrollen, Delegation und Begrenzung nach Leistungsphase"],
    ["Termine", "Kalender", 26, "Gremientermine, Behördenfristen und Bauzeitenplan"],
    ["Dokumente", "Planstand", 64, "Planstände, Nachweise und Freigaben"],
    ["Mail-Zuordnung", "Projektmail", 12, "Absender, Betreffmuster und Projektkanalzuordnung"],
  ],
  previewRows: [
    ["Bauherr Darmstadt", "Bauherr", "Projektmail", "voll"],
    ["Amt Bauaufsicht", "Behörde", "Genehmigungsunterlagen", "begrenzt bis LP4"],
    ["TGA Fachplanung", "Fachplanung", "Ausführungsplanung", "Planstand lesen/schreiben"],
    ["Gewerk Rohbau", "Gewerk", "Baustelle LP8", "begrenzt ab LP6"],
  ],
};

let exportBundleModel = {
  type: "Projekt-Export",
  ref: "Demo: Kita 2028",
  sections: [
    ["Projekt", "Titel, aktive Leistungsphase, Exportzeit"],
    ["Beteiligte", "Kontakte, Rollen und Stellvertretungen"],
    ["Zugriff", "Projektbereiche und sichtbare Berechtigungen"],
    ["Dokumente", "Planstände und aktueller Status"],
    ["Mail", "Projektmail-Bezüge ohne Mailpasswort"],
    ["Assistenz", "Prüfauftrag, Quellen und Ergebnisstand"],
    ["Journal", "Nachvollziehbare Ereignisse"],
    ["Einstellungen", "Sprache, Theme und IMAP-Metadaten"],
  ],
  warnings: [
    "Passwörter und Tokens werden nicht exportiert.",
    "Mailinhalte werden nur über Projektbezüge aufgeführt.",
    "Zugriffe werden als sichtbare Berechtigungsliste exportiert.",
  ],
};

let projectSource = createProjectSourceBundle({
  source: {
    projectId: "demo-kita-2028",
    repoUrl: "https://github.com/juergengeck/projektor.git",
    defaultBranch: "main",
    rootPath: ".",
    detachedWorktreeRoot: "../vger-worktrees/projektor",
    trackedPathGlobs: ["projects/demo-kita-2028/**", "docs/**", "packages/**", "*.project.js"],
  },
  branch: "main",
  head: "working-tree",
  status: "dirty",
  generatedAt: "2026-06-03T09:30:00.000Z",
  ignoredPaths: ["dist", ".wrangler", "node_modules", ".env"],
  files: [
    { path: "projects/demo-kita-2028/project.json", kind: "project-graph", owner: "Architekt", phase: "LP1-LP9", status: "tracked" },
    { path: "projects/demo-kita-2028/schedule.json", kind: "schedule", owner: "Projektsteuerer", phase: "LP3", status: "tracked" },
    { path: "projects/demo-kita-2028/journal.ndjson", kind: "journal", owner: "Architekt", phase: "laufend", status: "modified" },
  ],
});

let journalBase = [
  ["2026-05-27 09:12", "Rolle vergeben", "Architekt lädt Bauherr per Link ein.", "Journal 001"],
  ["2026-05-27 10:35", "Dokument freigegeben", "Entwurf LP3 Version 14 im Dokumentenbereich freigegeben.", "Journal 002"],
  ["2026-05-27 11:48", "Entscheidung erfasst", "Kostenberechnung wird als Grundlage für Gremientermin markiert.", "Journal 003"],
  ["2026-05-27 13:05", "Assistenz vorbereitet", "Prüfung für LP3 zu LP4 vorbereitet.", "Journal 004"],
  ["2026-05-27 13:31", "Einstellungen aktualisiert", "IMAP Account-Metadaten aktualisiert; Passwort bleibt lokal geschützt.", "Journal 005"],
  ["2026-05-27 13:46", "Export vorbereitet", "Projekt-Export mit Beteiligten, Rollen, Dokumenten, Mailbezügen, Einstellungen und Journal vorbereitet.", "Journal 006"],
];

let ngoWorkspace = createNgoProjectData();

const PROJECT_STORAGE_KEY = "projektor-active-project";
const datasetPlans = listDemoDatasetPlans();

let demoDatasetCreator = {
  skill: deepClone(DEMO_DATASET_CREATOR_SKILL),
  plan: datasetPlans[0],
  generatedAt: "2026-06-02T09:30:00.000Z",
  plannerEvidence: null,
};

function deepClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function createDefaultProjectSourceBundle(projectId = demoProject.id || "project") {
  return createProjectSourceBundle({
    source: {
      projectId,
      repoUrl: "https://github.com/juergengeck/projektor.git",
      defaultBranch: "main",
      rootPath: ".",
      detachedWorktreeRoot: "../vger-worktrees/projektor",
      trackedPathGlobs: [`projects/${projectId}/**`, "docs/**", "packages/**", "*.project.js"],
    },
    branch: "main",
    head: "working-tree",
    status: "dirty",
    generatedAt: "2026-06-03T09:30:00.000Z",
    ignoredPaths: ["dist", ".wrangler", "node_modules", ".env"],
    files: [
      { path: `projects/${projectId}/project.json`, kind: "project-graph", owner: "Projektleitung", phase: "LP1-LP9", status: "tracked" },
      { path: `projects/${projectId}/schedule.json`, kind: "schedule", owner: "Projektsteuerung", phase: "laufend", status: "tracked" },
      { path: `projects/${projectId}/journal.ndjson`, kind: "journal", owner: "Projektleitung", phase: "laufend", status: "modified" },
    ],
  });
}

function sanitizeProjectSettings(settings) {
  const sanitized = deepClone(settings || {});
  sanitized.ui = { ...(settingsModel.ui || {}), ...(sanitized.ui || {}) };
  sanitized.imap = { ...(settingsModel.imap || {}), ...(sanitized.imap || {}) };
  if (sanitized.imap) {
    delete sanitized.imap.password;
    delete sanitized.imap.accessToken;
    delete sanitized.imap.refreshToken;
  }
  return sanitized;
}

function projectRuntime() {
  return {
    activeRole: state.activeRole,
    activePhase: state.activePhase,
    activeFlow: state.activeFlow,
    syncAgeMinutes: state.syncCount,
    journalExtra: state.journalExtra,
  };
}

function createProjectDatatype() {
  return {
    kind: PROJECT_DATATYPE_KIND,
    schemaVersion: PROJECT_DATATYPE_VERSION,
    creator: deepClone(demoDatasetCreator),
    project: deepClone(demoProject),
    cockpit: {
      metrics: deepClone(metrics),
      lanes: deepClone(lanes),
    },
    roleModel: {
      roles: deepClone(roles),
      runnerRoleKeys: deepClone(runnerRoleKeys),
      runnerRoleWindowLayout: deepClone(runnerRoleWindowLayout),
      runnerProtocolSteps: deepClone(runnerProtocolSteps),
      sharedTrieRoots: deepClone(sharedTrieRoots),
    },
    planning: {
      labels: deepClone(planningLabels),
      phases: deepClone(phases),
      topics: deepClone(topics),
      flowDomains: deepClone(flowDomains),
      schedule: deepClone(projectSchedule),
    },
    assistant: deepClone(ai),
    settings: sanitizeProjectSettings(settingsModel),
    projectSource: deepClone(projectSource),
    ngo: normalizeNgoProjectData(ngoWorkspace),
    mailPreview: deepClone(mailPreview),
    importModel: deepClone(dataImportModel),
    exportModel: deepClone(exportBundleModel),
    journal: deepClone(journalBase),
    runtime: projectRuntime(),
  };
}

function projectFromLegacyExport(payload) {
  const fallback = createProjectDatatype();
  if (!isPlainObject(payload?.project)) return null;

  return {
    ...fallback,
    project: {
      ...fallback.project,
      id: payload.project.id || fallback.project.id,
      titles: payload.project.title ? { ...fallback.project.titles, de: payload.project.title } : fallback.project.titles,
      subtitles: payload.project.subtitle ? { ...fallback.project.subtitles, de: payload.project.subtitle } : fallback.project.subtitles,
    },
    roleModel: {
      ...fallback.roleModel,
      roles: isPlainObject(payload.roles) ? payload.roles : fallback.roleModel.roles,
      sharedTrieRoots: Array.isArray(payload.sharedTrieRoots) ? payload.sharedTrieRoots : fallback.roleModel.sharedTrieRoots,
    },
    settings: isPlainObject(payload.settings)
      ? {
          ui: payload.settings.ui || fallback.settings.ui,
          imap: payload.settings.sourceImap || payload.settings.imap || fallback.settings.imap,
        }
      : fallback.settings,
    projectSource: isPlainObject(payload.projectSource)
      ? payload.projectSource
      : createDefaultProjectSourceBundle(payload.project.id || fallback.project.id),
    importModel: isPlainObject(payload.importModel) ? payload.importModel : fallback.importModel,
    assistant: isPlainObject(payload.ai) ? payload.ai : fallback.assistant,
    runtime: {
      ...fallback.runtime,
      activePhase: payload.project.activePhase || fallback.runtime.activePhase,
      syncAgeMinutes: payload.project.syncAgeMinutes || fallback.runtime.syncAgeMinutes,
    },
  };
}

function normalizeProjectDatatype(payload) {
  if (payload?.kind === PROJECT_DATATYPE_KIND) {
    if (payload.schemaVersion !== PROJECT_DATATYPE_VERSION) {
      throw new Error(`Unsupported project schema version: ${payload.schemaVersion}`);
    }
    if (!isPlainObject(payload.project) || !payload.project.id) {
      throw new Error("Project file has no project id.");
    }
    return payload;
  }

  const legacyProject = projectFromLegacyExport(payload);
  if (legacyProject) return legacyProject;
  throw new Error("This is not a projektor.one project file.");
}

function projectRootPath() {
  return `/${demoProject.id || "project"}`;
}

function projectRolePath(roleKey) {
  return `${projectRootPath()}/roles/${roleKey}`;
}

function projectRef() {
  const localized = demoProject.shortTitle?.[state.language] || demoProject.shortTitle?.de || projectText("titles");
  return localized || demoProject.id || "Project";
}

function conciseProjectRef() {
  const ref = projectRef();
  return ref.split(" - ")[0] || ref;
}

const roleAccessCycle = ["none", "filtered", "full"];

const projectAreaLabels = {
  de: {
    "authority-questions": "Behördenrückfragen",
    "cluster-a": "Cluster A",
    "costs-din276": "Kosten DIN 276",
    "energy-audit": "Energienachweise",
    "fire-safety": "Brandschutz",
    "funding": "Förderung",
    hygiene: "Hygiene",
    imap: "IMAP-Projektmail",
    journal: "Journal",
    "night-work": "Nachtarbeiten",
    participants: "Teilnehmerinnen",
    "permit-documents": "Genehmigungsunterlagen",
    planstand: "Planstand",
    "project-mail": "Projektmail",
    retention: "Bindung und Aufbewahrung",
    safeguarding: "Safeguarding",
    site: "Baustelle",
    donations: "Spenden",
    donors: "Unterstützerinnen",
    visa: "Visa-Fristen",
    windows: "Bauzeitenfenster",
  },
  en: {
    "authority-questions": "Authority questions",
    "cluster-a": "Cluster A",
    "costs-din276": "Costs DIN 276",
    "energy-audit": "Energy evidence",
    "fire-safety": "Fire safety",
    funding: "Funding",
    hygiene: "Hygiene",
    imap: "IMAP project mail",
    journal: "Journal",
    "night-work": "Night work",
    participants: "Participants",
    "permit-documents": "Permit documents",
    planstand: "Plan status",
    "project-mail": "Project mail",
    retention: "Retention",
    safeguarding: "Safeguarding",
    site: "Construction site",
    donations: "Donations",
    donors: "Supporters",
    visa: "Visa deadlines",
    windows: "Work windows",
  },
};

const projectContentLabels = {
  de: {
    NgoDonorTrieRoot: "Unterstützerprofile",
    NgoDonationTrieRoot: "Spendeneingänge",
    NgoParticipantTrieRoot: "Teilnehmerinnendaten",
    NgoVisaDeadlineTrieRoot: "Visa und Fristen",
    NgoSafeguardingTrieRoot: "Schutz und Meldungen",
    NgoRetentionTrieRoot: "Aufbewahrung",
    ProjectJournalTrieRoot: "Projektjournal",
    ProjectMailTrieRoot: "Projektmail",
    SourceEntryTrieRoot: "Importquelle",
    ProjectDocumentTrieRoot: "Dokumente",
    CostControlTrieRoot: "Kostenkontrolle",
    ConstructionSiteTrieRoot: "Baustelle",
    ProjectQuestionTrieRoot: "Rückfragen",
    PlanStateTrieRoot: "Planfreigaben",
    OperationWindowTrieRoot: "Betriebsfenster",
    HygieneEvidenceTrieRoot: "Hygienenachweise",
    FireSafetyTrieRoot: "Brandschutznachweise",
    ProjectClusterTrieRoot: "Projektcluster",
    TenantNoticeTrieRoot: "Mieterinformationen",
    FundingTrieRoot: "Fördermittel",
    EnergyEvidenceTrieRoot: "Energienachweise",
    ConstructionWindowTrieRoot: "Bauzeitenfenster",
  },
  en: {
    NgoDonorTrieRoot: "Supporter profiles",
    NgoDonationTrieRoot: "Donation records",
    NgoParticipantTrieRoot: "Participant data",
    NgoVisaDeadlineTrieRoot: "Visa deadlines",
    NgoSafeguardingTrieRoot: "Safeguarding",
    NgoRetentionTrieRoot: "Retention",
    ProjectJournalTrieRoot: "Project journal",
    ProjectMailTrieRoot: "Project mail",
    SourceEntryTrieRoot: "Import source",
    ProjectDocumentTrieRoot: "Documents",
    CostControlTrieRoot: "Cost control",
    ConstructionSiteTrieRoot: "Construction site",
    ProjectQuestionTrieRoot: "Questions",
    PlanStateTrieRoot: "Plan approvals",
    OperationWindowTrieRoot: "Operation windows",
    HygieneEvidenceTrieRoot: "Hygiene evidence",
    FireSafetyTrieRoot: "Fire safety evidence",
    ProjectClusterTrieRoot: "Project cluster",
    TenantNoticeTrieRoot: "Tenant notices",
    FundingTrieRoot: "Funding",
    EnergyEvidenceTrieRoot: "Energy evidence",
    ConstructionWindowTrieRoot: "Work windows",
  },
};

function humanizeSlug(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function projectAreaLabel(root) {
  const segments = String(root?.path || "").split("/").filter(Boolean);
  const areaKey = segments.at(-1) || root?.owner || "project";
  return projectAreaLabels[state.language]?.[areaKey] || projectAreaLabels.de[areaKey] || humanizeSlug(areaKey);
}

function projectContentLabel(root) {
  return projectContentLabels[state.language]?.[root?.object] || projectContentLabels.de[root?.object] || projectAreaLabel(root);
}

function accessLabel(access) {
  if (access === "full") return tr("accessFull");
  if (access === "filtered") return tr("accessFiltered");
  return tr("accessNone");
}

function cycleRoleAccess(rootIndex, roleKey) {
  const root = sharedTrieRoots[rootIndex];
  if (!root || !roles[roleKey]) return;
  root.visibility = root.visibility || {};
  const current = root.visibility[roleKey] || "none";
  const next = roleAccessCycle[(roleAccessCycle.indexOf(current) + 1) % roleAccessCycle.length] || roleAccessCycle[0];
  root.visibility[roleKey] = next;
  persistActiveProjectDatatype();
  renderRoles();
}

function slugifySectionTitle(title, fallback = "section") {
  const slug = String(title || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function cockpitSectionId(lane, index) {
  return lane.id || lane.sectionId || slugifySectionTitle(lane.title, `section-${index + 1}`);
}

function cockpitSections() {
  return lanes.map((lane, index) => ({
    ...lane,
    id: cockpitSectionId(lane, index),
    index,
  }));
}

function activeCockpitSection() {
  if (!state.activeCockpitSummary) return null;
  return cockpitSections().find((section) => section.id === state.activeCockpitSummary) || null;
}

function lowerSectionTitle(section) {
  return String(section?.title || "").toLowerCase();
}

function cockpitSectionTarget(section) {
  const title = lowerSectionTitle(section);
  if (demoProject.projectType === "ngo") {
    if (title.includes("spenden")) {
      return { panel: "ngo", ngoView: "donors", label: "Spenderdetails öffnen" };
    }
    if (title.includes("teilnehmer")) {
      return { panel: "ngo", ngoView: "participants", label: "Teilnehmerinnen öffnen" };
    }
    return { panel: "ngo", label: "Pflicht-Abläufe prüfen" };
  }
  if (title.includes("kommunikation")) return { panel: "flows", label: "Flows öffnen" };
  if (title.includes("dokument")) return { panel: "data", label: "Datenansicht öffnen" };
  if (title.includes("entscheidung")) return { panel: "journal", label: "Journal öffnen" };
  return { panel: "data", label: "Projektbereich öffnen" };
}

function cockpitSummaryRows(section) {
  const title = lowerSectionTitle(section);
  const rows = [
    ["Projektbereich", section.title],
    ["Fortschritt", `${section.progress || 0}%`],
    ["Bereichspfad", `${projectRootPath()}/${section.id}`],
  ];
  if (demoProject.projectType === "ngo" && title.includes("spenden")) {
    const stats = donorMetrics(ngoWorkspace);
    return [
      ...rows,
      ["Unterstützer", stats.supporterCount],
      ["Gesamt", formatEuro(stats.totalReceived)],
      ["Offene Fälle", stats.openThanks],
    ];
  }
  if (demoProject.projectType === "ngo" && title.includes("teilnehmer")) {
    const stats = participantMetrics(ngoWorkspace);
    return [
      ...rows,
      ["Teilnehmerinnen", stats.participantCount],
      ["Ø Alter", stats.averageAge],
      ["Visum-Fristen", stats.openVisaDeadlines],
    ];
  }
  if (demoProject.projectType === "ngo" && title.includes("pflicht")) {
    const donorStats = donorMetrics(ngoWorkspace);
    const participantStats = participantMetrics(ngoWorkspace);
    return [
      ...rows,
      ["Safeguarding", "aktiv"],
      ["Visum-Fristen", participantStats.openVisaDeadlines],
      ["Dank/Quittung", donorStats.openThanks],
    ];
  }
  return [
    ...rows,
    ["Rollen", Object.keys(roles).length],
    ["Flows", flowDomains.length],
    ["Journal", journalBase.length + state.journalExtra],
  ];
}

function cockpitSummaryEvidence(section) {
  const title = lowerSectionTitle(section);
  if (demoProject.projectType === "ngo" && title.includes("spenden")) {
    return queryNgoDonors(ngoWorkspace, { sort: "open" }).slice(0, 3).map((donor) => [
      donor.name,
      `${formatEuro(donor.totalAmount)} · ${donor.needsThanks ? "Dank offen" : donor.receiptNeeded ? "Quittung offen" : "ok"}`,
    ]);
  }
  if (demoProject.projectType === "ngo" && title.includes("teilnehmer")) {
    return queryNgoParticipants(ngoWorkspace, { sort: "visa" }).slice(0, 3).map((participant) => [
      participant.name,
      `${participant.currentStage} · Visum ${participant.visaDeadline || "nicht relevant"}`,
    ]);
  }
  if (demoProject.projectType === "ngo" && title.includes("pflicht")) {
    return [
      ["Kinderschutz und Safeguarding", "Meldewege, Eskalation und Minderjährigen-Regeln bleiben als Pflichtspur sichtbar."],
      ["Visumsfristen", "Wiedervorlage/Frist löst einen Vorlauf-Alarm aus."],
      ["Austritt zu Ehemalige", ngoWorkspace.settings.retentionPolicy || "Lösch- und Aufbewahrungsregel festlegen."],
    ];
  }
  return [
    ...flowDomains.slice(0, 2).map((flow) => [flow.label, flow.trigger]),
    ...sharedTrieRoots.slice(0, 2).map((root) => [projectContentLabel(root), root.path]),
  ].slice(0, 4);
}

function renderCockpitSummary(section) {
  const target = cockpitSectionTarget(section);
  const action = el("a", {
    className: "secondary-action cockpit-summary-action",
    href: routeHash(target.panel),
    "data-cockpit-target": target.panel,
    text: target.label,
  });
  if (target.ngoView) {
    action.setAttribute("data-ngo-jump", target.ngoView);
  }

  return el("article", { className: "cockpit-summary-card", id: "cockpit-section-summary" }, [
    el("div", { className: "book-top" }, [
      el("span", { className: "card-kicker", text: "Bereichszusammenfassung" }),
      el("code", { className: "book-ref", text: `${projectRootPath()}/${section.id}` }),
    ]),
    el("div", { className: "cockpit-summary-head" }, [
      el("div", {}, [
        el("h3", { text: section.title }),
        el("p", { text: section.text }),
      ]),
      action,
    ]),
    el("div", { className: "cockpit-summary-grid" }, [
      el("ul", { className: "object-list compact-list" }, cockpitSummaryRows(section).map(([label, value]) =>
        el("li", {}, [el("span", { text: label }), el("strong", { text: String(value) })]),
      )),
      el("ul", { className: "topic-list" }, cockpitSummaryEvidence(section).map(([label, text]) =>
        el("li", {}, [el("strong", { text: label }), el("span", { text })]),
      )),
    ]),
  ]);
}

function planningForProject(projectData) {
  const planning = projectData.planning || {};
  if (projectData.project?.projectType !== "ngo") return planning;

  const ngoPlanning = createNgoPlanningOverrides();
  const phaseIds = new Set((planning.phases || []).map((phase) => phase.id));
  const flowIds = new Set((planning.flowDomains || []).map((flow) => flow.id));
  const hasHoaiPhases = phaseIds.has("lp3") || phaseIds.has("lp4");
  const hasHoaiFlows = flowIds.has("invoices") || flowIds.has("contracts") || flowIds.has("calendar");
  const hasNgoLabels = planning.labels?.eyebrow === ngoPlanning.labels.eyebrow;
  const hasNgoFlows = flowIds.has("donations") || flowIds.has("participants") || flowIds.has("safeguarding");
  if (hasNgoLabels && !hasHoaiPhases && hasNgoFlows && !hasHoaiFlows) return planning;

  return {
    ...planning,
    labels: ngoPlanning.labels,
    phases: ngoPlanning.phases,
    topics: ngoPlanning.topics,
    flowDomains: ngoPlanning.flowDomains,
  };
}

function assistantForProject(projectData) {
  const assistant = projectData.assistant || {};
  if (projectData.project?.projectType !== "ngo") return assistant;

  const assistantText = JSON.stringify(assistant);
  const hasConstructionAssistantText =
    assistantText.includes("HOAI-Kontext") ||
    assistantText.includes("Kostenfreigaben") ||
    assistantText.includes("Betreiberpflichten") ||
    assistantText.includes("LP3") ||
    assistantText.includes("Bauherr");

  return hasConstructionAssistantText ? createNgoAssistant(projectData.project.id) : assistant;
}

function installProjectDatatype(projectData, { persist = false } = {}) {
  const normalized = normalizeProjectDatatype(projectData);
  const normalizedPlanning = planningForProject(normalized);
  const normalizedAssistant = assistantForProject(normalized);
  demoDatasetCreator = deepClone(normalized.creator || demoDatasetCreator);
  demoProject = deepClone(normalized.project);
  metrics = deepClone(normalized.cockpit?.metrics || []);
  lanes = deepClone(normalized.cockpit?.lanes || []);
  roles = deepClone(normalized.roleModel?.roles || {});
  runnerRoleKeys = deepClone(normalized.roleModel?.runnerRoleKeys || Object.keys(roles));
  runnerRoleWindowLayout = deepClone(normalized.roleModel?.runnerRoleWindowLayout || runnerRoleWindowLayout);
  runnerProtocolSteps = deepClone(normalized.roleModel?.runnerProtocolSteps || []);
  sharedTrieRoots = deepClone(normalized.roleModel?.sharedTrieRoots || []);
  ({ labels: planningLabels, phases, topics, flowDomains } = normalizeHoaiPlanning(normalizedPlanning));
  projectSchedule = createProjectPlan(normalizedPlanning.schedule || projectSchedule);
  ai = deepClone(normalizedAssistant || ai);
  settingsModel = sanitizeProjectSettings(normalized.settings || settingsModel);
  projectSource = normalizeProjectSourceBundle(
    normalized.projectSource || createDefaultProjectSourceBundle(normalized.project?.id || demoProject.id),
  );
  ngoWorkspace = normalizeNgoProjectData(normalized.ngo || {});
  mailPreview = deepClone(normalized.mailPreview || []);
  dataImportModel = deepClone(normalized.importModel || dataImportModel);
  exportBundleModel = deepClone(normalized.exportModel || exportBundleModel);
  journalBase = deepClone(normalized.journal || []);

  const runtime = normalized.runtime || {};
  state.activeRole = roles[runtime.activeRole] ? runtime.activeRole : Object.keys(roles)[0] || state.activeRole;
  state.activePhase = phases.some((phase) => phase.id === runtime.activePhase) ? runtime.activePhase : phases[0]?.id || state.activePhase;
  state.activeFlow = flowDomains.some((flow) => flow.id === runtime.activeFlow) ? runtime.activeFlow : flowDomains[0]?.id || state.activeFlow;
  state.syncCount = Number.isFinite(runtime.syncAgeMinutes) ? runtime.syncAgeMinutes : state.syncCount;
  state.journalExtra = Number.isInteger(runtime.journalExtra) ? runtime.journalExtra : state.journalExtra;
  state.theme = settingsModel.ui?.theme || state.theme;
  state.language = settingsModel.ui?.language || state.language;
  state.runnerWindows = {};
  state.runnerLog = [];
  state.runnerMessages = [];
  state.runnerProtocolStep = 0;
  state.runnerStatus = "idle";
  state.activeNgoView = "donors";

  if (persist) {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createProjectDatatype()));
  }
}

function persistActiveProjectDatatype() {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createProjectDatatype()));
}

function loadStoredProjectDatatype() {
  const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!stored) return null;
  try {
    return normalizeProjectDatatype(JSON.parse(stored));
  } catch {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
    return null;
  }
}

installProjectDatatype(loadStoredProjectDatatype() || createProjectDatatype());

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(child));
  return node;
}

function svgEl(tag, options = {}, children = []) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(child));
  return node;
}

function currentOnboardingIndex() {
  return Math.max(0, onboardingSteps.indexOf(state.onboardingStep));
}

function onboardingStepLabel(step) {
  return {
    identity: onb("identityStep"),
    web: onb("appStoreStep"),
    password: onb("passwordStep"),
    stats: onb("statsStep"),
    review: onb("reviewStep"),
  }[step];
}

function onboardingTextInput(id, label, value, placeholder, type = "text", help = "") {
  const input = el("input", {
    id,
    name: id,
    type,
    placeholder,
    autocomplete: type === "email" ? "email" : "off",
  });
  input.value = value;
  return el("label", { className: "onboarding-field" }, [
    el("span", { text: label }),
    input,
    help ? el("small", { text: help }) : el("small", { text: "" }),
  ]);
}

function renderOnboardingProgress() {
  return el("ol", { className: "onboarding-progress", "aria-label": "Onboarding progress" }, onboardingSteps.map((step, index) => {
    const className = index < currentOnboardingIndex() ? "done" : index === currentOnboardingIndex() ? "active" : "";
    return el("li", { className }, [
      el("span", { text: String(index + 1) }),
      el("strong", { text: onboardingStepLabel(step) }),
    ]);
  }));
}

function renderOnboardingLanguage() {
  const select = el("select", { id: "onboardingLanguage", className: "language-select", "aria-label": "Language" });
  Object.entries(languages).forEach(([code, label]) => {
    const option = el("option", { value: code, text: label });
    option.selected = state.language === code;
    select.append(option);
  });
  return select;
}

function renderTrustCard(title, text) {
  return el("article", { className: "onboarding-info-card" }, [
    el("h3", { text: title }),
    el("p", { text }),
  ]);
}

function renderOnboardingBody() {
  if (state.onboardingStep === "identity") {
    return [
      el("h1", { text: onb("profileTitle") }),
      el("p", { className: "onboarding-lede", text: onb("secureEmail") }),
      onboardingTextInput("onboardingName", onb("name"), state.onboarding.name, onb("namePlaceholder"), "text"),
      onboardingTextInput("onboardingEmail", onb("email"), state.onboarding.email, onb("emailPlaceholder"), "email", onb("emailHelp")),
    ];
  }

  if (state.onboardingStep === "web") {
    return [
      el("h1", { text: onb("nextStoreTitle") }),
      el("p", { className: "onboarding-lede", text: onb("intro") }),
      el("div", { className: "onboarding-info-grid" }, [
        renderTrustCard(onb("nextStoreTitle"), onb("nextStore")),
        renderTrustCard(onb("localPromiseTitle"), onb("localPromise")),
      ]),
    ];
  }

  if (state.onboardingStep === "password") {
    return [
      el("h1", { text: onb("passwordTitle") }),
      el("p", { className: "onboarding-lede", text: onb("passwordHelp") }),
      el("div", { className: "onboarding-password-grid" }, [
        onboardingTextInput("onboardingPassword", `${onb("password")} (${onb("optional")})`, state.onboarding.password, onb("passwordPlaceholder"), "password"),
        onboardingTextInput("onboardingPasswordConfirm", onb("passwordConfirm"), state.onboarding.passwordConfirm, onb("passwordPlaceholder"), "password"),
      ]),
    ];
  }

  if (state.onboardingStep === "stats") {
    const checkbox = el("input", { id: "onboardingStats", type: "checkbox" });
    checkbox.checked = state.onboarding.statsConsent;
    return [
      el("h1", { text: onb("statsTitle") }),
      el("p", { className: "onboarding-lede", text: onb("statsHelp") }),
      el("label", { className: "onboarding-consent" }, [
        checkbox,
        el("span", { text: onb("statsConsent") }),
      ]),
    ];
  }

  const hasPassword = Boolean(state.onboarding.password);
  return [
    el("h1", { text: onb("reviewTitle") }),
    el("p", { className: "onboarding-lede", text: onb("localPromise") }),
    el("ul", { className: "object-list onboarding-review" }, [
      el("li", {}, [el("span", { text: onb("reviewName") }), el("strong", { text: state.onboarding.name || "-" })]),
      el("li", {}, [el("span", { text: onb("reviewEmail") }), el("strong", { text: state.onboarding.email || "-" })]),
      el("li", {}, [el("span", { text: onb("passwordStep") }), el("strong", { text: hasPassword ? onb("reviewPasswordOn") : onb("reviewPasswordOff") })]),
      el("li", {}, [el("span", { text: onb("statsStep") }), el("strong", { text: state.onboarding.statsConsent ? onb("reviewStatsOn") : onb("reviewStatsOff") })]),
    ]),
  ];
}

function renderOnboarding() {
  const root = document.querySelector("#onboardingRoot");
  const shell = document.querySelector("#appShell");
  if (!root || !shell) return;

  const complete = state.onboardingStep === "done";
  root.hidden = complete;
  shell.classList.toggle("is-hidden", !complete);
  if (complete) {
    root.replaceChildren();
    return;
  }

  const isFirst = currentOnboardingIndex() === 0;
  const isLast = state.onboardingStep === "review";
  const isPassword = state.onboardingStep === "password";
  const actions = [
    !isFirst ? el("button", { className: "secondary-action", type: "button", "data-onboarding-action": "back", text: onb("back") }) : null,
    isPassword ? el("button", { className: "secondary-action", type: "button", "data-onboarding-action": "skip-password", text: onb("skipPassword") }) : null,
    el("button", {
      className: "primary-action",
      type: "button",
      "data-onboarding-action": isLast ? "finish" : "next",
      text: isLast ? onb("finish") : onb("continue"),
    }),
  ].filter(Boolean);

  root.replaceChildren(
    el("div", { className: "onboarding-card" }, [
      el("header", { className: "onboarding-header" }, [
        el("div", { className: "onboarding-brand" }, [
          el("span", { className: "brand-mark onboarding-brand-mark", "aria-hidden": "true" }, [
            el("img", { src: "./projektor_logo.svg", alt: "" }),
          ]),
          el("div", {}, [
            el("span", { className: "card-kicker", text: "projektor.one" }),
            el("strong", { text: tr("topEyebrow") }),
          ]),
        ]),
        renderOnboardingLanguage(),
      ]),
      renderOnboardingProgress(),
      el("div", { className: "onboarding-body" }, renderOnboardingBody()),
      state.onboarding.error ? el("p", { className: "onboarding-error", text: state.onboarding.error }) : el("p", { className: "onboarding-error empty", text: "" }),
      el("footer", { className: "onboarding-actions" }, actions),
    ]),
  );
}

function renderNav() {
  const nav = document.querySelector("#nav");
  nav.replaceChildren(
    ...navItems.map(([id, icon, labelKey]) => {
      const button = el("button", {
        type: "button",
        "aria-current": state.activePanel === id ? "page" : "false",
      });
      button.append(el("span", { className: "nav-icon", text: icon }), el("span", { text: tr(labelKey) }));
      button.addEventListener("click", () => {
        navigateTo(id);
      });
      return button;
    }),
  );
}

function breadcrumbLink(label, hash, current = false) {
  const link = el("a", {
    href: hash,
    text: label,
    "aria-current": current ? "page" : "false",
  });
  return link;
}

function renderBreadcrumbs() {
  const root = document.querySelector("#breadcrumbs");
  if (!root) return;
  const panelLabelKey = navItems.find(([id]) => id === state.activePanel)?.[2] || "navCockpit";
  const crumbs = [
    breadcrumbLink("projektor.one", "#/cockpit"),
    breadcrumbLink(tr(panelLabelKey), routeHash(state.activePanel), state.activePanel !== "settings"),
  ];
  const cockpitSection = activeCockpitSection();

  if (state.activePanel === "cockpit" && cockpitSection) {
    crumbs[1] = breadcrumbLink(tr(panelLabelKey), routeHash("cockpit"));
    crumbs.push(breadcrumbLink(cockpitSection.title, cockpitSummaryHash(cockpitSection.id), true));
  }

  if (state.activePanel === "settings") {
    crumbs.push(breadcrumbLink(tr(state.settingsView === "feedback" ? "settingsFeedback" : "settingsConfig"), routeHash("settings", state.settingsView), true));
  }

  root.replaceChildren(...crumbs);
}

function setText(id, text) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = text;
}

function renderStaticText() {
  setText("topEyebrow", tr("topEyebrow"));
  setText("mainTitle", projectText("titles"));
  setText("brandSubtitle", tr("brandSubtitle"));
  setText("mapProjectLabel", projectText("mapLabel"));
  document.querySelector(".map-center strong").textContent = conciseProjectRef();
  document.querySelector(".map-center").title = projectText("subtitles");
  const mapProjectId = `${demoProject.objectType || "Project ID"} ${demoProject.id}`;
  setText("mapProjectId", mapProjectId);
  document.querySelector("#mapProjectId").title = mapProjectId;
  const nodes = [...(demoProject.nodes?.[state.language] ?? demoProject.nodes?.de ?? [])];
  setText("mapNodeA", nodes[0]);
  setText("mapNodeB", nodes[1]);
  setText("mapNodeC", nodes[2]);
  setText("mapNodeD", nodes[3]);
  const phaseLabel = demoProject.phase?.[state.language] ?? demoProject.phase?.de ?? state.activePhase;
  const riskLabel = demoProject.risk?.[state.language] ?? demoProject.risk?.de ?? "-";
  const phasePrefix = planningLabels.statusPhasePrefix ?? "LP";
  document.querySelector("#statusPhase").innerHTML = phasePrefix
    ? `<strong>${phasePrefix}</strong> ${phaseLabel}`
    : phaseLabel;
  document.querySelector("#statusRisk").innerHTML = `<strong>${tr("statusRiskLabel")}</strong> ${riskLabel}`;
  document.querySelector("#statusSync").innerHTML = `<strong>${tr("statusSync")}</strong> ${state.syncCount} min`;

  setText("cockpitEyebrow", tr("cockpitEyebrow"));
  setText("cockpit-title", tr("cockpitTitle"));
  setText("simulateSync", tr("simulateSync"));
  setText("rolesEyebrow", tr("rolesEyebrow"));
  setText("roles-title", tr("rolesTitle"));
  setText("phasesEyebrow", planningLabels.eyebrow || tr("phasesEyebrow"));
  setText("phases-title", planningLabels.title || tr("phasesTitle"));
  setText("flowsEyebrow", planningLabels.flowsEyebrow || tr("flowsEyebrow"));
  setText("flows-title", planningLabels.flowsTitle || tr("flowsTitle"));
  setText("dataEyebrow", tr("dataEyebrow"));
  setText("data-title", tr("dataTitle"));
  setText("downloadTemplate", tr("template"));
  setText("exportBundle", tr("export"));
  setText("ngoEyebrow", tr("ngoEyebrow"));
  setText("ngo-title", tr("ngoTitle"));
  setText("aiEyebrow", tr("aiEyebrow"));
  setText("ai-title", tr("aiTitle"));
  setText("advanceRun", tr("advanceRun"));
  setText("journalEyebrow", tr("journalEyebrow"));
  setText("journal-title", tr("journalTitle"));
  setText("addJournalEntry", tr("demoEvent"));
  setText("settingsEyebrow", tr("settingsEyebrow"));
  setText("settings-title", tr("settingsTitle"));
  setText("settingsFeedbackButton", tr("settingsFeedback"));
  setText("testImap", tr("testImap"));
  setText("simulateImport", tr("simulateImport"));
  renderBreadcrumbs();
}

function renderLanguageSelect() {
  const select = document.querySelector("#languageSelect");
  select.setAttribute("aria-label", tr("navSettings"));
  select.replaceChildren(
    ...Object.entries(languages).map(([code, label]) => {
      const option = el("option", { value: code, text: label });
      option.selected = state.language === code;
      return option;
    }),
  );
}

function renderPanels() {
  navItems.forEach(([id]) => {
    document.querySelector(`#${id}`).classList.toggle("active", state.activePanel === id);
  });
}

function renderCockpit() {
  const sections = cockpitSections();
  const activeSection = activeCockpitSection();
  document.querySelector("#metrics").replaceChildren(
    ...metrics.map(([value, label, text]) =>
      el("div", { className: "metric" }, [
        el("span", { className: "card-kicker", text: label }),
        el("strong", { text: value }),
        el("p", { text }),
      ]),
    ),
  );

  document.querySelector("#workLanes").replaceChildren(
    ...sections.map((section) =>
      el("a", {
        className: `lane lane-link${section.id === state.activeCockpitSummary ? " active" : ""}`,
        href: cockpitSummaryHash(section.id),
        "aria-current": section.id === state.activeCockpitSummary ? "page" : "false",
      }, [
        el("span", { className: "card-kicker", text: "Projektbereich" }),
        el("h3", { text: section.title }),
        el("p", { text: section.text }),
        el("div", { className: "lane-progress" }, [el("span", { style: `width: ${section.progress || 0}%` })]),
      ]),
    ),
  );

  const summaryRoot = document.querySelector("#cockpitSummary");
  summaryRoot.replaceChildren(...(activeSection ? [renderCockpitSummary(activeSection)] : []));
}

function renderRoles() {
  const tabs = document.querySelector("#roleTabs");
  tabs.replaceChildren(
    ...Object.entries(roles).map(([key, role]) => {
      const button = el("button", {
        type: "button",
        className: state.activeRole === key ? "active" : "",
        text: role.label,
      });
      button.addEventListener("click", () => {
        state.activeRole = key;
        renderRoles();
      });
      return button;
    }),
  );

  const role = roles[state.activeRole];
  document.querySelector("#roleDetail").replaceChildren(
    el("div", { className: "book-top" }, [
      el("div", {}, [el("span", { className: "card-kicker", text: role.type }), el("h3", { text: role.label })]),
      el("code", { className: "book-ref", text: role.id }),
    ]),
    el("p", { text: role.summary }),
    el("ul", { className: "role-permissions" }, role.permissions.map((permission) => el("li", {}, [el("span", { text: permission }), el("strong", { text: tr("roleAllowed") })]))),
    el("ul", { className: "object-list" }, [
      el("li", {}, [el("span", { text: "Zuordnung" }), el("strong", { text: "Projekt, Rolle, Person" })]),
        el("li", {}, [el("span", { text: "Grenze" }), el("strong", { text: "Vertrauen + Kontext begrenzen Export" })]),
        el("li", {}, [el("span", { text: "Entzug" }), el("strong", { text: "Policy-Änderung mit Assembly-Spur" })]),
    ]),
  );

  const table = el("table", { className: "matrix-table" });
  const roleKeys = Object.keys(roles);
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: tr("accessArea") }),
        el("th", { text: tr("accessContents") }),
        ...roleKeys.map((key) => el("th", { text: roles[key].label })),
      ]),
    ]),
    el("tbody", {}, sharedTrieRoots.map((root, rootIndex) =>
      el("tr", {}, [
        el("td", { text: projectAreaLabel(root) }),
        el("td", { text: projectContentLabel(root) }),
        ...roleKeys.map((key) => {
          const access = root.visibility[key] || "none";
          const label = accessLabel(access);
          const button = el("button", {
            className: `access-chip ${access}`,
            type: "button",
            "aria-label": `${tr("accessCycle")}: ${roles[key].label}, ${projectAreaLabel(root)} (${label})`,
            text: label,
          });
          button.addEventListener("click", () => cycleRoleAccess(rootIndex, key));
          return el("td", {}, [button]);
        }),
      ]),
    )),
  );
  document.querySelector("#trieMatrix").replaceChildren(table);
}

function renderPhases() {
  document.querySelector("#phasePicker").replaceChildren(
    ...phases.map((phase) => {
      const button = el("button", {
        type: "button",
        className: state.activePhase === phase.id ? "active" : "",
        text: phase.short,
      });
      button.addEventListener("click", () => {
        state.activePhase = phase.id;
        renderPhases();
        renderProjectVisuals();
      });
      return button;
    }),
  );

  const phase = phaseById(phases, state.activePhase);
  document.querySelector("#phaseDetail").replaceChildren(
    el("span", { className: "card-kicker", text: phase.short }),
    el("h3", { text: phase.title }),
    el("p", { text: phase.decision }),
    el("ul", { className: "object-list" }, [
      el("li", {}, [el("span", { text: planningLabels.phaseLabel || "Projektphase" }), el("strong", { text: phase.short })]),
      el("li", {}, [el("span", { text: planningLabels.riskLabel || "Aktuelles Risiko" }), el("strong", { text: phase.risk })]),
      el("li", {}, [el("span", { text: "Assistenz" }), el("strong", { text: "nur Hinweise, keine Freigabe" })]),
    ]),
  );

  document.querySelector("#topicBoard").replaceChildren(
    el("span", { className: "card-kicker", text: "Querschnittsthemen" }),
    el("h3", { text: planningLabels.topicTitle || "Kontinuierliche Projektkontrolle" }),
    el("ul", { className: "topic-list" }, topics.map(([title, text]) => el("li", {}, [el("strong", { text: title }), el("span", { text })]))),
  );
}

function renderFlows() {
  const tabs = document.querySelector("#flowTabs");
  const activeFlow = flowDomains.find((flow) => flow.id === state.activeFlow) ?? flowDomains[0];

  tabs.replaceChildren(
    ...flowDomains.map((flow) => {
      const button = el("button", {
        type: "button",
        className: activeFlow.id === flow.id ? "active" : "",
        text: flow.label,
      });
      button.addEventListener("click", () => {
        state.activeFlow = flow.id;
        renderFlows();
        renderProjectVisuals();
      });
      return button;
    }),
  );

  document.querySelector("#flowDetail").replaceChildren(
    bookTop(activeFlow.label, activeFlow.object),
    el("h3", { text: "Auslöser" }),
    el("p", { text: activeFlow.trigger }),
    el("h3", { text: "Beteiligte Rollen" }),
    el("ul", { className: "flow-chip-list" }, activeFlow.owners.map((owner) => el("li", { text: owner }))),
    el("h3", { text: "Ergebnis" }),
    el("p", { text: activeFlow.output }),
  );

  document.querySelector("#flowSteps").replaceChildren(
    el("span", { className: "card-kicker", text: "Ablauf" }),
    el("ol", { className: "flow-step-list" }, activeFlow.steps.map((step, index) =>
      el("li", {}, [
        el("strong", { text: String(index + 1).padStart(2, "0") }),
        el("span", { text: step }),
      ]),
    )),
  );

  document.querySelector("#flowChecks").replaceChildren(
    el("span", { className: "card-kicker", text: "Prüfpunkte" }),
    el("ul", { className: "topic-list" }, activeFlow.checks.map((check) =>
      el("li", {}, [
        el("strong", { text: check }),
        el("span", { text: planningLabels.flowCheckText || "muss vor Statuswechsel sichtbar sein" }),
      ]),
    )),
  );
}

function dateFromProjectDay(projectStart, day) {
  const start = new Date(`${projectStart || "2026-06-01"}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + Math.round(day));
  return start;
}

function formatProjectDay(day) {
  const locale = state.language === "de" ? "de-DE" : state.language === "fr" ? "fr-FR" : state.language === "es" ? "es-ES" : "en-US";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    dateFromProjectDay(projectSchedule.projectStart, day),
  );
}

function taskLabel(taskById, taskId) {
  return taskById.get(taskId)?.label || taskId;
}

function dependencySentence(dependency, taskById) {
  const predecessor = taskLabel(taskById, dependency.from);
  const lagText = dependency.lagDays === 0
    ? ""
    : dependency.lagDays > 0
      ? ` mit ${dependency.lagDays} Tagen Abstand`
      : ` mit ${Math.abs(dependency.lagDays)} Tagen Überlappung`;

  const dependencyTypeText = {
    FS: `startet nach Abschluss von ${predecessor}${lagText}`,
    SS: `startet parallel zu ${predecessor}${lagText}`,
    FF: `muss zusammen mit ${predecessor} fertig werden${lagText}`,
    SF: `kann erst fertig werden, wenn ${predecessor} startet${lagText}`,
  };

  return dependencyTypeText[dependency.type] || `hängt von ${predecessor}${lagText} ab`;
}

function renderScheduleBoard() {
  const root = document.querySelector("#scheduleBoard");
  if (!root) return;

  let update;
  try {
    update = createProjectScheduleStateDagUpdate(projectSchedule, { managedTaskId: managedScheduleTaskId() });
  } catch (error) {
    root.replaceChildren(
      el("article", { className: "schedule-card schedule-error" }, [
        bookTop("Terminsteuerung", conciseProjectRef()),
        el("h3", { text: "Terminplan blockiert" }),
        el("p", { text: error.message }),
      ]),
    );
    return;
  }

  const plan = update.schedule;
  const taskById = new Map(plan.tasks.map((task) => [task.id, task]));
  const criticalLabels = plan.criticalPath.map((taskId) => taskLabel(taskById, taskId)).join(" -> ");
  const finish = formatProjectDay(plan.projectFinishDay);
  const managedTask = taskById.get(managedScheduleTaskId()) || plan.tasks.find((task) => task.isCritical) || plan.tasks[0];
  const managedSuccessors = plan.dependencies
    .filter((dependency) => dependency.from === managedTask?.id)
    .map((dependency) => taskLabel(taskById, dependency.to));
  const bufferTask = plan.tasks
    .filter((task) => !task.isCritical)
    .sort((left, right) => right.totalFloat - left.totalFloat)[0];

  const table = el("table", { className: "matrix-table schedule-table" });
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Aufgabe" }),
        el("th", { text: "Start" }),
        el("th", { text: "Fertig" }),
        el("th", { text: "Spätstart" }),
        el("th", { text: "Spät fertig" }),
        el("th", { text: "Puffer" }),
      ]),
    ]),
    el("tbody", {}, plan.tasks.map((task) =>
      el("tr", { className: task.isCritical ? "critical" : "" }, [
        el("td", {}, [
          el("strong", { text: task.label || task.id }),
          el("span", { text: `${task.phase || "-"} · ${task.owner || "-"} · ${task.durationDays}d` }),
        ]),
        el("td", { text: formatProjectDay(task.earlyStart) }),
        el("td", { text: formatProjectDay(task.earlyFinish) }),
        el("td", { text: formatProjectDay(task.lateStart) }),
        el("td", { text: formatProjectDay(task.lateFinish) }),
        el("td", {}, [el("span", { className: task.isCritical ? "access-chip full" : "access-chip", text: `${task.totalFloat}d` })]),
      ]),
    )),
  );

  root.replaceChildren(
    el("article", { className: "schedule-card schedule-summary" }, [
      bookTop("Terminsteuerung", conciseProjectRef()),
      el("ul", { className: "object-list compact-list" }, [
        el("li", {}, [el("span", { text: "Projektstart" }), el("strong", { text: formatProjectDay(0) })]),
        el("li", {}, [el("span", { text: "Projektende" }), el("strong", { text: finish })]),
        el("li", {}, [el("span", { text: "Kritische Aufgaben" }), el("strong", { text: `${plan.criticalPath.length}` })]),
      ]),
      el("h3", { text: "Was den Projekttermin bestimmt" }),
      el("p", { text: criticalLabels || "-" }),
    ]),
    el("article", { className: "schedule-card schedule-decision" }, [
      bookTop("Nächste Entscheidung", managedTask?.phase || "Projekt"),
      el("h3", { text: managedTask?.label || "Freigabe klären" }),
      el("p", {
        text: managedTask?.isCritical
          ? `Wenn diese Freigabe rutscht, verschieben sich ${managedSuccessors.slice(0, 3).join(", ") || "die Folgeaufgaben"} mit.`
          : "Diese Aufgabe hat Puffer, sollte aber vor der nächsten Freigabe sichtbar entschieden sein.",
      }),
      el("ul", { className: "object-list compact-list" }, [
        el("li", {}, [el("span", { text: "Zieltermin" }), el("strong", { text: formatProjectDay(managedTask?.earlyFinish || 0) })]),
        el("li", {}, [el("span", { text: "Puffer" }), el("strong", { text: `${managedTask?.totalFloat || 0}d` })]),
        el("li", {}, [el("span", { text: "Verantwortung" }), el("strong", { text: managedTask?.owner || "-" })]),
      ]),
    ]),
    el("article", { className: "schedule-card schedule-tasks" }, [
      bookTop("Terminplan", `${formatProjectDay(0)} -> ${finish}`),
      el("div", { className: "preview-table-wrap" }, [table]),
    ]),
    el("article", { className: "schedule-card schedule-links" }, [
      bookTop("Abhängigkeiten", "projektbezogen"),
      el("ul", { className: "topic-list" }, plan.dependencies.map((dependency) =>
        el("li", {}, [
          el("strong", { text: taskLabel(taskById, dependency.to) }),
          el("span", { text: dependencySentence(dependency, taskById) }),
        ]),
      )),
    ]),
    ...(bufferTask ? [el("article", { className: "schedule-card schedule-buffer" }, [
      bookTop("Puffer", bufferTask.phase || "Projekt"),
      el("h3", { text: bufferTask.label }),
      el("p", { text: "Diese Aufgabe ist nicht terminbestimmend, bleibt aber ein sichtbarer Risikopunkt für Finanzierung und Freigaben." }),
      el("ul", { className: "object-list compact-list" }, [
        el("li", {}, [el("span", { text: "Frühestens fertig" }), el("strong", { text: formatProjectDay(bufferTask.earlyFinish) })]),
        el("li", {}, [el("span", { text: "Spätestens fertig" }), el("strong", { text: formatProjectDay(bufferTask.lateFinish) })]),
        el("li", {}, [el("span", { text: "Puffer" }), el("strong", { text: `${bufferTask.totalFloat}d` })]),
      ]),
    ])] : []),
  );
}

function activeProjectVisualType() {
  return projectVisualTypes.find(([id]) => id === state.activeProjectVisual)?.[0] || projectVisualTypes[0][0];
}

function projectPhaseNumber(value) {
  const match = String(value || "").match(/LP(\d)/i);
  return match ? Number(match[1]) : 99;
}

function projectVisualHeader(title, ref, text = "") {
  return el("div", { className: "visual-head" }, [
    el("div", {}, [
      el("span", { className: "card-kicker", text: title }),
      el("h3", { text: ref }),
      text ? el("p", { text }) : el("p", { text: "" }),
    ]),
    el("div", { className: "visual-tabs", role: "tablist", "aria-label": "Projektvisualisierung auswählen" }, projectVisualTypes.map(([id, label, hint]) => {
      const button = el("button", {
        type: "button",
        role: "tab",
        className: activeProjectVisualType() === id ? "active" : "",
        "aria-selected": activeProjectVisualType() === id ? "true" : "false",
        "data-project-visual": id,
      }, [
        el("strong", { text: label }),
        el("span", { text: hint }),
      ]);
      button.addEventListener("click", () => {
        state.activeProjectVisual = id;
        renderProjectVisuals();
      });
      return button;
    })),
  ]);
}

function renderGanttVisual(plan) {
  const maxDay = Math.max(1, plan.projectFinishDay);
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round((maxDay / 4) * index));
  return el("div", { className: "gantt-visual" }, [
    el("div", { className: "gantt-axis" }, [
      el("span", { className: "gantt-axis-label", text: "Aufgabe" }),
      el("div", { className: "gantt-axis-track" }, ticks.map((day) =>
        el("span", { style: `left: ${(day / maxDay) * 100}%`, text: formatProjectDay(day) }),
      )),
    ]),
    ...plan.tasks.map((task) => {
      const left = Math.max(0, (task.earlyStart / maxDay) * 100);
      const width = Math.max(3, ((task.earlyFinish - task.earlyStart) / maxDay) * 100);
      return el("div", { className: "gantt-row" }, [
        el("div", { className: "gantt-label" }, [
          el("strong", { text: task.label || task.id }),
          el("span", { text: `${task.phase || "-"} · ${task.owner || "-"}` }),
        ]),
        el("div", { className: "gantt-track" }, [
          el("span", {
            className: task.isCritical ? "gantt-bar critical" : "gantt-bar",
            style: `left: ${left}%; width: ${width}%`,
            title: `${formatProjectDay(task.earlyStart)} - ${formatProjectDay(task.earlyFinish)}`,
          }, [
            el("em", { text: `${task.durationDays}d` }),
          ]),
        ]),
      ]);
    }),
  ]);
}

function kanbanColumnForTask(task) {
  const activePhase = projectPhaseNumber(state.activePhase);
  const taskPhase = projectPhaseNumber(task.phase);
  if (taskPhase < activePhase) return "done";
  if (task.isCritical && taskPhase === activePhase) return "review";
  if (taskPhase === activePhase) return "doing";
  return "ready";
}

function renderKanbanVisual(plan) {
  const columns = [
    ["done", "Erledigt"],
    ["doing", "In Arbeit"],
    ["review", "Freigabe"],
    ["ready", "Bereit"],
  ];
  const grouped = new Map(columns.map(([id]) => [id, []]));
  plan.tasks.forEach((task) => grouped.get(kanbanColumnForTask(task)).push(task));

  return el("div", { className: "kanban-visual" }, columns.map(([id, label]) =>
    el("section", { className: "kanban-column" }, [
      el("header", {}, [
        el("strong", { text: label }),
        el("span", { text: String(grouped.get(id).length) }),
      ]),
      el("div", { className: "kanban-cards" }, grouped.get(id).map((task) =>
        el("article", { className: task.isCritical ? "kanban-card critical" : "kanban-card" }, [
          el("strong", { text: task.label || task.id }),
          el("span", { text: `${task.phase || "-"} · ${task.owner || "-"}` }),
          el("small", { text: `${formatProjectDay(task.earlyStart)} -> ${formatProjectDay(task.earlyFinish)}` }),
        ]),
      )),
    ]),
  ));
}

function renderPertVisual(plan) {
  const taskById = new Map(plan.tasks.map((task) => [task.id, task]));
  return el("div", { className: "pert-visual" }, [
    el("div", { className: "pert-network" }, plan.tasks.map((task, index) =>
      el("article", { className: task.isCritical ? "pert-node critical" : "pert-node" }, [
        el("span", { text: String(index + 1).padStart(2, "0") }),
        el("strong", { text: task.label || task.id }),
        el("small", { text: `${formatProjectDay(task.earlyStart)} - ${formatProjectDay(task.earlyFinish)}` }),
      ]),
    )),
    el("ul", { className: "dependency-list" }, plan.dependencies.map((dependency) =>
      el("li", {}, [
        el("strong", { text: taskLabel(taskById, dependency.from) }),
        el("span", { text: `${dependency.type}${dependency.lagDays ? ` ${dependency.lagDays}d` : ""}` }),
        el("strong", { text: taskLabel(taskById, dependency.to) }),
      ]),
    )),
  ]);
}

function burnSeries(plan) {
  const totalWork = plan.tasks.reduce((sum, task) => sum + task.durationDays, 0);
  const maxDay = Math.max(1, plan.projectFinishDay);
  const step = Math.max(1, Math.ceil(maxDay / 6));
  const days = Array.from(new Set([0, ...Array.from({ length: 6 }, (_, index) => Math.min(maxDay, (index + 1) * step)), maxDay]));
  const completed = days.map((day) =>
    plan.tasks.reduce((sum, task) => sum + (task.earlyFinish <= day ? task.durationDays : 0), 0),
  );
  const remaining = completed.map((value) => Math.max(0, totalWork - value));
  const idealRemaining = days.map((day) => Math.max(0, totalWork * (1 - day / maxDay)));
  return { days, completed, remaining, idealRemaining, totalWork, maxDay };
}

function chartPoints(values, maxValue, width, height, padding, days, maxDay) {
  return values.map((value, index) => {
    const x = padding + (days[index] / maxDay) * (width - padding * 2);
    const y = height - padding - (value / Math.max(1, maxValue)) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function renderBurnVisual(plan) {
  const series = burnSeries(plan);
  const width = 720;
  const height = 260;
  const padding = 34;
  const maxValue = series.totalWork;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Burnup und Burndown Chart" }, [
    svgEl("line", { x1: padding, y1: height - padding, x2: width - padding, y2: height - padding, class: "chart-axis" }),
    svgEl("line", { x1: padding, y1: padding, x2: padding, y2: height - padding, class: "chart-axis" }),
    svgEl("polyline", {
      points: chartPoints(series.idealRemaining, maxValue, width, height, padding, series.days, series.maxDay),
      class: "burn-line ideal",
    }),
    svgEl("polyline", {
      points: chartPoints(series.remaining, maxValue, width, height, padding, series.days, series.maxDay),
      class: "burn-line down",
    }),
    svgEl("polyline", {
      points: chartPoints(series.completed, maxValue, width, height, padding, series.days, series.maxDay),
      class: "burn-line up",
    }),
  ]);

  return el("div", { className: "burn-visual" }, [
    el("div", { className: "burn-chart" }, [svg]),
    el("ul", { className: "burn-legend" }, [
      el("li", {}, [el("span", { className: "legend-line up" }), el("strong", { text: "Burnup" }), el("small", { text: `${Math.max(...series.completed)}d erledigt` })]),
      el("li", {}, [el("span", { className: "legend-line down" }), el("strong", { text: "Burndown" }), el("small", { text: `${series.remaining.at(-1)}d offen` })]),
      el("li", {}, [el("span", { className: "legend-line ideal" }), el("strong", { text: "Ideal" }), el("small", { text: "lineare Referenz" })]),
    ]),
  ]);
}

function renderWbsVisual(plan) {
  const groups = new Map();
  plan.tasks.forEach((task) => {
    const phase = task.phase || "Projekt";
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase).push(task);
  });
  return el("div", { className: "wbs-visual" }, [
    el("article", { className: "wbs-root" }, [
      el("span", { className: "card-kicker", text: demoProject.id || "project" }),
      el("strong", { text: conciseProjectRef() }),
    ]),
    el("div", { className: "wbs-branches" }, [...groups.entries()].map(([phase, tasks]) =>
      el("section", { className: "wbs-branch" }, [
        el("header", {}, [
          el("strong", { text: phase }),
          el("span", { text: `${tasks.length} Arbeitspakete` }),
        ]),
        el("ul", {}, tasks.map((task) =>
          el("li", {}, [
            el("strong", { text: task.label || task.id }),
            el("span", { text: task.owner || "-" }),
          ]),
        )),
      ]),
    )),
  ]);
}

function renderFlowchartVisual() {
  const activeFlow = flowDomains.find((flow) => flow.id === state.activeFlow) ?? flowDomains[0];
  if (!activeFlow) return el("p", { text: "Kein Flow verfügbar." });
  return el("div", { className: "flowchart-visual" }, [
    el("article", { className: "flowchart-trigger" }, [
      el("span", { className: "card-kicker", text: "Start" }),
      el("strong", { text: activeFlow.trigger }),
    ]),
    ...activeFlow.steps.map((step, index) =>
      el("article", { className: "flowchart-step" }, [
        el("span", { text: String(index + 1).padStart(2, "0") }),
        el("strong", { text: step }),
      ]),
    ),
    el("article", { className: "flowchart-output" }, [
      el("span", { className: "card-kicker", text: "Ergebnis" }),
      el("strong", { text: activeFlow.output }),
    ]),
  ]);
}

function renderActiveProjectVisual(plan) {
  const type = activeProjectVisualType();
  if (type === "kanban") return renderKanbanVisual(plan);
  if (type === "pert") return renderPertVisual(plan);
  if (type === "burn") return renderBurnVisual(plan);
  if (type === "wbs") return renderWbsVisual(plan);
  if (type === "flowchart") return renderFlowchartVisual(plan);
  return renderGanttVisual(plan);
}

function renderProjectVisuals() {
  const root = document.querySelector("#projectVisuals");
  if (!root) return;

  let update;
  try {
    update = createProjectScheduleStateDagUpdate(projectSchedule, { managedTaskId: managedScheduleTaskId() });
  } catch (error) {
    root.replaceChildren(
      el("article", { className: "visual-card schedule-error" }, [
        bookTop("Projektvisualisierungen", conciseProjectRef()),
        el("h3", { text: "Visualisierung blockiert" }),
        el("p", { text: error.message }),
      ]),
    );
    return;
  }

  const plan = update.schedule;
  root.replaceChildren(
    el("article", { className: "visual-card" }, [
      projectVisualHeader("Projektvisualisierungen", conciseProjectRef(), "Generische Komponenten für Planung, Steuerung und Fortschritt."),
      renderActiveProjectVisual(plan),
    ]),
  );
}

function formatEditorContentKind(kind) {
  const labels = {
    "agent-draft": "Assistenzentwurf",
    brief: "Vorlage",
    document: "Dokument",
    knowledge: "Projektwissen",
    outline: "Gliederung",
    proposal: "Angebot",
    schedule: "Terminstand",
  };
  return labels[kind] || kind;
}

function renderEditorBoard() {
  const root = document.querySelector("#editorBoard");
  if (!root) return;

  let workbench;
  try {
    workbench = createProjectEditorWorkbench(demoProject.id || "project");
  } catch (error) {
    root.replaceChildren(
      el("article", { className: "editor-card editor-error" }, [
        bookTop("Inhalte erstellen", conciseProjectRef()),
        el("h3", { text: "Editoren nicht bereit" }),
        el("p", { text: error.message }),
      ]),
    );
    return;
  }

  root.replaceChildren(
    el("article", { className: "editor-card editor-summary" }, [
      bookTop("Inhalte erstellen", conciseProjectRef()),
      el("h3", { text: "Projektunterlagen aus Struktur und Quellen" }),
      el("p", { text: "Reaktor strukturiert Entscheidungen und offene Punkte; VGER setzt daraus quellengebundene Unterlagen zusammen." }),
      el("ul", { className: "editor-counts" }, [
        el("li", {}, [el("span", { text: "Editoren" }), el("strong", { text: `${workbench.registry.editors.length}` })]),
        el("li", {}, [el("span", { text: "Übergaben" }), el("strong", { text: `${workbench.handoffs.length}` })]),
        el("li", {}, [el("span", { text: "Gemeinsame Kerne" }), el("strong", { text: `${workbench.alignmentModules.length}` })]),
      ]),
    ]),
    ...workbench.registry.editors.map((editor) =>
      el("article", { className: "editor-card" }, [
        bookTop(editor.label, editor.workspace === "reaktor" ? "Gliederung" : "Dokumente"),
        el("h3", { text: editor.purpose }),
        el("dl", { className: "editor-meta" }, [
          el("div", {}, [
            el("dt", { text: "Nimmt auf" }),
            el("dd", { text: editor.accepts.map(formatEditorContentKind).join(", ") }),
          ]),
          el("div", {}, [
            el("dt", { text: "Erzeugt" }),
            el("dd", { text: editor.produces.map(formatEditorContentKind).join(", ") }),
          ]),
        ]),
      ]),
    ),
    el("article", { className: "editor-card editor-handoffs" }, [
      bookTop("Nächste Übergaben", "LP3 / LP4"),
      el("ul", { className: "topic-list" }, workbench.handoffs.map((handoff) =>
        el("li", {}, [
          el("strong", { text: handoff.title }),
          el("span", { text: `${handoff.phase || "Projekt"} · ${formatEditorContentKind(handoff.expectedOutput)}` }),
        ]),
      )),
    ]),
  );
}

function renderAI() {
  document.querySelector("#goalBook").replaceChildren(
    bookTop(ai.goal.type, ai.goal.ref),
    el("h3", { text: "Ziel" }),
    el("p", { text: ai.goal.objective }),
    el("h3", { text: "Warum" }),
    el("p", { text: ai.goal.why }),
    el("ul", { className: "run-steps" }, ai.goal.criteria.map((criterion) => el("li", {}, [el("span", { text: criterion }), el("strong", { text: "Kriterium" })]))),
  );

  document.querySelector("#workloadBook").replaceChildren(
    bookTop(ai.workload.type, ai.workload.ref),
    el("h3", { text: "Gelesene Bereiche" }),
    el("ul", { className: "run-steps" }, ai.workload.context.map((item) => el("li", {}, [el("span", { text: item }), el("strong", { text: "Trie-Leseast" })]))),
    el("h3", { text: "Bereich für Vorschläge" }),
    el("ul", { className: "run-steps" }, ai.workload.mutable.map((item) => el("li", {}, [el("span", { text: item }), el("strong", { text: "Vorschlag" })]))),
    el("p", { text: ai.workload.handoff }),
  );

  document.querySelector("#runBook").replaceChildren(
    bookTop(ai.run.type, ai.run.ref),
    el("h3", { text: "Aktueller Prüflauf" }),
    el("p", { text: "Dieser Prüflauf zeigt, welche Quellen gelesen wurden, was gefunden wurde und wo eine menschliche Entscheidung nötig ist." }),
    el("ul", { className: "run-steps" }, ai.run.steps.map(([kind, text], index) => {
      const itemState = index < state.runStep ? "done" : index === state.runStep ? "active" : "";
      return el("li", { className: itemState }, [el("span", { text }), el("strong", { text: kind })]);
    })),
  );
}

function renderProjectSourceSummary() {
  const root = document.querySelector("#projectSourceSummary");
  if (!root) return;

  const summary = summarizeProjectFileIndex(projectSource);
  const files = projectSource.index.files.slice(0, 4);

  root.replaceChildren(
    bookTop(projectSource.source.$type$, `${summary.branch}@${summary.head}`),
    el("h3", { text: tr("sourceBundleTitle") }),
    el("p", { text: tr("sourceBundleText") }),
    el("ul", { className: "object-list compact-list" }, [
      el("li", {}, [el("span", { text: tr("sourceAdapter") }), el("strong", { text: summary.adapter })]),
      el("li", {}, [el("span", { text: tr("sourceBranch") }), el("strong", { text: summary.branch })]),
      el("li", {}, [el("span", { text: tr("sourceHead") }), el("strong", { text: summary.head })]),
      el("li", {}, [el("span", { text: tr("sourceFiles") }), el("strong", { text: String(summary.totalFiles) })]),
      el("li", {}, [el("span", { text: tr("sourceDirty") }), el("strong", { text: String(summary.dirtyFiles) })]),
      el("li", {}, [el("span", { text: tr("sourceIgnored") }), el("strong", { text: String(summary.ignoredPaths) })]),
    ]),
    el("ul", { className: "topic-list" }, files.map((file) =>
      el("li", {}, [
        el("strong", { text: file.label || file.path }),
        el("span", { text: `${file.status} · ${file.kind}` }),
      ]),
    )),
  );
}

function renderData() {
  const fileDrop = document.querySelector(".file-drop");
  fileDrop.querySelector("strong").textContent = tr("importPick");
  fileDrop.querySelector("span").textContent = tr("importHint");

  const statusText = {
    idle: state.importFileName ? `${state.importFileName} ${tr("importReady")}` : tr("noImportFile"),
    preview: tr("importPreview"),
    imported: tr("imported"),
  }[state.importStatus];

  document.querySelector("#importStatus").replaceChildren(
    el("ul", { className: "object-list compact-list" }, [
      el("li", {}, [el("span", { text: tr("status") }), el("strong", { text: statusText })]),
      el("li", {}, [el("span", { text: tr("parser") }), el("strong", { text: "Tabellenimport" })]),
      el("li", {}, [el("span", { text: tr("importSource") }), el("strong", { text: dataImportModel.source })]),
    ]),
  );

  document.querySelector("#importPreview").replaceChildren(
    bookTop(dataImportModel.type, projectRef()),
    el("h3", { text: tr("dataPreviewTitle") }),
    el("p", { text: tr("dataPreviewText") }),
    el("ul", { className: "topic-list" }, dataImportModel.workbookSheets.map(([sheet, object, count, purpose]) =>
      el("li", {}, [
        el("strong", { text: `${sheet} · ${count}` }),
        el("span", { text: `${object} · ${purpose}` }),
      ]),
    )),
    el("div", { className: "preview-table-wrap" }, [renderPreviewTable()]),
  );

  document.querySelector("#exportSummary").replaceChildren(
    bookTop(exportBundleModel.type, projectRef()),
    el("h3", { text: tr("exportBundleTitle") }),
    el("p", { text: tr("exportBundleText") }),
    el("ul", { className: "topic-list" }, exportBundleModel.sections.map(([section, purpose]) =>
      el("li", {}, [
        el("strong", { text: section }),
        el("span", { text: purpose }),
      ]),
    )),
    el("ul", { className: "object-list warning-list" }, exportBundleModel.warnings.map((warning) =>
      el("li", {}, [el("span", { text: warning }), el("strong", { text: "Hinweis" })]),
    )),
  );

  renderProjectSourceSummary();
  renderProjectTableBoard();
  renderDatasetCreatorBoard();
}

function renderDatasetCreatorBoard() {
  const root = document.querySelector("#datasetCreatorBoard");
  if (!root) return;

  const activePlanId = demoDatasetCreator.plan?.id || datasetPlans[0]?.id;
  const evidence = demoDatasetCreator.plannerEvidence;
  const skill = demoDatasetCreator.skill || DEMO_DATASET_CREATOR_SKILL;

  root.replaceChildren(
    el("article", { className: "dataset-skill-card" }, [
      bookTop("Skill", skill.skillId || "projektor.demo-dataset-creator"),
      el("h3", { text: skill.label || "Demo Dataset Creator" }),
      el("p", { text: "Erzeugt vollstaendige Projektgraphen mit Rollen, Datenbereichen, Terminplan, Quellen, Assistenzlauf und Journal." }),
      el("ul", { className: "object-list compact-list" }, [
        el("li", {}, [el("span", { text: "Status" }), el("strong", { text: state.datasetCreatorStatus })]),
        el("li", {}, [el("span", { text: "Plan" }), el("strong", { text: demoDatasetCreator.plan?.label || "-" })]),
        el("li", {}, [el("span", { text: "SkillContracts" }), el("strong", { text: evidence?.skillContracts?.join(", ") || skill.capability?.capabilityId || "-" })]),
        el("li", {}, [el("span", { text: "Kritischer Pfad" }), el("strong", { text: evidence?.criticalPath?.length ? `${evidence.criticalPath.length} Aufgaben` : "validiert" })]),
      ]),
    ]),
    el("div", { className: "dataset-plan-grid" }, datasetPlans.map((plan) =>
      el("article", { className: `dataset-plan-card ${activePlanId === plan.id ? "active" : ""}` }, [
        bookTop(plan.density, plan.id),
        el("h3", { text: plan.label }),
        el("p", { text: plan.scenario }),
        el("ul", { className: "object-list compact-list" }, [
          el("li", {}, [el("span", { text: "Kontakte" }), el("strong", { text: String(plan.scale.contacts) })]),
          el("li", {}, [el("span", { text: "Datenbereiche" }), el("strong", { text: String(plan.scale.trieRoots) })]),
          el("li", {}, [el("span", { text: "Aufgaben" }), el("strong", { text: String(plan.scale.tasks) })]),
          el("li", {}, [el("span", { text: "Risiko" }), el("strong", { text: plan.risk })]),
        ]),
        el("div", { className: "settings-actions dataset-actions" }, [
          el("button", { className: "primary-action", type: "button", "data-dataset-plan": plan.id, text: "Plan anwenden" }),
          el("button", { className: "secondary-action", type: "button", "data-dataset-export": plan.id, text: "Plan exportieren" }),
        ]),
      ]),
    )),
  );
}

function activeProjectTableType() {
  return PROJECT_DAG_TABLE_VIEWS.find(([id]) => id === state.activeTableView)?.[0] || PROJECT_DAG_TABLE_VIEWS[0][0];
}

function managedScheduleTaskId() {
  return projectSchedule.tasks?.some((task) => task.id === "entwurf")
    ? "entwurf"
    : projectSchedule.tasks?.[0]?.id || "fallback";
}

function createActiveProjectTableProjection() {
  let update;
  try {
    update = createProjectScheduleStateDagUpdate(projectSchedule, { managedTaskId: managedScheduleTaskId() });
  } catch {
    update = createProjectScheduleStateDagUpdate({
      projectId: demoProject.id || "project",
      projectStart: projectSchedule.projectStart,
      tasks: [{ id: "fallback", label: "Fallback", durationDays: 0 }],
      dependencies: [],
    }, { managedTaskId: "fallback" });
  }

  return createProjectDagExcelProjection(update, {
    projectId: demoProject.id || update.schedule.projectId || "project",
    title: projectRef(),
    activePhaseId: state.activePhase,
    roles,
    sharedTrieRoots,
    importModel: dataImportModel,
    exportModel: exportBundleModel,
    journalRows: journalBase.length + state.journalExtra,
  });
}

function renderProjectTable(sheet) {
  const table = el("table", { className: "matrix-table project-sheet-table" });
  table.append(
    el("thead", {}, [
      el("tr", {}, sheet.columns.map(([, label, type]) => el("th", { "data-column-type": type, text: label }))),
    ]),
    el("tbody", {}, sheet.rows.map((row) =>
      el("tr", {}, sheet.columns.map(([key, , type]) =>
        el("td", { "data-column-type": type, text: row[key] == null ? "" : String(row[key]) }),
      )),
    )),
  );
  return table;
}

function renderProjectTableBoard() {
  const root = document.querySelector("#projectTableBoard");
  if (!root) return;

  const projection = createActiveProjectTableProjection();
  const activeType = activeProjectTableType();
  const sheet = getProjectDagExcelSheet(projection, activeType);

  root.replaceChildren(
    el("article", { className: "project-table-card" }, [
      el("div", { className: "project-table-head" }, [
        bookTop("Tabellenansicht", sheet.ref),
        el("div", { className: "table-actions" }, [
          el("button", { className: "secondary-action", id: "downloadActiveTable", type: "button", text: "CSV" }),
        ]),
      ]),
      el("div", { className: "table-tabs", role: "tablist", "aria-label": "Projekt-Tabelle auswählen" }, PROJECT_DAG_TABLE_VIEWS.map(([id, label, ref]) => {
        const button = el("button", {
          type: "button",
          role: "tab",
          className: activeType === id ? "active" : "",
          "aria-selected": activeType === id ? "true" : "false",
          "data-project-table": id,
        }, [
          el("strong", { text: label }),
          el("span", { text: ref }),
        ]);
        button.addEventListener("click", () => {
          state.activeTableView = id;
          renderProjectTableBoard();
        });
        return button;
      })),
      el("div", { className: "sheet-summary" }, [
        el("h3", { text: sheet.title }),
        el("ul", { className: "object-list compact-list" }, [
          el("li", {}, [el("span", { text: "Zeilen" }), el("strong", { text: String(sheet.rows.length) })]),
          el("li", {}, [el("span", { text: "Spalten" }), el("strong", { text: String(sheet.columns.length) })]),
          el("li", {}, [el("span", { text: "Quelle" }), el("strong", { text: sheet.ref })]),
          el("li", {}, [el("span", { text: "ONE Objekt" }), el("strong", { text: projection.projection.$type$ })]),
        ]),
      ]),
      el("div", { className: "preview-table-wrap project-sheet-wrap" }, [renderProjectTable(sheet)]),
    ]),
  );
}

function formatEuro(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);
}

function renderNgoMetric(value, label, text, metricId) {
  return el("button", { className: "metric ngo-metric", type: "button", "data-ngo-metric": metricId }, [
    el("span", { className: "card-kicker", text: label }),
    el("strong", { text: value }),
    el("p", { text }),
  ]);
}

const ngoMetricFilters = {
  supporters: { view: "donors", label: "Unterstützer" },
  received: { view: "donors", label: "Gesamt eingenommen", donorSort: "sum" },
  openThanks: { view: "donors", label: "Noch zu bedanken", donorOnlyOpen: true },
  members: { view: "donors", label: "Mitglieder", donorFilter: "members" },
  recurring: { view: "donors", label: "Dauerspender", donorFilter: "recurring" },
  participants: { view: "participants", label: "Teilnehmerinnen" },
  averageAge: { view: "participants", label: "Ø Alter" },
  withChildren: { view: "participants", label: "Mit Kindern", participantFilter: "children" },
  germanCourse: { view: "participants", label: "Im Deutschkurs", participantFilter: "germanCourse" },
  visaOpen: { view: "participants", label: "Visum-Fristen offen", participantFilter: "visaOpen", participantSort: "visa" },
};

function applyNgoMetricFilter(metricId) {
  const filter = ngoMetricFilters[metricId];
  if (!filter) return;
  state.ngoMetricFilter = { id: metricId, ...filter };
  state.activeNgoView = filter.view;
  state.donorSearch = "";
  state.participantSearch = "";
  state.donorOnlyOpen = Boolean(filter.donorOnlyOpen);
  if (filter.donorSort) state.donorSort = filter.donorSort;
  if (filter.participantSort) state.participantSort = filter.participantSort;
  renderNgo();
  document.querySelector("#ngoBoard")?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function clearNgoMetricFilter() {
  state.ngoMetricFilter = null;
}

function activeNgoMetricFilterLabel(view) {
  const filter = state.ngoMetricFilter;
  return filter?.view === view ? filter.label : "";
}

function filterNgoDonorRows(rows) {
  const filter = state.ngoMetricFilter;
  if (filter?.view !== "donors") return rows;
  if (filter.donorFilter === "members") return rows.filter((donor) => donor.isMember);
  if (filter.donorFilter === "recurring") return rows.filter((donor) => donor.recurringDonor);
  return rows;
}

function filterNgoParticipantRows(rows) {
  const filter = state.ngoMetricFilter;
  if (filter?.view !== "participants") return rows;
  if (filter.participantFilter === "children") return rows.filter((participant) => participant.hasChildren);
  if (filter.participantFilter === "germanCourse") return rows.filter((participant) => participant.germanCourseStatus === "läuft");
  if (filter.participantFilter === "visaOpen") return rows.filter((participant) => participant.visaWarning);
  return rows;
}

function renderNgoMetricEvidence(view) {
  const label = activeNgoMetricFilterLabel(view);
  if (!label) return null;
  return el("div", { className: "ngo-active-filter" }, [
    el("span", { text: `Herkunft: ${label}` }),
    el("button", { className: "secondary-action", type: "button", "data-ngo-action": "clear-metric-filter", text: "Alle anzeigen" }),
  ]);
}

function renderNgoTabs() {
  return el("div", { className: "ngo-tabs", role: "tablist", "aria-label": "NGO Bereich auswählen" }, [
    ["donors", "Spender", "Beiträge, Dank, Quittungen"],
    ["participants", "Teilnehmerinnen", "Programm, Visum, Bildung"],
  ].map(([id, label, hint]) =>
    el("button", {
      type: "button",
      role: "tab",
      className: state.activeNgoView === id ? "active" : "",
      "aria-selected": state.activeNgoView === id ? "true" : "false",
      "data-ngo-view": id,
    }, [
      el("strong", { text: label }),
      el("span", { text: hint }),
    ]),
  ));
}

function renderNgoDonorControls() {
  const search = el("input", {
    id: "ngoDonorSearch",
    type: "search",
    placeholder: "Suchen",
    autocomplete: "off",
    value: state.donorSearch,
  });
  search.value = state.donorSearch;
  const sort = el("select", { id: "ngoDonorSort" }, [
    ["open", "offene zuerst"],
    ["name", "Name"],
    ["sum", "Summe"],
    ["last", "zuletzt"],
  ].map(([value, label]) => {
    const option = el("option", { value, text: label });
    option.selected = state.donorSort === value;
    return option;
  }));
  const onlyOpen = el("input", { id: "ngoDonorOnlyOpen", type: "checkbox" });
  onlyOpen.checked = state.donorOnlyOpen;

  const quickName = el("input", { id: "ngoDonorName", type: "text", placeholder: "Name", autocomplete: "off" });
  const quickMember = el("input", { id: "ngoDonorIsMember", type: "checkbox" });

  return el("div", { className: "ngo-controls" }, [
    el("label", {}, [el("span", { text: "Suchen" }), search]),
    el("label", {}, [el("span", { text: "Sortieren" }), sort]),
    el("label", { className: "check-label ngo-check" }, [onlyOpen, el("span", { text: "Nur offene" })]),
    el("div", { className: "ngo-quick-entry" }, [
      el("span", { className: "card-kicker", text: "Schnelleingabe" }),
      quickName,
      el("label", { className: "check-label ngo-check" }, [quickMember, el("span", { text: "Ist Mitglied" })]),
      el("button", { className: "secondary-action", type: "button", "data-ngo-action": "add-donor", text: "Anlegen" }),
    ]),
    el("div", { className: "ngo-export-actions" }, [
      el("button", { className: "secondary-action", type: "button", "data-ngo-action": "export-people", text: "Export Personen" }),
      el("button", { className: "secondary-action", type: "button", "data-ngo-action": "export-donations", text: "Export Einzelspenden" }),
    ]),
  ]);
}

function renderNgoDonorTable(rows, selectedDonorId = "") {
  const table = el("table", { className: "matrix-table ngo-table" });
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "" }),
        el("th", { text: "Name" }),
        el("th", { text: "Gesamt" }),
        el("th", { text: "Einträge" }),
        el("th", { text: "Erste Spende" }),
        el("th", { text: "Letzte Spende" }),
        el("th", { text: "Größte" }),
        el("th", { text: "Offen" }),
      ]),
    ]),
    el("tbody", {}, rows.map((donor, index) =>
      el("tr", { className: donor.id === selectedDonorId || (!selectedDonorId && index === 0) ? "selected-row" : "" }, [
        el("td", {}, [
          el("button", {
            className: "icon-action ngo-add-donation",
            type: "button",
            title: "Spende hinzufügen",
            "aria-label": `Spende für ${donor.name} hinzufügen`,
            "data-ngo-donor-add": donor.id,
            text: "+",
          }),
        ]),
        el("td", {}, [
          el("button", { className: "link-action", type: "button", "data-ngo-donor-select": donor.id }, [
            el("strong", { text: donor.name }),
            el("span", { text: donor.isMember ? "Mitglied" : "Spender" }),
          ]),
        ]),
        el("td", { text: formatEuro(donor.totalAmount) }),
        el("td", { text: String(donor.entryCount) }),
        el("td", { text: donor.firstDonationDate || "-" }),
        el("td", { text: donor.lastDonationDate || "-" }),
        el("td", { text: formatEuro(donor.largestDonationAmount) }),
        el("td", {}, [
          el("span", {
            className: donor.needsThanks || donor.receiptNeeded ? "access-chip filtered" : "access-chip full",
            text: donor.needsThanks ? "Dank" : donor.receiptNeeded ? "Quittung" : "ok",
          }),
        ]),
      ]),
    )),
  );
  return el("div", { className: "preview-table-wrap ngo-table-wrap" }, [table]);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function renderDonationQuickEntry(donor) {
  const typeSelect = el("select", { id: `ngoDonationType-${donor.id}` }, DONATION_TYPES.map((type) => el("option", { value: type, text: type })));
  const amountInput = el("input", {
    id: `ngoDonationAmount-${donor.id}`,
    type: "number",
    min: "0",
    step: "1",
    inputmode: "decimal",
    placeholder: "Betrag",
  });
  const dateInput = el("input", {
    id: `ngoDonationDate-${donor.id}`,
    type: "date",
    value: todayInputValue(),
  });
  const purposeInput = el("input", {
    id: `ngoDonationPurpose-${donor.id}`,
    type: "text",
    placeholder: "Zweck",
    autocomplete: "off",
  });
  const thankedInput = el("input", { id: `ngoDonationThanked-${donor.id}`, type: "checkbox" });

  return el("div", { className: "ngo-donation-entry" }, [
    el("span", { className: "card-kicker", text: "Spende hinzufügen" }),
    typeSelect,
    amountInput,
    dateInput,
    purposeInput,
    el("label", { className: "check-label ngo-check" }, [thankedInput, el("span", { text: "Gedankt" })]),
    el("button", {
      className: "secondary-action",
      type: "button",
      "data-ngo-action": "add-donation",
      "data-ngo-donor-id": donor.id,
      text: "Hinzufügen",
    }),
  ]);
}

function renderDonorMask(donor) {
  if (!donor) {
    return el("article", { className: "ngo-mask" }, [
      bookTop("Spender-Maske", "keine Person"),
      el("p", { text: "Noch keine Spenderdaten im aktiven NGO-Projekt." }),
    ]);
  }
  return el("article", { className: "ngo-mask" }, [
    bookTop("Spender-Maske", donor.id),
    el("h3", { text: donor.name }),
    renderDonationQuickEntry(donor),
    el("div", { className: "ngo-section-grid" }, [
      renderObjectSection("Schnelleingabe", [["Name", donor.name], ["Ist Mitglied", donor.isMember ? "ja" : "nein"]]),
      renderObjectSection("Kennzahlen", [
        ["Gesamt", formatEuro(donor.totalAmount)],
        ["Anzahl Einträge", donor.entryCount],
        ["erste Spende", donor.firstDonationDate || "-"],
        ["letzte Spende", donor.lastDonationDate || "-"],
        ["größte Spende", formatEuro(donor.largestDonationAmount)],
      ]),
      renderObjectSection("Kontakt", [["E-Mail", donor.email || "-"], ["Telefon", donor.phone || "-"], ["Straße", donor.street || "-"], ["PLZ", donor.postalCode || "-"], ["Ort", donor.city || "-"]]),
      renderObjectSection("Status & Einwilligung", [
        ["Mitglied", donor.isMember ? "ja" : "nein"],
        ["Dauerspender", donor.recurringDonor ? "ja" : "nein"],
        ["Gedankt", donor.thanked ? "ja" : "nein"],
        ["Gefragt", donor.asked ? "ja" : "nein"],
        ["E-Mail-Werbung", donor.emailMarketingConsent ? "ja" : "nein"],
        ["Mitglied seit", donor.memberSince || "-"],
        ["Spendenquittung benötigt", donor.receiptNeeded ? "ja" : "nein"],
        ["verschickt am", donor.receiptSentAt || "-"],
      ]),
    ]),
    el("div", { className: "ngo-contribution-list" }, [
      el("h3", { text: "Beiträge & Spenden" }),
      el("ul", { className: "topic-list" }, donor.donations.map((donation) =>
        el("li", {}, [
          el("strong", { text: `${donation.type} · ${formatEuro(donation.amount)}` }),
          el("span", { text: `${donation.date || "-"} · ${donation.purpose || "ohne Zweck"}` }),
        ]),
      )),
    ]),
    renderObjectSection("Tags", [["frei vergebbar", donor.tags.join(", ") || "-"]]),
    renderObjectSection("Notizen", [["Freitext", donor.notes || "-"]]),
  ]);
}

function renderObjectSection(title, rows) {
  return el("section", { className: "ngo-object-section" }, [
    el("h4", { text: title }),
    el("ul", { className: "object-list compact-list" }, rows.map(([label, value]) =>
      el("li", {}, [el("span", { text: label }), el("strong", { text: String(value) })]),
    )),
  ]);
}

function renderNgoDonors() {
  const rows = filterNgoDonorRows(queryNgoDonors(ngoWorkspace, {
    search: state.donorSearch,
    sort: state.donorSort,
    onlyOpen: state.donorOnlyOpen,
  }));
  const selectedDonor = rows.find((donor) => donor.id === state.activeNgoDonorId) || rows[0];
  const selectedDonorId = selectedDonor?.id || "";
  return el("div", { className: "ngo-board-grid" }, [
    el("article", { className: "ngo-list-card" }, [
      bookTop("Spenderverwaltung", "Suchen, Sortieren, Filter"),
      renderNgoDonorControls(),
      ...(activeNgoMetricFilterLabel("donors") ? [renderNgoMetricEvidence("donors")] : []),
      renderNgoDonorTable(rows, selectedDonorId),
    ]),
    renderDonorMask(selectedDonor),
  ]);
}

function renderNgoParticipantControls() {
  const search = el("input", {
    id: "ngoParticipantSearch",
    type: "search",
    placeholder: "Suchen",
    autocomplete: "off",
    value: state.participantSearch,
  });
  search.value = state.participantSearch;
  const sort = el("select", { id: "ngoParticipantSort" }, [
    ["visa", "Visum-Frist-Warnung"],
    ["name", "Name"],
    ["age", "Alter"],
    ["admission", "Aufnahme"],
    ["stage", "Stand"],
  ].map(([value, label]) => {
    const option = el("option", { value, text: label });
    option.selected = state.participantSort === value;
    return option;
  }));
  const firstName = el("input", { id: "ngoParticipantFirstName", type: "text", placeholder: "Vorname", autocomplete: "off" });
  const lastName = el("input", { id: "ngoParticipantLastName", type: "text", placeholder: "Name", autocomplete: "off" });

  return el("div", { className: "ngo-controls participant-controls" }, [
    el("label", {}, [el("span", { text: "Suchen" }), search]),
    el("label", {}, [el("span", { text: "Sortieren" }), sort]),
    el("div", { className: "ngo-quick-entry" }, [
      el("span", { className: "card-kicker", text: "Schnelleingabe" }),
      firstName,
      lastName,
      el("button", { className: "secondary-action", type: "button", "data-ngo-action": "add-participant", text: "Anlegen" }),
    ]),
    el("div", { className: "ngo-export-actions" }, [
      el("button", { className: "secondary-action", type: "button", "data-ngo-action": "export-participants", text: "Export CSV" }),
    ]),
  ]);
}

function renderNgoParticipantTable(rows, selectedParticipantId = "") {
  const table = el("table", { className: "matrix-table ngo-table" });
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Name" }),
        el("th", { text: "Alter" }),
        el("th", { text: "Aktueller Stand" }),
        el("th", { text: "Kinder" }),
        el("th", { text: "Visum-Frist" }),
        el("th", { text: "Aufnahme" }),
        el("th", { text: "Betreut durch" }),
      ]),
    ]),
    el("tbody", {}, rows.map((participant, index) =>
      el("tr", {
        className: participant.id === selectedParticipantId || (!selectedParticipantId && index === 0) ? "selected-row selectable-row" : "selectable-row",
        "data-ngo-participant-select": participant.id,
      }, [
        el("td", {}, [
          el("button", { className: "link-action", type: "button", "data-ngo-participant-select": participant.id }, [
            el("strong", { text: participant.name }),
            el("span", { text: participant.idNumber || "ohne ID" }),
          ]),
        ]),
        el("td", { text: participant.age == null ? "-" : String(participant.age) }),
        el("td", { text: participant.currentStage }),
        el("td", { text: participant.hasChildren ? `ja (${participant.childCount})` : "-" }),
        el("td", {}, [
          el("span", {
            className: participant.visaWarning ? "access-chip filtered" : "access-chip full",
            text: participant.visa.relevant ? `${participant.visaDeadline || "-"}${participant.visaWarning ? " !" : ""}` : "nicht relevant",
          }),
        ]),
        el("td", { text: participant.admissionDate || "-" }),
        el("td", { text: participant.supervisedBy || "-" }),
      ]),
    )),
  );
  return el("div", { className: "preview-table-wrap ngo-table-wrap" }, [table]);
}

function renderParticipantMask(participant, allParticipants) {
  if (!participant) {
    return el("article", { className: "ngo-mask" }, [
      bookTop("Teilnehmerinnen-Maske", "keine Person"),
      el("p", { text: "Noch keine Teilnehmerinnen im aktiven NGO-Projekt." }),
    ]);
  }
  const relativeNames = participant.relatives.map((relative) => {
    const found = allParticipants.find((item) => item.id === relative.participantId);
    return `${found?.name || relative.participantId} (${relative.relation})`;
  });
  return el("article", { className: "ngo-mask participant-mask" }, [
    bookTop("Teilnehmerinnen-Maske", participant.id),
    el("h3", { text: participant.name }),
    el("div", { className: "ngo-section-grid" }, [
      renderObjectSection("Schnelleingabe", [["Vorname", participant.firstName], ["Name", participant.lastName]]),
      renderObjectSection("Stammdaten", [
        ["Geburtstag", participant.birthday || "-"],
        ["Alter", participant.age == null ? "-" : participant.age],
        ["Geburtsort", participant.birthPlace || "-"],
        ["Familienstand", participant.familyStatus || "-"],
        ["ID-Nummer", participant.idNumber || "-"],
      ]),
      renderObjectSection("Programm", [
        ["Aufnahme", participant.admissionDate || "-"],
        ["Aktueller Stand", participant.currentStage],
        ["Mitarbeit", participant.program.collaboration || "-"],
        ["Betreut durch", participant.supervisedBy || "-"],
        ["Selbstverpflichtung", participant.selfCommitmentRequired ? (participant.selfCommitmentSigned ? `ja, ${participant.program.selfCommitment.date || "ohne Datum"}` : "offen") : "nicht bei Minderjährigen"],
      ]),
      renderObjectSection("Aufenthalt / Visum", [
        ["Visum relevant", participant.visa.relevant ? "ja" : "nein"],
        ["Art", participant.visa.kind || "-"],
        ["Antrag am", participant.visa.appliedAt || "-"],
        ["Wiedervorlage/Frist", participant.visaDeadline || "-"],
      ]),
      renderObjectSection("Sprache & Ausbildung", [
        ["Deutschkurs-Status", participant.germanCourseStatus],
        ["Kursart/Niveau", participant.languageEducation.courseLevel || "-"],
        ["Ausbildungsstatus", participant.trainingStatus],
        ["Sprachen", participant.languageEducation.languages || "-"],
      ]),
      renderObjectSection("Bildung & Beruf", [
        ["Schulabschluss", participant.training.schoolDegree || "-"],
        ["Bildung", participant.training.education || "-"],
        ["Berufswunsch", participant.training.careerWish || "-"],
        ["Beruf", participant.training.job || "-"],
        ["Interessen", participant.training.interests || "-"],
        ["Kenntnisse", participant.training.skills || "-"],
      ]),
      renderObjectSection("Persönliches & Sensibles", [
        ["Kaste", participant.sensitive.caste || "-"],
        ["Kinder", participant.hasChildren ? `ja, ${participant.childCount}` : "nein"],
        ["Familiensituation", participant.familySituation || "-"],
        ["Krankheiten/Medikamente", participant.sensitive.healthMedication || "-"],
        ["Besonderheiten", participant.sensitive.specialNotes || "-"],
      ]),
      renderObjectSection("Verwandtschaft", [["verknüpft", relativeNames.join(", ") || "-"]]),
      renderObjectSection("Notizen", [["Freitext", participant.notes || "-"]]),
    ]),
  ]);
}

function renderNgoParticipants() {
  const rows = filterNgoParticipantRows(queryNgoParticipants(ngoWorkspace, {
    search: state.participantSearch,
    sort: state.participantSort,
  }));
  const selectedParticipant = rows.find((participant) => participant.id === state.activeNgoParticipantId) || rows[0];
  const selectedParticipantId = selectedParticipant?.id || "";
  return el("div", { className: "ngo-board-grid" }, [
    el("article", { className: "ngo-list-card" }, [
      bookTop("Teilnehmerinnen-Programm", "Status, Fristen, Pflicht-Abläufe"),
      renderNgoParticipantControls(),
      ...(activeNgoMetricFilterLabel("participants") ? [renderNgoMetricEvidence("participants")] : []),
      renderNgoParticipantTable(rows, selectedParticipantId),
    ]),
    renderParticipantMask(selectedParticipant, participantMetrics(ngoWorkspace).participants),
  ]);
}

function renderNgoBackupActions() {
  return el("div", { className: "ngo-backup-actions" }, [
    el("button", { className: "secondary-action", type: "button", "data-ngo-action": "backup", text: "Sichern" }),
    el("label", { className: "secondary-action ngo-restore-label" }, [
      el("input", { id: "ngoRestoreFile", type: "file", accept: ".json,application/json" }),
      el("span", { text: "Wiederherstellen" }),
    ]),
  ]);
}

function hasNgoWorkspaceData(donorStats, participantStats) {
  return donorStats.supporterCount > 0 || participantStats.participantCount > 0;
}

function renderNgoActivationCard() {
  return el("article", { className: "ngo-activation-card" }, [
    bookTop("Aktives Projekt ersetzen", demoProject.projectType === "ngo" ? "NGO leer" : projectRef()),
    el("h3", { text: "NGO-Projekt laden" }),
    el("p", {
      text: demoProject.projectType === "ngo"
        ? "Dieses NGO-Projekt hat noch keine Spender- oder Teilnehmerinnen-Daten. Lade den Demo-Datensatz oder stelle ein NGO-Backup wieder her."
        : "Du bist im NGO-Bereich, aber aktiv ist noch das Kita-Projekt. Lade den NGO-Datensatz, um Kita als aktives Projekt zu ersetzen.",
    }),
    el("div", { className: "ngo-activation-actions" }, [
      el("button", { className: "primary-action", type: "button", "data-ngo-action": "apply-demo", text: "NGO Demo laden" }),
      el("a", { className: "secondary-action", href: "#/data", text: "Datensätze ansehen" }),
    ]),
  ]);
}

function renderNgo() {
  const donorStats = donorMetrics(ngoWorkspace);
  const participantStats = participantMetrics(ngoWorkspace);
  const root = document.querySelector("#ngoBoard");
  const metricsRoot = document.querySelector("#ngoMetrics");
  if (!root || !metricsRoot) return;

  metricsRoot.replaceChildren(
    renderNgoMetric(String(donorStats.supporterCount), "Unterstützer", "Personen mit Spenden-, Mitglieds- oder Dankstatus.", "supporters"),
    renderNgoMetric(formatEuro(donorStats.totalReceived), "gesamt eingenommen", "Summe aller Beiträge und Spenden im NGO-Datenblock.", "received"),
    renderNgoMetric(String(donorStats.openThanks), "noch zu bedanken", "Offene Dank- oder Spendenquittungsfälle.", "openThanks"),
    renderNgoMetric(String(donorStats.members), "Mitglieder", "Personen mit aktivem Mitgliedsstatus.", "members"),
    renderNgoMetric(String(donorStats.recurringDonors), "Dauerspender", "Regelmäßige Unterstützerinnen.", "recurring"),
    renderNgoMetric(String(participantStats.participantCount), "Teilnehmerinnen", "Personen im Teilnehmerinnen-Programm.", "participants"),
    renderNgoMetric(String(participantStats.averageAge), "Ø Alter", "Automatisch aus Geburtsdatum berechnet.", "averageAge"),
    renderNgoMetric(String(participantStats.withChildren), "mit Kindern", "Teilnehmerinnen mit Kinder-Markierung.", "withChildren"),
    renderNgoMetric(String(participantStats.inGermanCourse), "im Deutschkurs", "Parallele Deutschkurs-Spur läuft.", "germanCourse"),
    renderNgoMetric(String(participantStats.openVisaDeadlines), "Visum-Fristen offen", "Fristen im Vorlauf-Alarm oder überfällig.", "visaOpen"),
  );

  root.replaceChildren(
    ...(!hasNgoWorkspaceData(donorStats, participantStats) ? [renderNgoActivationCard()] : []),
    el("div", { className: "ngo-board-head" }, [
      renderNgoTabs(),
      renderNgoBackupActions(),
    ]),
    state.activeNgoView === "participants" ? renderNgoParticipants() : renderNgoDonors(),
    el("article", { className: "ngo-compliance-card" }, [
      bookTop("Querliegende Pflicht-Abläufe", "besonders beachten"),
      el("ul", { className: "topic-list" }, [
        ["Kinderschutz und Safeguarding", "Melde- und Eskalationswege bleiben sichtbar; Minderjährige unterschreiben keine Selbstverpflichtung."],
        ["Visumsfristen", "Wiedervorlage/Frist löst einen Vorlauf-Alarm aus, damit keine Frist durchrutscht."],
        ["Austritt zu Ehemalige", ngoWorkspace.settings.retentionPolicy || "Lösch- und Aufbewahrungsregel festlegen."],
      ].map(([title, text]) => el("li", {}, [el("strong", { text: title }), el("span", { text })]))),
    ]),
  );
}

function renderPreviewTable() {
  const table = el("table", { className: "matrix-table compact-table" });
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Name" }),
        el("th", { text: "Rolle" }),
        el("th", { text: "Bereichspfad" }),
        el("th", { text: "Zugriff" }),
      ]),
    ]),
    el("tbody", {}, dataImportModel.previewRows.map((row) =>
      el("tr", {}, row.map((cell) => el("td", { text: cell }))),
    )),
  );
  return table;
}

function bookTop(type, ref) {
  return el("div", { className: "book-top" }, [
    el("span", { className: "card-kicker", text: type }),
    el("code", { className: "book-ref", text: ref }),
  ]);
}

function renderJournal() {
  const extra = Array.from({ length: state.journalExtra }, (_, index) => [
    "2026-05-27 14:" + String(10 + index).padStart(2, "0"),
    "Demo-Ereignis",
    "Demo-Sync hat Status, Zugriff und Assistenzstand aktualisiert.",
    "Journal Demo " + String(index + 1).padStart(2, "0"),
  ]);
  document.querySelector("#journalList").replaceChildren(
    ...[...extra, ...journalBase].map(([time, kind, text, ref]) =>
      el("article", { className: "journal-item" }, [
        el("time", { text: time }),
        el("div", {}, [el("strong", { text: kind }), el("p", { text })]),
        el("code", { text: ref }),
      ]),
    ),
  );
}

function renderTheme() {
  document.documentElement.lang = state.language;
  document.body.dataset.theme = state.theme;
  settingsModel.ui.theme = state.theme;
  settingsModel.ui.language = state.language;
  const button = document.querySelector("#themeSwitch");
  if (!button) return;
  button.textContent = state.theme === "dark" ? tr("light") : tr("dark");
  button.setAttribute("aria-label", state.theme === "dark" ? tr("light") : tr("dark"));
}

function renderSettings() {
  const imap = settingsModel.imap;
  renderSettingsTabs();
  renderSettingsPanes();
  const imapProjectRef = document.querySelector("#imapForm .book-ref");
  if (imapProjectRef) imapProjectRef.textContent = projectRef();
  setInputLabel("imapAccountId", "Account ID");
  setInputLabel("imapHost", state.language === "de" ? "IMAP Host" : state.language === "fr" ? "Hôte IMAP" : state.language === "es" ? "Host IMAP" : "IMAP host");
  setInputLabel("imapPort", state.language === "fr" ? "Port" : "Port");
  setInputLabel("imapUser", state.language === "de" ? "Benutzer" : state.language === "fr" ? "Utilisateur" : state.language === "es" ? "Usuario" : "User");
  setInputLabel("imapSecret", state.language === "de" ? "Passwort / Token" : state.language === "fr" ? "Mot de passe / jeton" : state.language === "es" ? "Contraseña / token" : "Password / token");
  setInputLabel("imapMailbox", state.language === "de" ? "Mailbox" : state.language === "fr" ? "Boîte mail" : state.language === "es" ? "Buzón" : "Mailbox");
  document.querySelector("#imapAccountId").value = imap.accountId;
  document.querySelector("#imapHost").value = imap.host;
  document.querySelector("#imapPort").value = String(imap.port);
  document.querySelector("#imapSecure").checked = imap.secure;
  document.querySelector("#imapUser").value = imap.user;
  document.querySelector("#imapSecret").value = imap.hasPassword ? "********" : "";
  document.querySelector("#imapMailbox").value = imap.mailbox;

  renderSettingsSummary();
  renderMailPreview();
  renderCubeRunner();
}

function renderSettingsTabs() {
  const tabs = document.querySelector("#settingsTabs");
  if (!tabs) return;
  const items = [
    ["configuration", tr("settingsConfig")],
    ["feedback", tr("settingsFeedback")],
  ];
  tabs.replaceChildren(
    ...items.map(([view, label]) =>
      el("button", {
        type: "button",
        className: state.settingsView === view ? "active" : "",
        "aria-pressed": state.settingsView === view ? "true" : "false",
        "data-settings-view": view,
        text: label,
      }),
    ),
  );
}

function renderSettingsPanes() {
  const configPane = document.querySelector("#settingsConfigPane");
  const feedbackPane = document.querySelector("#settingsFeedbackPane");
  const testButton = document.querySelector("#testImap");
  const feedbackUrl = `./market-validation.html?embedded=1&lang=${encodeURIComponent(state.language)}`;
  const feedbackFrame = document.querySelector(".feedback-frame");
  const feedbackOpen = document.querySelector(".feedback-open");
  setText("settings-title", state.settingsView === "feedback" ? tr("settingsFeedbackTitle") : tr("settingsConfigTitle"));
  configPane.hidden = state.settingsView !== "configuration";
  feedbackPane.hidden = state.settingsView !== "feedback";
  testButton.hidden = state.settingsView !== "configuration";
  setText("feedbackMarketTitle", tr("feedbackMarketTitle"));
  setText("feedbackMarketText", tr("feedbackMarketText"));
  if (feedbackOpen) {
    feedbackOpen.textContent = tr("feedbackOpen");
    feedbackOpen.href = `./market-validation.html?lang=${encodeURIComponent(state.language)}`;
  }
  if (feedbackFrame && feedbackFrame.getAttribute("src") !== feedbackUrl) {
    feedbackFrame.src = feedbackUrl;
  }
}

function setInputLabel(inputId, text) {
  const input = document.querySelector(`#${inputId}`);
  const label = input?.closest("label");
  if (!label || !label.firstChild) return;
  label.firstChild.textContent = `\n                ${text}\n                `;
}

function renderSettingsSummary() {
  const imap = settingsModel.imap;
  const statusText = {
    idle: state.language === "de" ? "nicht geprüft" : state.language === "fr" ? "non vérifié" : state.language === "es" ? "no comprobado" : "not checked",
    checking: state.language === "de" ? "prüft" : state.language === "fr" ? "vérification" : state.language === "es" ? "comprobando" : "checking",
    ok: state.language === "de" ? "bereit" : state.language === "fr" ? "prêt" : state.language === "es" ? "listo" : "ready",
    failed: state.language === "de" ? "Konfiguration unvollständig" : state.language === "fr" ? "configuration incomplète" : state.language === "es" ? "configuración incompleta" : "configuration incomplete",
  }[state.imapStatus];

  document.querySelector("#settingsSummary").replaceChildren(
    bookTop("Einstellungen", "lokal gespeichert"),
    el("p", {
      text: state.language === "de"
        ? "Hier steuerst du Sprache, Darstellung und die Projektmail-Verbindung für das aktive Projekt."
        : state.language === "fr"
          ? "Ici tu règles la langue, l'affichage et la connexion mail du projet actif."
          : state.language === "es"
            ? "Aquí configuras idioma, apariencia y conexión de correo del proyecto activo."
            : "Control language, appearance and project mail connection for the active project here.",
    }),
    el("ul", { className: "object-list" }, [
      el("li", {}, [el("span", { text: "Theme" }), el("strong", { text: settingsModel.ui.theme })]),
      el("li", {}, [el("span", { text: "Sprache" }), el("strong", { text: languages[state.language] || state.language })]),
      el("li", {}, [el("span", { text: "IMAP Account" }), el("strong", { text: imap.accountId || "-" })]),
      el("li", {}, [el("span", { text: "IMAP Host" }), el("strong", { text: imap.host || "-" })]),
      el("li", {}, [el("span", { text: "IMAP status" }), el("strong", { text: statusText })]),
    ]),
    el("h3", { text: state.language === "de" ? "Lokales Profil" : state.language === "fr" ? "Profil local" : state.language === "es" ? "Perfil local" : "Local profile" }),
    el("ul", { className: "object-list" }, [
      el("li", {}, [el("span", { text: onb("reviewName") }), el("strong", { text: localStorage.getItem("projektor-profile-name") || state.onboarding.name || "-" })]),
      el("li", {}, [el("span", { text: onb("reviewEmail") }), el("strong", { text: localStorage.getItem("projektor-profile-email") || state.onboarding.email || "-" })]),
      el("li", {}, [el("span", { text: onb("statsStep") }), el("strong", { text: localStorage.getItem("projektor-usage-stats") === "true" ? onb("reviewStatsOn") : onb("reviewStatsOff") })]),
    ]),
    el("div", { className: "settings-actions" }, [
      el("button", { className: "secondary-action", id: "resetOnboarding", type: "button", text: onb("resetOnboarding") }),
    ]),
  );
}

function renderMailPreview() {
  document.querySelector("#mailPreview").replaceChildren(
    bookTop("Projektmail", "IMAP Vorschau"),
    el("h3", { text: "Projektmail als Quelle" }),
    el("p", {
      text:
        "IMAP wird als Projektquelle eingebunden. Nachrichten bleiben nachvollziehbar zugeordnet und werden nicht als unkontrollierte Kopien verteilt.",
    }),
    el("ul", { className: "topic-list" }, mailPreview.map(([date, sender, subject, tag]) =>
      el("li", {}, [
        el("strong", { text: subject }),
        el("span", { text: `${date} · ${sender} · ${tag}` }),
      ]),
    )),
  );
}

function runnerSession() {
  if (!state.runnerSessionId) {
    state.runnerSessionId = `projektor-cube-${Date.now().toString(36)}`;
    localStorage.setItem("projektor-runner-session", state.runnerSessionId);
  }
  return state.runnerSessionId;
}

function appendRunnerLog(text) {
  const timestamp = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  state.runnerLog = [`${timestamp} ${text}`, ...state.runnerLog].slice(0, 80);
}

function publishRunnerEvent(event) {
  const payload = {
    ...event,
    eventId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sessionId: event.sessionId || runnerSession(),
    sourceWindowId: runtimeWindowId,
    at: new Date().toISOString(),
  };
  localStorage.setItem("projektor-trie-runner-event", JSON.stringify(payload));
  handleRunnerEvent(payload);
}

function handleRunnerEvent(event) {
  if (!event || event.sourceWindowId === runtimeWindowId) return;
  if (event.sessionId && state.runnerSessionId && event.sessionId !== state.runnerSessionId) return;

  if (event.type === "role-ready") {
    state.runnerWindows[event.role] = {
      status: "bereit",
      root: event.root,
      updatedAt: event.at,
    };
    appendRunnerLog(`${roles[event.role]?.label || event.role} meldet Datenbereich bereit.`);
    renderCubeRunner();
  }

  if (event.type === "role-ack") {
    appendRunnerLog(`${roles[event.role]?.label || event.role}: ${event.text}`);
    renderCubeRunner();
  }

  if (isRunnerRoleWindow && event.type === "runner-message" && event.to === runnerRoleParam) {
    state.runnerMessages = [
      {
        from: event.from,
        text: event.text,
        root: event.root,
        at: event.at,
      },
      ...state.runnerMessages,
    ].slice(0, 30);
    renderRunnerRoleWindow();
    window.setTimeout(() => {
      publishRunnerEvent({
        type: "role-ack",
        role: runnerRoleParam,
        text: `Nachricht von ${roles[event.from]?.label || event.from} in ${event.root} verarbeitet.`,
      });
    }, 220);
  }
}

function bindRunnerEvents() {
  window.addEventListener("storage", (event) => {
    if (event.key !== "projektor-trie-runner-event" || !event.newValue) return;
    try {
      handleRunnerEvent(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed prototype events; real runtime events will be typed objects.
    }
  });
}

function openRunnerRoleWindows() {
  const sessionId = runnerSession();
  state.runnerStatus = "windows";
  state.runnerProtocolStep = 0;
  activeRunnerAbort = false;
  appendRunnerLog("projektor.cube öffnet Rollenfenster mit freigegebenen Datenbereichen.");

  runnerRoleKeys.forEach((roleKey) => {
    const layout = runnerRoleWindowLayout[roleKey];
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("runnerRole", roleKey);
    url.searchParams.set("runnerSession", sessionId);
    const features = [
      `left=${layout.left}`,
      `top=${layout.top}`,
      `width=${layout.width}`,
      `height=${layout.height}`,
      "popup=yes",
    ].join(",");
    const ref = window.open(url.toString(), `projektor-${sessionId}-${roleKey}`, features);
    if (ref) {
      runnerWindowRefs.set(roleKey, ref);
      state.runnerWindows[roleKey] = {
        status: "öffnet",
        root: runnerRootForRole(roleKey),
        updatedAt: new Date().toISOString(),
      };
    } else {
      state.runnerWindows[roleKey] = {
        status: "blockiert",
        root: runnerRootForRole(roleKey),
        updatedAt: new Date().toISOString(),
      };
    }
  });

  renderCubeRunner();
}

function runnerRootForRole(roleKey) {
  return projectRolePath(roleKey);
}

function runnerStepRoot(step) {
  const visibleRoot = sharedTrieRoots.find((root) => root.visibility?.[step.to] && root.visibility[step.to] !== "none");
  if (visibleRoot) return visibleRoot.path;
  return sharedTrieRoots[0]?.path || projectRootPath();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runIntegratedProtocol() {
  const hasRunnerWindows = runnerRoleKeys.some((roleKey) => Boolean(state.runnerWindows[roleKey]));
  if (!state.runnerSessionId || !hasRunnerWindows) {
    openRunnerRoleWindows();
    await wait(650);
  }

  state.runnerStatus = "running";
  state.runnerProtocolStep = 0;
  activeRunnerAbort = false;
  appendRunnerLog("Rollenlauf gestartet.");
  renderCubeRunner();

  for (const [index, step] of runnerProtocolSteps.entries()) {
    if (activeRunnerAbort) {
      state.runnerStatus = "stopped";
      appendRunnerLog("Rollenlauf gestoppt.");
      renderCubeRunner();
      return;
    }

    state.runnerProtocolStep = index + 1;
    const root = runnerStepRoot(step);
    appendRunnerLog(`${roles[step.from].label} -> ${roles[step.to].label}: ${root}`);
    publishRunnerEvent({
      type: "runner-message",
      from: step.from,
      to: step.to,
      text: step.text,
      root,
    });
    await wait(820);
  }

  state.runnerStatus = "success";
  state.journalExtra += 1;
  appendRunnerLog("Rollenlauf abgeschlossen; Assembly-Spur im Journal vorgemerkt.");
  renderCubeRunner();
  renderJournal();
}

function stopIntegratedProtocol() {
  activeRunnerAbort = true;
  state.runnerStatus = state.runnerStatus === "running" ? "stopped" : state.runnerStatus;
  appendRunnerLog("Stop angefordert.");
  renderCubeRunner();
}

function clearRunnerInstances() {
  state.runnerWindows = {};
  state.runnerLog = [];
  state.runnerProtocolStep = 0;
  state.runnerStatus = "idle";
  state.runnerSessionId = "";
  localStorage.removeItem("projektor-runner-session");
  runnerWindowRefs.forEach((ref) => {
    try {
      ref.close();
    } catch {
      // Ignore windows already closed by the user.
    }
  });
  runnerWindowRefs.clear();
  renderCubeRunner();
}

function renderCubeRunner() {
  const root = document.querySelector("#cubeRunner");
  if (!root) return;

  const statusText = {
    idle: "bereit",
    windows: "Rollenfenster geöffnet",
    running: "Protokoll läuft",
    success: "abgeschlossen",
    stopped: "gestoppt",
  }[state.runnerStatus] || state.runnerStatus;

  root.replaceChildren(
    el("div", { className: "runner-dashboard", "data-testid": "settings-test-runner-dashboard" }, [
      bookTop("projektor.cube", "integrierter Rollenlauf"),
      el("p", {
        text:
          "Der Runner öffnet Projektrollen als eigene Browserfenster. Nachrichten werden als freigegebene Projektbereiche modelliert; Zugriff und Kontext bestimmen, was jedes Fenster sieht.",
      }),
      el("ul", { className: "object-list compact-list" }, [
        el("li", {}, [el("span", { text: "Status" }), el("strong", { text: statusText })]),
        el("li", {}, [el("span", { text: "Session" }), el("strong", { text: state.runnerSessionId || "-" })]),
        el("li", {}, [el("span", { text: "Schritt" }), el("strong", { text: `${state.runnerProtocolStep}/${runnerProtocolSteps.length}` })]),
      ]),
      el("div", { className: "settings-actions" }, [
        el("button", { className: "secondary-action", id: "runnerStartWindows", type: "button", text: "Rollenfenster" }),
        el("button", { className: "primary-action", id: "runnerRunProtocol", type: "button", text: "Rollenlauf starten" }),
        el("button", { className: "secondary-action", id: "runnerStop", type: "button", text: "Stop" }),
        el("button", { className: "secondary-action", id: "runnerClear", type: "button", text: "Instanzen leeren" }),
      ]),
      el("div", { className: "runner-status-grid" }, runnerRoleKeys.map((roleKey) => {
        const info = state.runnerWindows[roleKey] || {};
        return el("article", { className: "runner-role" }, [
          el("strong", { text: roles[roleKey].label }),
          el("span", { text: info.status || "nicht gestartet" }),
          el("span", { text: info.root || runnerRootForRole(roleKey) }),
        ]);
      })),
      el("pre", { className: "runner-log", text: state.runnerLog.join("\n") || "Noch kein Lauf." }),
    ]),
  );
}

function renderRunnerRoleWindow() {
  renderTheme();
  document.querySelector("#onboardingRoot")?.setAttribute("hidden", "");
  document.querySelector("#appShell")?.classList.add("is-hidden");

  let root = document.querySelector("#runnerWindowRoot");
  if (!root) {
    root = el("section", { id: "runnerWindowRoot", className: "runner-window" });
    document.body.append(root);
  }

  const role = roles[runnerRoleParam];
  const sessionId = new URLSearchParams(window.location.search).get("runnerSession") || runnerSession();
  state.runnerSessionId = sessionId;
  localStorage.setItem("projektor-runner-session", sessionId);

  root.replaceChildren(
    el("div", { className: "runner-window-shell" }, [
      bookTop("Projektrolle", runnerRootForRole(runnerRoleParam)),
      el("h1", { text: role.label }),
      el("p", { text: role.summary }),
      el("ul", { className: "object-list" }, [
        el("li", {}, [el("span", { text: "Session" }), el("strong", { text: sessionId })]),
        el("li", {}, [el("span", { text: "Sichtbarkeit" }), el("strong", { text: "Zugriff + Kontextfilter" })]),
      ]),
      el("h3", { text: "Eingehende Updates" }),
      el("div", { className: "runner-inbox" }, state.runnerMessages.length
        ? state.runnerMessages.map((message) =>
          el("article", { className: "runner-message" }, [
            el("strong", { text: `${roles[message.from]?.label || message.from} -> ${role.label}` }),
            el("p", { text: message.text }),
            el("code", { text: message.root }),
          ]),
        )
        : [el("p", { text: "Wartet auf projektor.cube." })]),
    ]),
  );
}

function bootRunnerRoleWindow() {
  bindRunnerEvents();
  renderRunnerRoleWindow();
  window.setTimeout(() => {
    publishRunnerEvent({
      type: "role-ready",
      role: runnerRoleParam,
      root: runnerRootForRole(runnerRoleParam),
    });
  }, 120);
}

function updateSettingsFromForm() {
  const port = Number(document.querySelector("#imapPort").value);
  settingsModel.imap.accountId = document.querySelector("#imapAccountId").value.trim();
  settingsModel.imap.host = document.querySelector("#imapHost").value.trim();
  settingsModel.imap.port = Number.isInteger(port) ? port : 0;
  settingsModel.imap.secure = document.querySelector("#imapSecure").checked;
  settingsModel.imap.user = document.querySelector("#imapUser").value.trim();
  settingsModel.imap.mailbox = document.querySelector("#imapMailbox").value.trim();
  settingsModel.imap.hasPassword = Boolean(document.querySelector("#imapSecret").value.trim());
  state.imapStatus = "idle";
  renderSettingsSummary();
}

function validateImapSettings() {
  updateSettingsFromForm();
  const imap = settingsModel.imap;
  const valid = Boolean(imap.accountId && imap.host && imap.user && imap.mailbox && imap.port > 0 && imap.hasPassword);
  state.imapStatus = valid ? "ok" : "failed";
  state.journalExtra += 1;
  renderSettingsSummary();
  renderJournal();
}

function downloadTextFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadActiveProjectTable() {
  const projection = createActiveProjectTableProjection();
  const tableType = activeProjectTableType();
  const sheet = getProjectDagExcelSheet(projection, tableType);
  const projectId = demoProject.id || "project";
  state.journalExtra += 1;
  renderProjectTableBoard();
  renderJournal();
  downloadTextFile(
    `projektor-one-${projectId}-${tableType}.csv`,
    "text/csv;charset=utf-8",
    csvFromProjectDagExcelSheet(sheet),
  );
}

function downloadTemplate() {
  const headers = ["Name", "Rolle", "Bereichspfad", "Sichtbarkeit", "Leistungsphase", "E-Mail", "Hinweis"];
  const roleEntries = Object.entries(roles);
  const rows = sharedTrieRoots.slice(0, 3).map((root, index) => {
    const [roleKey, role] = roleEntries[index] || roleEntries[0] || ["role", { label: "Projektrolle" }];
    const access = root.visibility?.[roleKey] || "filtered";
    return [
      role.label,
      role.type || roleKey,
      root.path,
      access === "full" ? "voll" : access === "filtered" ? "gefiltert" : "kein Zugriff",
      root.phase || "LP1-LP9",
      `${roleKey}@example.org`,
      projectContentLabel(root),
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  state.journalExtra += 1;
  renderJournal();
  downloadTextFile("projektor-one-import-template.csv", "text/csv;charset=utf-8", csv);
}

function exportProjectBundle() {
  state.journalExtra += 1;
  const bundle = {
    ...createProjectDatatype(),
    exportedAt: new Date().toISOString(),
  };
  const projectId = demoProject.id || "project";
  renderJournal();
  downloadTextFile(`projektor-one-${projectId}.project.json`, "application/vnd.projektor.project+json", JSON.stringify(bundle, null, 2));
}

function simulateDataImport() {
  state.importStatus = "imported";
  state.journalExtra += 1;
  renderData();
  renderJournal();
}

function applyDatasetPlan(planId) {
  const dataset = createDemoDatasetProject(planId);
  installProjectDatatype(dataset, { persist: true });
  state.datasetCreatorStatus = "angewendet";
  state.importStatus = "imported";
  state.importFileName = `${dataset.creator?.plan?.label || planId}.project.json`;
  state.activePanel = dataset.project?.projectType === "ngo" ? "ngo" : "data";
  render();
}

function exportDatasetPlan(planId) {
  const dataset = createDemoDatasetProject(planId);
  state.datasetCreatorStatus = "exportiert";
  renderDatasetCreatorBoard();
  downloadTextFile(
    `projektor-one-${dataset.project.id}.project.json`,
    "application/vnd.projektor.project+json",
    JSON.stringify(dataset, null, 2),
  );
}

async function importProjectFile(file) {
  state.importFileName = file?.name || "";
  if (!file) {
    state.importStatus = "idle";
    renderData();
    return;
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    state.importStatus = "preview";
    renderData();
    return;
  }

  try {
    const projectData = normalizeProjectDatatype(JSON.parse(await file.text()));
    installProjectDatatype(projectData, { persist: true });
    state.importFileName = file.name;
    state.importStatus = "imported";
    state.journalExtra += 1;
    render();
  } catch (error) {
    state.importStatus = "idle";
    renderData();
    window.alert(error.message || "Project import failed.");
  }
}

function exportNgoPeople() {
  downloadTextFile(`projektor-one-${demoProject.id || "project"}-ngo-personen.csv`, "text/csv;charset=utf-8", csvFromNgoPeople(ngoWorkspace));
}

function exportNgoDonations() {
  downloadTextFile(`projektor-one-${demoProject.id || "project"}-ngo-einzelspenden.csv`, "text/csv;charset=utf-8", csvFromNgoDonations(ngoWorkspace));
}

function exportNgoParticipants() {
  downloadTextFile(`projektor-one-${demoProject.id || "project"}-ngo-teilnehmerinnen.csv`, "text/csv;charset=utf-8", csvFromNgoParticipants(ngoWorkspace));
}

function backupNgoWorkspace() {
  downloadTextFile(`projektor-one-${demoProject.id || "project"}-ngo-backup.json`, "application/json", JSON.stringify(createNgoBackup(ngoWorkspace), null, 2));
}

async function restoreNgoWorkspace(file) {
  if (!file) return;
  try {
    ngoWorkspace = restoreNgoBackup(JSON.parse(await file.text()));
    state.journalExtra += 1;
    persistActiveProjectDatatype();
    renderNgo();
    renderJournal();
  } catch (error) {
    window.alert(error.message || "NGO Wiederherstellung fehlgeschlagen.");
  }
}

function addDonorFromQuickEntry() {
  const nameInput = document.querySelector("#ngoDonorName");
  const memberInput = document.querySelector("#ngoDonorIsMember");
  const name = nameInput?.value?.trim() || "";
  try {
    ngoWorkspace = addNgoDonor(ngoWorkspace, {
      name,
      isMember: Boolean(memberInput?.checked),
    });
    state.activeNgoView = "donors";
    state.donorSearch = name;
    state.donorSort = "name";
    state.donorOnlyOpen = false;
    clearNgoMetricFilter();
    state.journalExtra += 1;
    persistActiveProjectDatatype();
    renderNgo();
    renderJournal();
  } catch (error) {
    window.alert(error.message || "Spender konnte nicht angelegt werden.");
  }
}

function addDonationFromQuickEntry(donorId) {
  const typeInput = document.getElementById(`ngoDonationType-${donorId}`);
  const amountInput = document.getElementById(`ngoDonationAmount-${donorId}`);
  const dateInput = document.getElementById(`ngoDonationDate-${donorId}`);
  const purposeInput = document.getElementById(`ngoDonationPurpose-${donorId}`);
  const thankedInput = document.getElementById(`ngoDonationThanked-${donorId}`);

  try {
    const result = addNgoDonation(ngoWorkspace, {
      donorId,
      type: typeInput?.value || DONATION_TYPES[0],
      amount: Number(amountInput?.value || 0),
      date: dateInput?.value || "",
      purpose: purposeInput?.value?.trim() || "",
      thanked: Boolean(thankedInput?.checked),
    });
    ngoWorkspace = result.data;
    state.activeNgoView = "donors";
    state.activeNgoDonorId = donorId;
    state.donorSearch = result.donor.name;
    state.donorSort = "name";
    state.donorOnlyOpen = false;
    clearNgoMetricFilter();
    state.journalExtra += 1;
    persistActiveProjectDatatype();
    renderNgo();
    renderJournal();
  } catch (error) {
    window.alert(error.message || "Spende konnte nicht hinzugefügt werden.");
  }
}

function addParticipantFromQuickEntry() {
  const firstNameInput = document.querySelector("#ngoParticipantFirstName");
  const lastNameInput = document.querySelector("#ngoParticipantLastName");
  const firstName = firstNameInput?.value?.trim() || "";
  const lastName = lastNameInput?.value?.trim() || "";
  try {
    ngoWorkspace = addNgoParticipant(ngoWorkspace, {
      firstName,
      lastName,
    });
    const createdParticipant = ngoWorkspace.participants.at(-1);
    state.activeNgoView = "participants";
    state.activeNgoParticipantId = createdParticipant?.id || "";
    state.participantSearch = `${firstName} ${lastName}`.trim();
    state.participantSort = "name";
    clearNgoMetricFilter();
    state.journalExtra += 1;
    persistActiveProjectDatatype();
    renderNgo();
    renderJournal();
  } catch (error) {
    window.alert(error.message || "Teilnehmerin konnte nicht angelegt werden.");
  }
}

function syncOnboardingInputs() {
  const root = document.querySelector("#onboardingRoot");
  if (!root || root.hidden) return;
  const name = root.querySelector("#onboardingName");
  const email = root.querySelector("#onboardingEmail");
  const password = root.querySelector("#onboardingPassword");
  const passwordConfirm = root.querySelector("#onboardingPasswordConfirm");
  const stats = root.querySelector("#onboardingStats");
  if (name) state.onboarding.name = name.value.trim();
  if (email) state.onboarding.email = email.value.trim();
  if (password) state.onboarding.password = password.value;
  if (passwordConfirm) state.onboarding.passwordConfirm = passwordConfirm.value;
  if (stats) state.onboarding.statsConsent = stats.checked;
}

function isPlausibleEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateOnboardingStep() {
  syncOnboardingInputs();
  state.onboarding.error = "";

  if (state.onboardingStep === "identity") {
    if (!state.onboarding.name) state.onboarding.error = onb("validationName");
    else if (!isPlausibleEmail(state.onboarding.email)) state.onboarding.error = onb("validationEmail");
  }

  if (state.onboardingStep === "password") {
    const hasEitherPassword = Boolean(state.onboarding.password || state.onboarding.passwordConfirm);
    if (hasEitherPassword && state.onboarding.password !== state.onboarding.passwordConfirm) {
      state.onboarding.error = onb("validationPassword");
    }
  }

  return !state.onboarding.error;
}

function moveOnboarding(delta) {
  syncOnboardingInputs();
  state.onboarding.error = "";
  const nextIndex = Math.min(onboardingSteps.length - 1, Math.max(0, currentOnboardingIndex() + delta));
  state.onboardingStep = onboardingSteps[nextIndex];
  renderOnboarding();
}

function nextOnboardingStep() {
  if (!validateOnboardingStep()) {
    renderOnboarding();
    return;
  }
  moveOnboarding(1);
}

function skipOnboardingPassword() {
  state.onboarding.password = "";
  state.onboarding.passwordConfirm = "";
  state.onboarding.error = "";
  state.onboardingStep = "stats";
  renderOnboarding();
}

function finishOnboarding() {
  if (!validateOnboardingStep()) {
    renderOnboarding();
    return;
  }
  localStorage.setItem("projektor-profile-name", state.onboarding.name);
  localStorage.setItem("projektor-profile-email", state.onboarding.email.toLowerCase());
  localStorage.setItem("projektor-password-enabled", String(Boolean(state.onboarding.password)));
  localStorage.setItem("projektor-usage-stats", String(state.onboarding.statsConsent));
  localStorage.setItem("projektor-onboarding-complete", "true");
  state.onboarding.password = "";
  state.onboarding.passwordConfirm = "";
  state.onboardingStep = "done";
  render();
}

function resetOnboarding() {
  localStorage.removeItem("projektor-onboarding-complete");
  localStorage.removeItem("projektor-password-enabled");
  state.onboardingStep = "identity";
  state.onboarding.password = "";
  state.onboarding.passwordConfirm = "";
  state.onboarding.error = "";
  render();
}

function bindActions() {
  window.addEventListener("hashchange", () => {
    applyRouteFromLocation();
    render();
  });

  document.querySelector("#onboardingRoot").addEventListener("input", syncOnboardingInputs);
  document.addEventListener("input", (event) => {
    if (event.target.id === "ngoDonorSearch") {
      clearNgoMetricFilter();
      state.donorSearch = event.target.value;
      renderNgo();
    }
    if (event.target.id === "ngoParticipantSearch") {
      clearNgoMetricFilter();
      state.participantSearch = event.target.value;
      renderNgo();
    }
  });

  document.querySelector("#onboardingRoot").addEventListener("change", (event) => {
    if (event.target.id === "onboardingLanguage") {
      state.language = event.target.value;
      localStorage.setItem("projektor-language", state.language);
      settingsModel.ui.language = state.language;
      render();
      return;
    }
    syncOnboardingInputs();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "ngoDonorSort") {
      state.donorSort = event.target.value;
      renderNgo();
    }
    if (event.target.id === "ngoDonorOnlyOpen") {
      clearNgoMetricFilter();
      state.donorOnlyOpen = event.target.checked;
      renderNgo();
    }
    if (event.target.id === "ngoParticipantSort") {
      state.participantSort = event.target.value;
      renderNgo();
    }
    if (event.target.id === "ngoRestoreFile") {
      void restoreNgoWorkspace(event.target.files?.[0]);
    }
  });

  document.querySelector("#onboardingRoot").addEventListener("click", (event) => {
    const action = event.target.closest("[data-onboarding-action]")?.dataset.onboardingAction;
    if (!action) return;
    if (action === "back") moveOnboarding(-1);
    if (action === "next") nextOnboardingStep();
    if (action === "skip-password") skipOnboardingPassword();
    if (action === "finish") finishOnboarding();
  });

  document.addEventListener("click", (event) => {
    const ngoMetricButton = event.target.closest("[data-ngo-metric]");
    if (ngoMetricButton) {
      applyNgoMetricFilter(ngoMetricButton.dataset.ngoMetric);
      return;
    }

    const cockpitTarget = event.target.closest("[data-cockpit-target]");
    if (cockpitTarget) {
      if (cockpitTarget.dataset.ngoJump) {
        state.activeNgoView = cockpitTarget.dataset.ngoJump;
      }
      navigateTo(cockpitTarget.dataset.cockpitTarget);
      return;
    }

    const ngoViewButton = event.target.closest("[data-ngo-view]");
    if (ngoViewButton) {
      clearNgoMetricFilter();
      state.activeNgoView = ngoViewButton.dataset.ngoView;
      renderNgo();
      return;
    }

    const ngoDonorSelectButton = event.target.closest("[data-ngo-donor-select]");
    if (ngoDonorSelectButton) {
      state.activeNgoDonorId = ngoDonorSelectButton.dataset.ngoDonorSelect;
      renderNgo();
      return;
    }

    const ngoDonorAddButton = event.target.closest("[data-ngo-donor-add]");
    if (ngoDonorAddButton) {
      const donorId = ngoDonorAddButton.dataset.ngoDonorAdd;
      state.activeNgoDonorId = donorId;
      renderNgo();
      window.setTimeout(() => document.getElementById(`ngoDonationAmount-${donorId}`)?.focus(), 0);
      return;
    }

    const ngoParticipantSelectButton = event.target.closest("[data-ngo-participant-select]");
    if (ngoParticipantSelectButton) {
      state.activeNgoParticipantId = ngoParticipantSelectButton.dataset.ngoParticipantSelect;
      renderNgo();
      return;
    }

    const ngoActionButton = event.target.closest("[data-ngo-action]");
    if (ngoActionButton) {
      const action = ngoActionButton.dataset.ngoAction;
      if (action === "add-donor") addDonorFromQuickEntry();
      if (action === "add-donation") addDonationFromQuickEntry(ngoActionButton.dataset.ngoDonorId);
      if (action === "add-participant") addParticipantFromQuickEntry();
      if (action === "export-people") exportNgoPeople();
      if (action === "export-donations") exportNgoDonations();
      if (action === "export-participants") exportNgoParticipants();
      if (action === "backup") backupNgoWorkspace();
      if (action === "apply-demo") applyDatasetPlan("ngo-supporter-program");
      if (action === "clear-metric-filter") {
        clearNgoMetricFilter();
        state.donorOnlyOpen = false;
        renderNgo();
      }
      return;
    }

    const settingsButton = event.target.closest("[data-settings-view]");
    if (settingsButton) {
      navigateSettings(settingsButton.dataset.settingsView);
      return;
    }
    if (event.target.closest("#resetOnboarding")) resetOnboarding();
    if (event.target.closest("#runnerStartWindows")) openRunnerRoleWindows();
    if (event.target.closest("#runnerRunProtocol")) void runIntegratedProtocol();
    if (event.target.closest("#runnerStop")) stopIntegratedProtocol();
    if (event.target.closest("#runnerClear")) clearRunnerInstances();
    if (event.target.closest("#downloadActiveTable")) {
      downloadActiveProjectTable();
      return;
    }
    const datasetPlanButton = event.target.closest("[data-dataset-plan]");
    if (datasetPlanButton) {
      applyDatasetPlan(datasetPlanButton.dataset.datasetPlan);
      return;
    }
    const datasetExportButton = event.target.closest("[data-dataset-export]");
    if (datasetExportButton) {
      exportDatasetPlan(datasetExportButton.dataset.datasetExport);
      return;
    }
  });

  document.querySelector("#themeSwitch").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("projektor-theme", state.theme);
    state.journalExtra += 1;
    renderTheme();
    renderSettingsSummary();
    renderJournal();
  });

  document.querySelector("#languageSelect").addEventListener("change", (event) => {
    state.language = event.target.value;
    localStorage.setItem("projektor-language", state.language);
    settingsModel.ui.language = state.language;
    render();
  });

  document.querySelector("#simulateSync").addEventListener("click", () => {
    state.syncCount = Math.max(1, state.syncCount - 3);
    state.journalExtra += 1;
    renderStaticText();
    renderJournal();
  });

  document.querySelector("#advanceRun").addEventListener("click", () => {
    state.runStep = (state.runStep + 1) % ai.run.steps.length;
    renderAI();
  });

  document.querySelector("#addJournalEntry").addEventListener("click", () => {
    state.journalExtra += 1;
    renderJournal();
  });

  document.querySelector("#downloadTemplate").addEventListener("click", downloadTemplate);
  document.querySelector("#exportBundle").addEventListener("click", exportProjectBundle);
  document.querySelector("#simulateImport").addEventListener("click", simulateDataImport);
  document.querySelector("#dataImportFile").addEventListener("change", (event) => {
    void importProjectFile(event.target.files?.[0]);
  });

  document.querySelector("#imapForm").addEventListener("input", updateSettingsFromForm);
  document.querySelector("#testImap").addEventListener("click", validateImapSettings);
}

function render() {
  renderTheme();
  renderOnboarding();
  renderLanguageSelect();
  renderStaticText();
  renderNav();
  renderPanels();
  renderCockpit();
  renderRoles();
  renderPhases();
  renderFlows();
  renderScheduleBoard();
  renderProjectVisuals();
  renderEditorBoard();
  renderData();
  renderNgo();
  renderAI();
  renderJournal();
  renderSettings();
}

if (isRunnerRoleWindow) {
  bootRunnerRoleWindow();
} else {
  bindRunnerEvents();
  applyRouteFromLocation();
  render();
  bindActions();
}
