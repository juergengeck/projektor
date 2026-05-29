const state = {
  activePanel: "cockpit",
  activeRole: "architect",
  activePhase: "lp3",
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
  runnerStatus: "idle",
  runnerSessionId: localStorage.getItem("projektor-runner-session") || "",
  runnerWindows: {},
  runnerLog: [],
  runnerMessages: [],
  runnerProtocolStep: 0,
};

const runtimeWindowId = `projektor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const runnerWindowRefs = new Map();
let activeRunnerAbort = false;
const runnerRoleParam = new URLSearchParams(window.location.search).get("runnerRole");
const isRunnerRoleWindow = ["architect", "owner", "authority", "trade"].includes(runnerRoleParam);

const navItems = [
  ["cockpit", "CP", "navCockpit"],
  ["roles", "RO", "navRoles"],
  ["phases", "LP", "navPhases"],
  ["data", "DA", "navData"],
  ["ai", "AS", "navAi"],
  ["journal", "JO", "navJournal"],
  ["settings", "SE", "navSettings"],
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

const demoProject = {
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
    navData: "Daten",
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
    testImap: "IMAP prüfen",
    importPick: "Importdatei wählen",
    importHint: "XLSX/CSV aus Projektliste, Terminplan oder Kontaktliste",
    simulateImport: "Import simulieren",
    dataPreviewTitle: "Vorschau vor Schreibzugriff",
    dataPreviewText: "Projektor prüft die Datei zuerst und zeigt Änderungen an, bevor Daten übernommen werden.",
    exportBundleTitle: "Export-Bundle",
    exportBundleText: "Der Export sammelt Kontakte, Rollen, Termine, Dokumente, Mailbezug und Journal in einer nachvollziehbaren Projektdatei.",
    roleAllowed: "erlaubt",
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
    navData: "Data",
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
    testImap: "Check IMAP",
    importPick: "Choose import file",
    importHint: "XLSX/CSV from a project list, schedule or contact list",
    simulateImport: "Simulate import",
    dataPreviewTitle: "Preview before write access",
    dataPreviewText: "Projektor checks the file first and previews changes before anything is imported.",
    exportBundleTitle: "Export bundle",
    exportBundleText: "The export collects contacts, roles, dates, documents, mail references and journal entries in one traceable project file.",
    roleAllowed: "allowed",
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
    navData: "Données",
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
    testImap: "Vérifier IMAP",
    importPick: "Choisir un fichier",
    importHint: "XLSX/CSV depuis une liste projet, un planning ou une liste de contacts",
    simulateImport: "Simuler l'import",
    dataPreviewTitle: "Aperçu avant écriture",
    dataPreviewText: "Projektor vérifie d'abord le fichier et affiche les changements avant toute importation.",
    exportBundleTitle: "Bundle d'export",
    exportBundleText: "L'export rassemble contacts, rôles, dates, documents, références mail et journal dans un fichier projet traçable.",
    roleAllowed: "autorisé",
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
    navData: "Datos",
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
    testImap: "Comprobar IMAP",
    importPick: "Elegir archivo",
    importHint: "XLSX/CSV de lista de proyecto, cronograma o lista de contactos",
    simulateImport: "Simular importación",
    dataPreviewTitle: "Vista previa antes de escribir",
    dataPreviewText: "Projektor revisa primero el archivo y muestra los cambios antes de importar datos.",
    exportBundleTitle: "Paquete de exportación",
    exportBundleText: "La exportación reúne contactos, roles, fechas, documentos, referencias de correo y diario en un archivo trazable.",
    roleAllowed: "permitido",
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

const metrics = [
  ["100", "Beteiligte", "Schätzung für Bauherr, Planer, Prüfer, Gutachter und Gewerke."],
  ["42", "aktive Kontakte", "Hauptkontakte und Stellvertreter mit direkter Einladung oder delegierter Rolle."],
  ["9", "Leistungsphasen", "Von Grundlagenermittlung bis Objektbetreuung und Dokumentation."],
  ["5", "Querschnittsthemen", "Kosten, Termine, Fördermittel, Kommunikation und Nachhaltigkeit."],
];

const lanes = [
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

const roles = {
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
    permissions: ["Kostentrie", "Terminsteuerung", "Berichte", "Journal lesen"],
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

const runnerRoleKeys = ["architect", "owner", "authority", "trade"];

const runnerRoleWindowLayout = {
  architect: { left: 40, top: 60, width: 470, height: 640 },
  owner: { left: 540, top: 60, width: 470, height: 640 },
  authority: { left: 1040, top: 60, width: 470, height: 640 },
  trade: { left: 1540, top: 60, width: 470, height: 640 },
};

const runnerProtocolSteps = [
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
    text: "Genehmigungsmappe LP4 ist vorbereitet. Rückfrage Stellplatznachweis bitte an den LP4-Ast hängen.",
    journal: "Architekt teilt LP4-Trie-Ast mit Behörde.",
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
    text: "Verstanden. Baustellenast wartet auf freigegebenen Planstand.",
    journal: "Gewerk bestätigt begrenzten Zugriff.",
  },
];

const sharedTrieRoots = [
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

const phases = [
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

const topics = [
  ["Kosten", "DIN 276 Fortschreibung, Freigaben, Budgetabweichungen"],
  ["Termine", "Meilensteine, Gremien, Behördenlaufzeiten, Bauzeitenplan"],
  ["Fördermittel", "Nachweise, Fristen, Zweckbindung und Dokumentationspflicht"],
  ["Kommunikation", "Projektmail, Gruppenchat, Aufgaben, Eskalationen"],
  ["Nachhaltigkeit", "GEG, BNB-Optionen, Energie- und Materialnachweise"],
];

const ai = {
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

const settingsModel = {
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

const mailPreview = [
  ["Heute", "Bauherr", "Kostenberechnung LP3 freigeben", "entscheidung"],
  ["Gestern", "Behörde", "Rückfrage Stellplatznachweis", "lp4"],
  ["Mo", "Fachplaner TGA", "Energieannahmen aktualisiert", "nachhaltigkeit"],
];

const dataImportModel = {
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

const exportBundleModel = {
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

const journalBase = [
  ["2026-05-27 09:12", "Rolle vergeben", "Architekt lädt Bauherr per Link ein.", "Journal 001"],
  ["2026-05-27 10:35", "Dokument freigegeben", "Entwurf LP3 Version 14 im Dokumentenbereich freigegeben.", "Journal 002"],
  ["2026-05-27 11:48", "Entscheidung erfasst", "Kostenberechnung wird als Grundlage für Gremientermin markiert.", "Journal 003"],
  ["2026-05-27 13:05", "Assistenz vorbereitet", "Prüfung für LP3 zu LP4 vorbereitet.", "Journal 004"],
  ["2026-05-27 13:31", "Einstellungen aktualisiert", "IMAP Account-Metadaten aktualisiert; Passwort bleibt lokal geschützt.", "Journal 005"],
  ["2026-05-27 13:46", "Export vorbereitet", "Projekt-Export mit Beteiligten, Rollen, Dokumenten, Mailbezügen, Einstellungen und Journal vorbereitet.", "Journal 006"],
];

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
        state.activePanel = id;
        render();
      });
      return button;
    }),
  );
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
  document.querySelector(".map-center strong").textContent = projectText("subtitles");
  setText("mapProjectId", `${demoProject.objectType} ${demoProject.id}`);
  const nodes = demoProject.nodes[state.language] ?? demoProject.nodes.de;
  setText("mapNodeA", nodes[0]);
  setText("mapNodeB", nodes[1]);
  setText("mapNodeC", nodes[2]);
  setText("mapNodeD", nodes[3]);
  document.querySelector("#statusPhase").innerHTML = `<strong>LP</strong> ${demoProject.phase[state.language] ?? demoProject.phase.de}`;
  document.querySelector("#statusRisk").innerHTML = `<strong>${tr("statusRiskLabel")}</strong> ${demoProject.risk[state.language] ?? demoProject.risk.de}`;
  document.querySelector("#statusSync").innerHTML = `<strong>${tr("statusSync")}</strong> ${state.syncCount} min`;

  setText("cockpitEyebrow", tr("cockpitEyebrow"));
  setText("cockpit-title", tr("cockpitTitle"));
  setText("simulateSync", tr("simulateSync"));
  setText("rolesEyebrow", tr("rolesEyebrow"));
  setText("roles-title", tr("rolesTitle"));
  setText("phasesEyebrow", tr("phasesEyebrow"));
  setText("phases-title", tr("phasesTitle"));
  setText("dataEyebrow", tr("dataEyebrow"));
  setText("data-title", tr("dataTitle"));
  setText("downloadTemplate", tr("template"));
  setText("exportBundle", tr("export"));
  setText("aiEyebrow", tr("aiEyebrow"));
  setText("ai-title", tr("aiTitle"));
  setText("advanceRun", tr("advanceRun"));
  setText("journalEyebrow", tr("journalEyebrow"));
  setText("journal-title", tr("journalTitle"));
  setText("addJournalEntry", tr("demoEvent"));
  setText("settingsEyebrow", tr("settingsEyebrow"));
  setText("settings-title", tr("settingsTitle"));
  setText("testImap", tr("testImap"));
  setText("simulateImport", tr("simulateImport"));
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
    ...lanes.map((lane) =>
      el("article", { className: "lane" }, [
        el("span", { className: "card-kicker", text: "Projektbereich" }),
        el("h3", { text: lane.title }),
        el("p", { text: lane.text }),
        el("div", { className: "lane-progress" }, [el("span", { style: `width: ${lane.progress}%` })]),
      ]),
    ),
  );
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
        el("li", {}, [el("span", { text: "Grenze" }), el("strong", { text: "Trust + Kontext filtern Trie-Export" })]),
        el("li", {}, [el("span", { text: "Entzug" }), el("strong", { text: "Policy-Änderung mit Assembly-Spur" })]),
    ]),
  );

  const table = el("table", { className: "matrix-table" });
  const roleKeys = Object.keys(roles);
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Trie-Pfad" }),
        el("th", { text: "Root-Objekt" }),
        ...roleKeys.map((key) => el("th", { text: roles[key].label })),
      ]),
    ]),
    el("tbody", {}, sharedTrieRoots.map((root) =>
      el("tr", {}, [
        el("td", { text: root.path }),
        el("td", { text: root.object }),
        ...roleKeys.map((key) => {
          const access = root.visibility[key] || "none";
          const label = access === "full" ? "voll" : access === "filtered" ? "gefiltert" : "-";
          return el("td", {}, [el("span", { className: `access-chip ${access}`, text: label })]);
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
      });
      return button;
    }),
  );

  const phase = phases.find((item) => item.id === state.activePhase);
  document.querySelector("#phaseDetail").replaceChildren(
    el("span", { className: "card-kicker", text: phase.short }),
    el("h3", { text: phase.title }),
    el("p", { text: phase.decision }),
    el("ul", { className: "object-list" }, [
      el("li", {}, [el("span", { text: "Projektphase" }), el("strong", { text: phase.short })]),
      el("li", {}, [el("span", { text: "Aktuelles Risiko" }), el("strong", { text: phase.risk })]),
      el("li", {}, [el("span", { text: "Assistenz" }), el("strong", { text: "nur Hinweise, keine Freigabe" })]),
    ]),
  );

  document.querySelector("#topicBoard").replaceChildren(
    el("span", { className: "card-kicker", text: "Querschnittsthemen" }),
    el("h3", { text: "Kontinuierliche Projektkontrolle" }),
    el("ul", { className: "topic-list" }, topics.map(([title, text]) => el("li", {}, [el("strong", { text: title }), el("span", { text })]))),
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
    bookTop(dataImportModel.type, "Demo: Kita 2028"),
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
    bookTop(exportBundleModel.type, exportBundleModel.ref),
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
}

function renderPreviewTable() {
  const table = el("table", { className: "matrix-table compact-table" });
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Name" }),
        el("th", { text: "Rolle" }),
        el("th", { text: "Trie-Pfad" }),
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
    appendRunnerLog(`${roles[event.role]?.label || event.role} meldet Trie-Root bereit.`);
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
      // Ignore malformed prototype events; real trie events will be typed objects.
    }
  });
}

function openRunnerRoleWindows() {
  const sessionId = runnerSession();
  state.runnerStatus = "windows";
  state.runnerProtocolStep = 0;
  activeRunnerAbort = false;
  appendRunnerLog("projektor.cube öffnet Rollenfenster mit geteilten Trie-Wurzeln.");

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
  return `/demo-kita-2028/roles/${roleKey}`;
}

function runnerStepRoot(step) {
  if (step.to === "owner") return "/demo-kita-2028/costs/din276";
  if (step.to === "authority") return "/demo-kita-2028/lp4/permit-documents";
  if (step.to === "trade") return "/demo-kita-2028/lp8/site";
  return "/demo-kita-2028/project-mail";
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
  appendRunnerLog("Trie-basierter Rollenlauf gestartet.");
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
      bookTop("projektor.cube", "integrated trie test runner"),
      el("p", {
        text:
          "Der Runner öffnet Projektrollen als eigene Browserfenster. Nachrichten werden als geteilte Trie-Äste modelliert; Trust und Kontext bestimmen, was jedes Fenster sieht.",
      }),
      el("ul", { className: "object-list compact-list" }, [
        el("li", {}, [el("span", { text: "Status" }), el("strong", { text: statusText })]),
        el("li", {}, [el("span", { text: "Session" }), el("strong", { text: state.runnerSessionId || "-" })]),
        el("li", {}, [el("span", { text: "Schritt" }), el("strong", { text: `${state.runnerProtocolStep}/${runnerProtocolSteps.length}` })]),
      ]),
      el("div", { className: "settings-actions" }, [
        el("button", { className: "secondary-action", id: "runnerStartWindows", type: "button", text: "Rollenfenster" }),
        el("button", { className: "primary-action", id: "runnerRunProtocol", type: "button", text: "Trie-Lauf starten" }),
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
        el("li", {}, [el("span", { text: "Sichtbarkeit" }), el("strong", { text: "Trust + Kontextfilter" })]),
      ]),
      el("h3", { text: "Eingehende Trie-Updates" }),
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

function downloadTemplate() {
  const headers = ["Name", "Rolle", "Trie-Pfad", "Sichtbarkeit", "Leistungsphase", "E-Mail", "Hinweis"];
  const rows = [
    ["Bauherr Darmstadt", "Bauherr", "/demo-kita-2028/project-mail", "voll", "LP1-LP9", "bauherr@example.org", "Hauptansprechpartner"],
    ["Amt Bauaufsicht", "Behörde", "/demo-kita-2028/lp4/permit-documents", "gefiltert", "LP4", "amt@example.org", "Behörde"],
    ["Gewerk Rohbau", "Gewerk", "/demo-kita-2028/lp8/site", "gefiltert", "LP6-LP8", "rohbau@example.org", "Ausführung"],
  ];
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  state.journalExtra += 1;
  renderJournal();
  downloadTextFile("projektor-one-import-template.csv", "text/csv;charset=utf-8", csv);
}

function exportProjectBundle() {
  const bundle = {
    kind: exportBundleModel.type,
    exportedAt: new Date().toISOString(),
    project: {
      id: demoProject.id,
      title: projectText("titles"),
      subtitle: projectText("subtitles"),
      activePhase: state.activePhase,
      syncAgeMinutes: state.syncCount,
    },
    roles,
    sharedTrieRoots,
    settings: {
      ui: settingsModel.ui,
      sourceImap: {
        ...settingsModel.imap,
        password: undefined,
        accessToken: undefined,
      },
    },
    importModel: dataImportModel,
    ai,
    warnings: exportBundleModel.warnings,
  };
  state.journalExtra += 1;
  renderJournal();
  downloadTextFile("projektor-one-demo-kita-2028-export.json", "application/json", JSON.stringify(bundle, null, 2));
}

function simulateDataImport() {
  state.importStatus = "imported";
  state.journalExtra += 1;
  renderData();
  renderJournal();
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
  document.querySelector("#onboardingRoot").addEventListener("input", syncOnboardingInputs);
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
  document.querySelector("#onboardingRoot").addEventListener("click", (event) => {
    const action = event.target.closest("[data-onboarding-action]")?.dataset.onboardingAction;
    if (!action) return;
    if (action === "back") moveOnboarding(-1);
    if (action === "next") nextOnboardingStep();
    if (action === "skip-password") skipOnboardingPassword();
    if (action === "finish") finishOnboarding();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("#resetOnboarding")) resetOnboarding();
    if (event.target.closest("#runnerStartWindows")) openRunnerRoleWindows();
    if (event.target.closest("#runnerRunProtocol")) void runIntegratedProtocol();
    if (event.target.closest("#runnerStop")) stopIntegratedProtocol();
    if (event.target.closest("#runnerClear")) clearRunnerInstances();
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
    state.importFileName = event.target.files?.[0]?.name || "";
    state.importStatus = state.importFileName ? "preview" : "idle";
    renderData();
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
  renderData();
  renderAI();
  renderJournal();
  renderSettings();
}

if (isRunnerRoleWindow) {
  bootRunnerRoleWindow();
} else {
  bindRunnerEvents();
  render();
  bindActions();
}
