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
};

const navItems = [
  ["cockpit", "CP", "navCockpit"],
  ["roles", "RO", "navRoles"],
  ["phases", "LP", "navPhases"],
  ["data", "DA", "navData"],
  ["ai", "AI", "navAi"],
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
    back: "Zurueck",
    continue: "Weiter",
    email: "E-Mail",
    emailHelp: "Wir verwenden deine E-Mail als lokale ID, nicht als Login bei unseren Servern.",
    emailPlaceholder: "du@architekturburo.example",
    finish: "projektor.one starten",
    identityStep: "Identitaet",
    intro: "Ein lokaler Start fuer Architektur-Projekte, Rollen, Projektmail und Entscheidungen.",
    localPromise:
      "Alle Projekt- und Nutzerdaten bleiben auf deinem Rechner, in deinem Browser. projektor.one laedt Projektinhalte nicht automatisch auf unsere Server.",
    localPromiseTitle: "Deine Daten bleiben lokal",
    name: "Anrede / Name",
    namePlaceholder: "z. B. Alex, Frau Meyer oder Team LP3",
    nextStore:
      "Der Browser wird hier wie ein App Store genutzt: du oeffnest oder installierst projektor.one direkt aus dem Web, ohne zentrale Store-Freigabe.",
    nextStoreTitle: "Das Web ist der App Store",
    optional: "optional",
    password: "Passwort",
    passwordConfirm: "Passwort wiederholen",
    passwordHelp:
      "Dieses Passwort ist nur fuer den Schutz deiner lokalen Daten gedacht. Es ist kein Konto-Passwort und wird in diesem Prototyp nicht gespeichert.",
    passwordPlaceholder: "lokales Schutzpasswort",
    passwordStep: "Schutz",
    passwordTitle: "Lokales Passwort nur, wenn du es moechtest",
    profileTitle: "Wie soll das System dich ansprechen?",
    resetOnboarding: "Onboarding zuruecksetzen",
    reviewEmail: "Identitaets-E-Mail",
    reviewName: "Anrede",
    reviewPasswordOff: "ohne lokales Passwort",
    reviewPasswordOn: "lokaler Schutz aktiviert",
    reviewStatsOff: "nicht freigegeben",
    reviewStatsOn: "freigegeben",
    reviewStep: "Start",
    reviewTitle: "Alles bereit fuer dein lokales Projekt-Cockpit",
    secureEmail: "Bitte gib deine E-Mail ein, damit du dich sicher identifizieren kannst.",
    skipPassword: "Ohne Passwort weiter",
    statsConsent:
      "Ich stimme zu, dass projektor.one Nutzungsstatistiken fuer Beschaffung und Einfuehrung auswerten darf.",
    statsHelp:
      "Erfasst werden nur Nutzungsereignisse wie geoeffnete Bereiche, Sitzungen und technische Kategorie. Projektinhalte, Dokumente, Mailtexte und Dateinamen gehoeren nicht dazu.",
    statsStep: "Statistik",
    statsTitle: "Nutzungsstatistiken nur mit deiner Zustimmung",
    validationEmail: "Bitte gib eine plausible E-Mail-Adresse ein.",
    validationName: "Bitte gib ein, wie projektor.one dich ansprechen soll.",
    validationPassword: "Die Passwoerter muessen uebereinstimmen.",
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
  objectType: "ProjektorProject",
  titles: {
    de: "Demo: Kita 2028 - Neubau einer kommunalen Kindertagesstaette",
    en: "Demo: Kita 2028 - New municipal daycare building",
    fr: "Démo : Kita 2028 - construction d'une crèche municipale",
    es: "Demo: Kita 2028 - nueva guardería municipal",
  },
  subtitles: {
    de: "Beispielprojekt aus den Projektor-Unterlagen",
    en: "Example project from the Projektor source documents",
    fr: "Projet exemple issu des documents Projektor",
    es: "Proyecto de ejemplo de los documentos de Projektor",
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
    de: ["Bauherr", "Architekt", "Behoerde", "Gewerk"],
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
    navAi: "AI Surface",
    navJournal: "Journal",
    navSettings: "Settings",
    brandSubtitle: "Architektur-Projekte",
    topEyebrow: "Projektmanagement fuer Architekturbueros",
    statusRiskLabel: "Risiko",
    statusSync: "Sync",
    dark: "Dark",
    light: "Light",
    simulateSync: "Sync simulieren",
    cockpitEyebrow: "Projektsteuerung",
    cockpitTitle: "Ein Buero, viele Projekte, kontrollierte Datenkanaele",
    rolesEyebrow: "Flexibel Rollenmodell uebertragen",
    rolesTitle: "Rollen, Zertifikate und Kanalzugriff",
    phasesEyebrow: "HOAI Leistungsphasen",
    phasesTitle: "Phasen, Querschnittsthemen und offene Entscheidungen",
    dataEyebrow: "Flexibel Import/Export adaptiert",
    dataTitle: "Datenimport, Vorschau und Projekt-Export",
    template: "Template",
    export: "Export",
    aiEyebrow: "VGER AI Surface",
    aiTitle: "Goal Book, Prepared Workload, Run Book",
    advanceRun: "Naechsten Schritt pruefen",
    journalEyebrow: "ONE Journal",
    journalTitle: "Faelschungssichere Ereignisse als Bedienoberflaeche",
    demoEvent: "Demo-Ereignis",
    settingsEyebrow: "settings.core + source.mail",
    settingsTitle: "Settings, Theme und IMAP-Projektmail",
    testImap: "IMAP pruefen",
    importPick: "Importdatei waehlen",
    importHint: "XLSX/CSV aus Projektliste, Terminplan oder Flexibel-artigem Datenexport",
    simulateImport: "Import simulieren",
    dataPreviewTitle: "Vorschau vor Schreibzugriff",
    dataPreviewText: "Wie in Flexibel wird erst normalisiert, dann vorgezeigt, dann in Domain-Objekte geschrieben.",
    exportBundleTitle: "Export-Bundle",
    exportBundleText: "Der Export folgt Flexibel: Kontext, fachliche Tabellen, Warnungen und runde Re-Import-Struktur.",
    settingsText: "Settings zeigt hier nur die unmittelbar bedienbaren Projektpraeferenzen und Datenquellen. Die breitere target-scoped Steuerung bleibt ausserhalb dieser UI.",
    oneOwners: "../one package owners",
    roleAllowed: "erlaubt",
    status: "Status",
    parser: "Parser",
    importSource: "Import source",
    noImportFile: "Keine Importdatei gewaehlt",
    importReady: "bereit zur Vorschau",
    importPreview: "Vorschau erzeugt, 4 Konflikte pruefen",
    imported: "Demo-Import journalisiert",
  },
  en: {
    navCockpit: "Cockpit",
    navRoles: "Roles",
    navPhases: "Phases",
    navData: "Data",
    navAi: "AI Surface",
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
    cockpitTitle: "One office, many projects, controlled data channels",
    rolesEyebrow: "Flexibel role model adapted",
    rolesTitle: "Roles, certificates and channel access",
    phasesEyebrow: "HOAI phases",
    phasesTitle: "Phases, cross-cutting topics and open decisions",
    dataEyebrow: "Flexibel import/export adapted",
    dataTitle: "Data import, preview and project export",
    template: "Template",
    export: "Export",
    aiEyebrow: "VGER AI Surface",
    aiTitle: "Goal Book, Prepared Workload, Run Book",
    advanceRun: "Check next step",
    journalEyebrow: "ONE Journal",
    journalTitle: "Tamper-evident events as an operating surface",
    demoEvent: "Demo event",
    settingsEyebrow: "settings.core + source.mail",
    settingsTitle: "Settings, theme and IMAP project mail",
    testImap: "Check IMAP",
    importPick: "Choose import file",
    importHint: "XLSX/CSV from project list, schedule or Flexibel-style data export",
    simulateImport: "Simulate import",
    dataPreviewTitle: "Preview before write access",
    dataPreviewText: "As in Flexibel, data is normalized first, previewed, then written into domain objects.",
    exportBundleTitle: "Export bundle",
    exportBundleText: "The export follows Flexibel: context, domain tables, warnings and stable re-import structure.",
    settingsText: "Settings shows only directly editable project preferences and data sources here. Broader target-scoped control stays outside this UI.",
    oneOwners: "../one package owners",
    roleAllowed: "allowed",
    status: "Status",
    parser: "Parser",
    importSource: "Import source",
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
    cockpitTitle: "Un cabinet, plusieurs projets, des canaux de données contrôlés",
    rolesEyebrow: "Modèle de rôles Flexibel adapté",
    rolesTitle: "Rôles, certificats et accès aux canaux",
    phasesEyebrow: "Phases HOAI",
    phasesTitle: "Phases, thèmes transversaux et décisions ouvertes",
    dataEyebrow: "Import/export Flexibel adapté",
    dataTitle: "Import, aperçu et export du projet",
    template: "Modèle",
    export: "Exporter",
    aiEyebrow: "Surface IA VGER",
    aiTitle: "Goal Book, Prepared Workload, Run Book",
    advanceRun: "Vérifier l'étape suivante",
    journalEyebrow: "Journal ONE",
    journalTitle: "Événements infalsifiables comme surface opérationnelle",
    demoEvent: "Événement démo",
    settingsEyebrow: "settings.core + source.mail",
    settingsTitle: "Réglages, thème et mail projet IMAP",
    testImap: "Vérifier IMAP",
    importPick: "Choisir un fichier",
    importHint: "XLSX/CSV depuis une liste projet, un planning ou un export de type Flexibel",
    simulateImport: "Simuler l'import",
    dataPreviewTitle: "Aperçu avant écriture",
    dataPreviewText: "Comme dans Flexibel, les données sont normalisées, prévisualisées, puis écrites dans des objets métier.",
    exportBundleTitle: "Bundle d'export",
    exportBundleText: "L'export suit Flexibel : contexte, tables métier, avertissements et structure de réimport stable.",
    settingsText: "Les réglages affichent ici seulement les préférences projet et sources de données directement éditables. Le pilotage target-scoped plus large reste hors de cette UI.",
    oneOwners: "packages propriétaires ../one",
    roleAllowed: "autorisé",
    status: "Statut",
    parser: "Parseur",
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
    cockpitTitle: "Un estudio, varios proyectos, canales de datos controlados",
    rolesEyebrow: "Modelo de roles Flexibel adaptado",
    rolesTitle: "Roles, certificados y acceso a canales",
    phasesEyebrow: "Fases HOAI",
    phasesTitle: "Fases, temas transversales y decisiones abiertas",
    dataEyebrow: "Import/export Flexibel adaptado",
    dataTitle: "Importación, vista previa y exportación del proyecto",
    template: "Plantilla",
    export: "Exportar",
    aiEyebrow: "Superficie IA VGER",
    aiTitle: "Goal Book, Prepared Workload, Run Book",
    advanceRun: "Revisar siguiente paso",
    journalEyebrow: "Diario ONE",
    journalTitle: "Eventos verificables como superficie operativa",
    demoEvent: "Evento demo",
    settingsEyebrow: "settings.core + source.mail",
    settingsTitle: "Ajustes, tema y correo IMAP del proyecto",
    testImap: "Comprobar IMAP",
    importPick: "Elegir archivo",
    importHint: "XLSX/CSV de lista de proyecto, cronograma o export tipo Flexibel",
    simulateImport: "Simular importación",
    dataPreviewTitle: "Vista previa antes de escribir",
    dataPreviewText: "Como en Flexibel, los datos se normalizan, se previsualizan y luego se escriben en objetos de dominio.",
    exportBundleTitle: "Paquete de exportación",
    exportBundleText: "La exportación sigue Flexibel: contexto, tablas de dominio, advertencias y estructura estable para reimportar.",
    settingsText: "Ajustes muestra aquí solo preferencias de proyecto y fuentes de datos editables. El control target-scoped más amplio queda fuera de esta UI.",
    oneOwners: "paquetes propietarios ../one",
    roleAllowed: "permitido",
    status: "Estado",
    parser: "Parser",
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
  ["100", "Beteiligte", "Schaetzung fuer Bauherr, Planer, Pruefer, Gutachter und Gewerke."],
  ["42", "aktive Kontakte", "Heads und Stellvertreter mit direkter Einladung oder delegierter Rolle."],
  ["9", "Leistungsphasen", "Von Grundlagenermittlung bis Objektbetreuung und Dokumentation."],
  ["5", "Querschnittsthemen", "Kosten, Termine, Foerdermittel, Kommunikation und Nachhaltigkeit."],
];

const lanes = [
  {
    title: "Kommunikation",
    text: "Projektmail, Chat und Termine bleiben pro Projektkanal nachvollziehbar.",
    progress: 72,
  },
  {
    title: "Dokumente",
    text: "Plaene, Nachweise und Freigaben werden als ProjectDocumentRef geteilt.",
    progress: 58,
  },
  {
    title: "Entscheidungen",
    text: "Freigaben, Rueckfragen und Konflikte landen im Journal statt in Nebenkanaelen.",
    progress: 44,
  },
];

const roles = {
  owner: {
    label: "Bauherr",
    type: "ProjectOwnerRoleCertificate",
    id: "role:owner:demo-kita-2028",
    summary:
      "Sieht das Gesamtprojekt, gibt Budgets und Entscheidungen frei und kann Stellvertreter mit identischer Rolle einladen.",
    permissions: ["Alle Projektkanaele", "Kostenfreigabe", "Terminkalender", "Journal und Export"],
  },
  architect: {
    label: "Architekt",
    type: "ProjectCoordinatorRoleCertificate",
    id: "role:architect:demo-kita-2028",
    summary:
      "Zentraler Koordinator ueber 4 bis 7 Jahre. Erstellt das Projekt, laedt Heads ein und steuert Rechte pro Leistungsphase.",
    permissions: ["Projektanlage", "Rolleneinladung", "Dokumentengruppen", "AI Goal Surface"],
  },
  controller: {
    label: "Projektsteuerer",
    type: "ProjectControllerRoleCertificate",
    id: "role:controller:demo-kita-2028",
    summary:
      "Koordiniert Termine, Kosten und Berichtslagen, falls diese Rolle im Projekt eingesetzt wird.",
    permissions: ["Kostenkanal", "Terminsteuerung", "Berichte", "Journal lesen"],
  },
  authority: {
    label: "Behoerde",
    type: "AuthorityRoleCertificate",
    id: "role:authority:lp4",
    summary:
      "Erhaelt begrenzten Zugriff auf genehmigungsrelevante Dokumente, Rueckfragen und Freigaben.",
    permissions: ["LP4 Dokumente", "Rueckfragen", "Status lesen", "Kein Vollzugriff"],
  },
  trade: {
    label: "Gewerk",
    type: "TradeRoleCertificate",
    id: "role:trade:lp6-lp8",
    summary:
      "Arbeitet mit eingeschraenkten Plan-, Termin- und Dokumentengruppen in der Ausfuehrung.",
    permissions: ["Dokumentengruppe", "Termine", "Chat", "Journal begrenzt"],
  },
};

const channels = [
  {
    name: "project.mail",
    object: "ProjectMailChannel",
    owner: "architect",
    access: { owner: "full", architect: "full", controller: "full", authority: "limited", trade: "limited" },
  },
  {
    name: "source.mail.imap",
    object: "ImapSourceProjectionRoot",
    owner: "architect",
    access: { owner: "limited", architect: "full", controller: "limited", authority: "none", trade: "none" },
  },
  {
    name: "documents.lp4",
    object: "ProjectDocumentChannel",
    owner: "architect",
    access: { owner: "full", architect: "full", controller: "limited", authority: "limited", trade: "none" },
  },
  {
    name: "costs.din276",
    object: "CostControlChannel",
    owner: "controller",
    access: { owner: "full", architect: "full", controller: "full", authority: "none", trade: "none" },
  },
  {
    name: "site.lp8",
    object: "ConstructionSiteChannel",
    owner: "architect",
    access: { owner: "limited", architect: "full", controller: "limited", authority: "none", trade: "limited" },
  },
];

const phases = [
  {
    id: "lp1",
    short: "LP1",
    title: "Grundlagenermittlung",
    decision: "Bedarf, Flaechen, Beteiligte und erste Projektstruktur klaeren.",
    risk: "Unklare Anforderungen werden spaeter teuer.",
  },
  {
    id: "lp2",
    short: "LP2",
    title: "Vorplanung",
    decision: "Varianten, Kostenrahmen und Foerderlogik zusammenbringen.",
    risk: "Foerderbedingungen und Nutzerbedarf laufen auseinander.",
  },
  {
    id: "lp3",
    short: "LP3",
    title: "Entwurfsplanung",
    decision: "Entwurf, Kostenberechnung und Terminpfad beschlussfaehig machen.",
    risk: "Bauherr, Fachplaner und Nachhaltigkeitsanforderungen sind nicht synchron.",
  },
  {
    id: "lp4",
    short: "LP4",
    title: "Genehmigungsplanung",
    decision: "Unterlagen, Behoerdenrueckfragen und Nachweise vollstaendig halten.",
    risk: "Rueckfragen verschwinden in Mailverlaeufen.",
  },
  {
    id: "lp5",
    short: "LP5",
    title: "Ausfuehrungsplanung",
    decision: "Planstaende, Freigaben und Aenderungen kontrolliert verteilen.",
    risk: "Gewerke arbeiten mit abweichenden Planstaenden.",
  },
  {
    id: "lp8",
    short: "LP8",
    title: "Bauueberwachung",
    decision: "Maengel, Termine, Protokolle und Nachtraege im Takt fuehren.",
    risk: "Baustellenereignisse sind nicht beweisfest verknuepft.",
  },
];

const topics = [
  ["Kosten", "DIN 276 Fortschreibung, Freigaben, Budgetabweichungen"],
  ["Termine", "Meilensteine, Gremien, Behoerdenlaufzeiten, Bauzeitenplan"],
  ["Foerdermittel", "Nachweise, Fristen, Zweckbindung und Dokumentationspflicht"],
  ["Kommunikation", "Projektmail, Gruppenchat, Aufgaben, Eskalationen"],
  ["Nachhaltigkeit", "GEG, BNB-Optionen, Energie- und Materialnachweise"],
];

const ai = {
  goal: {
    type: "ProjectGoal",
    ref: "goal:demo-kita-2028:lp3-lp4-readiness",
    objective: "LP3 nach LP4 uebergabefaehig machen, ohne Rueckfragen und Nachweise in Nebenkanaelen zu verlieren.",
    why: "Das Architekturbuero traegt die Koordination. Der AI-Agent soll nicht entscheiden, sondern Luecken, Risiken und widerspruechliche Dokumentstaende sichtbar machen.",
    criteria: ["Genehmigungsmappe vollstaendig", "Kosten- und Terminannahmen verlinkt", "Behoerdenfragen als Journal refs", "Freigabe durch Bauherr dokumentiert"],
  },
  workload: {
    type: "ProjectPreparedWorkload",
    ref: "workload:lp3-genehmigungscheck:002",
    context: ["documents.lp3", "costs.din276", "calendar.milestones", "journal.decisions", "source.mail.imap"],
    mutable: ["ProjectTask", "ProjectRiskNote", "ProjectJournalDraft"],
    handoff: "Wenn ein fehlender Nachweis eine neue Rolle, neue Einwilligung oder breiteren Dokumentzugriff braucht, Rueckgabe an Architekt statt Autokorrektur.",
  },
  run: {
    type: "ProjectAIRun",
    ref: "run:2026-05-27T17:40Z",
    steps: [
      ["inspect", "Quellen und Rollenrechte gelesen"],
      ["prepare", "Genehmigungscheck auf LP3/LP4 begrenzt"],
      ["analyze", "3 offene Nachweise und 1 Rollenfrage gefunden"],
      ["review", "Architekt prueft Vorschlaege"],
      ["digest", "Entscheidung in Goal Book und Journal zurueckschreiben"],
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
    type: "ImapAccountSettings",
    section: "sourceImap",
    module: "@refinio/source.imap",
    accountId: "demo-kita-2028-project-mail",
    host: "imap.architekt.example",
    port: 993,
    secure: true,
    user: "projekt-demo-kita-2028@example.org",
    mailbox: "INBOX/Demo: Kita 2028",
    enabled: true,
    hasPassword: true,
    secretProviderKey: "source.imap.password:demo-kita-2028-project-mail",
  },
};

const onePackageOwners = [
  ["@refinio/one.core", "content-addressed objects, recipes, access and storage"],
  ["@refinio/one.models", "runtime models, channels, Leute/contact model and MultiUser wiring"],
  ["@refinio/settings.core", "UISettings, SettingsPlan and SecretsPlan"],
  ["@refinio/source.core", "Source, SourceEntry, SourceRun, Book and provenance contracts"],
  ["@refinio/trust.core", "trust relationships, role evidence, revocation and verification"],
  ["@refinio/calendar.core", "calendar events and schedule projection when project dates become real objects"],
  ["@refinio/chat.core", "project chat/conversation primitives instead of custom message storage"],
  ["@refinio/refinio.api", "ModuleRegistry demand/supply and public operation registration"],
];

const mailPreview = [
  ["Heute", "Bauherr", "Kostenberechnung LP3 freigeben", "entscheidung"],
  ["Gestern", "Behoerde", "Rueckfrage Stellplatznachweis", "lp4"],
  ["Mo", "Fachplaner TGA", "Energieannahmen aktualisiert", "nachhaltigkeit"],
];

const dataImportModel = {
  type: "ProjectSettingsDataImport",
  source: "settings-data",
  workbookSheets: [
    ["Beteiligte", "ProjectParticipantImport", 42, "Heads, Stellvertreter, Gewerke und Kontaktrollen"],
    ["Rollen", "ProjectRoleAssignmentImport", 18, "Rollen-Zertifikate, Delegation und LP-Begrenzung"],
    ["Termine", "ProjectCalendarImport", 26, "Gremientermine, Behoerdenfristen und Bauzeitenplan"],
    ["Dokumente", "ProjectDocumentRefImport", 64, "Planstaende, Nachweise, Freigaben und Hash-Referenzen"],
    ["Mail Mapping", "ProjectMailMappingImport", 12, "IMAP Absender, Betreffmuster und Projektkanalzuordnung"],
  ],
  previewRows: [
    ["Bauherr Darmstadt", "ProjectOwnerRoleCertificate", "project.mail", "voll"],
    ["Amt Bauaufsicht", "AuthorityRoleCertificate", "documents.lp4", "begrenzt bis LP4"],
    ["TGA Fachplanung", "ProjectContributorRoleCertificate", "documents.lp5", "Planstand lesen/schreiben"],
    ["Gewerk Rohbau", "TradeRoleCertificate", "site.lp8", "begrenzt ab LP6"],
  ],
};

const exportBundleModel = {
  type: "ProjectDataExportBundle",
  ref: "export:demo-kita-2028:full",
  sections: [
    ["Context", "Project, active LP, owner identity, export time"],
    ["Participants", "ProjectParticipant + RoleCertificate projections"],
    ["Channels", "ChannelInfo ids, access posture, source.mail mappings"],
    ["Documents", "ProjectDocumentRef rows with current status"],
    ["Mail", "SourceEntry refs from source.mail/source.imap"],
    ["AI", "ProjectGoal, ProjectPreparedWorkload, ProjectAIRun refs"],
    ["Journal", "ProjectJournalEntry audit trail"],
    ["Settings", "UISettings and sourceImap account metadata"],
  ],
  warnings: [
    "Use ../one package owners when a primitive already exists; projektor.one owns only project-specific semantics.",
    "SecretsPlan values are never exported, only provider keys and hasSecret state.",
    "Channel access is exported as posture metadata; object grants remain runtime-owned.",
  ],
};

const journalBase = [
  ["2026-05-27 09:12", "RoleCertificateIssued", "Architekt laedt Bauherr Head per Link ein.", "obj:role-cert:81ac"],
  ["2026-05-27 10:35", "ProjectDocumentRefStored", "Entwurf LP3 Version 14 im Dokumentenkanal freigegeben.", "obj:doc-ref:2f19"],
  ["2026-05-27 11:48", "ProjectDecisionRecorded", "Kostenberechnung wird als Grundlage fuer Gremientermin markiert.", "obj:decision:7c02"],
  ["2026-05-27 13:05", "PreparedWorkloadCreated", "AI-Pruefung fuer LP3 zu LP4 vorbereitet.", "obj:workload:44b9"],
  ["2026-05-27 13:31", "SettingsSectionUpdated", "sourceImap Account-Metadaten aktualisiert; Secret bleibt in SecretsPlan.", "obj:settings:sourceImap"],
  ["2026-05-27 13:46", "ProjectDataExportPrepared", "Export-Bundle mit Beteiligten, Rollen, Dokumenten, Mail-Refs, Settings und Journal vorbereitet.", "obj:export:project"],
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

function renderTrustCard(title, text, ref) {
  return el("article", { className: "onboarding-info-card" }, [
    el("span", { className: "card-kicker", text: ref }),
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
        renderTrustCard(onb("nextStoreTitle"), onb("nextStore"), "web.appstore"),
        renderTrustCard(onb("localPromiseTitle"), onb("localPromise"), "local.browser.data"),
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
        el("div", {}, [
          el("span", { className: "card-kicker", text: "projektor.one" }),
          el("strong", { text: tr("topEyebrow") }),
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
        el("span", { className: "card-kicker", text: "ProjectChannel" }),
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
      el("li", {}, [el("span", { text: "Identity field" }), el("strong", { text: "projectId + role + personId" })]),
      el("li", {}, [el("span", { text: "Sharing boundary" }), el("strong", { text: "ChannelInfo idHash" })]),
      el("li", {}, [el("span", { text: "Revocation" }), el("strong", { text: "Journal + access update" })]),
    ]),
  );

  const table = el("table", { className: "matrix-table" });
  const roleKeys = Object.keys(roles);
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Kanal" }),
        el("th", { text: "ONE Objekt" }),
        ...roleKeys.map((key) => el("th", { text: roles[key].label })),
      ]),
    ]),
    el("tbody", {}, channels.map((channel) =>
      el("tr", {}, [
        el("td", { text: channel.name }),
        el("td", { text: channel.object }),
        ...roleKeys.map((key) => {
          const access = channel.access[key] || "none";
          const label = access === "full" ? "voll" : access === "limited" ? "begrenzt" : "-";
          return el("td", {}, [el("span", { className: `access-chip ${access}`, text: label })]);
        }),
      ]),
    )),
  );
  document.querySelector("#channelMatrix").replaceChildren(table);
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
      el("li", {}, [el("span", { text: "ProjectPhaseState" }), el("strong", { text: phase.id })]),
      el("li", {}, [el("span", { text: "Aktuelles Risiko" }), el("strong", { text: phase.risk })]),
      el("li", {}, [el("span", { text: "AI Policy" }), el("strong", { text: "nur Hinweise, keine Freigabe" })]),
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
    el("h3", { text: "Gelesene Kanaele" }),
    el("ul", { className: "run-steps" }, ai.workload.context.map((item) => el("li", {}, [el("span", { text: item }), el("strong", { text: "read" })]))),
    el("h3", { text: "Schreibbarer Scope" }),
    el("ul", { className: "run-steps" }, ai.workload.mutable.map((item) => el("li", {}, [el("span", { text: item }), el("strong", { text: "write" })]))),
    el("p", { text: ai.workload.handoff }),
  );

  document.querySelector("#runBook").replaceChildren(
    bookTop(ai.run.type, ai.run.ref),
    el("h3", { text: "Gebundener Versuch" }),
    el("p", { text: "Dieser Lauf ist eine Projektion aus dauerhaften Objekten: Ziel, Workload, Quellen, Analyse, Review und Digest." }),
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
      el("li", {}, [el("span", { text: tr("parser") }), el("strong", { text: "Flexibel-style workbook" })]),
      el("li", {}, [el("span", { text: tr("importSource") }), el("strong", { text: dataImportModel.source })]),
    ]),
  );

  document.querySelector("#importPreview").replaceChildren(
    bookTop(dataImportModel.type, "workbook:demo-kita-2028-import"),
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
        el("th", { text: "Kanal" }),
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
    "ProjectJournalEntry",
    "Demo-Sync hat Status, Kanalzugriffe und AI Run Book als Projektion aktualisiert.",
    "obj:journal:demo-" + String(index + 1).padStart(2, "0"),
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
  document.querySelector("#imapSecret").value = imap.hasPassword ? "stored-secret-ref" : "";
  document.querySelector("#imapMailbox").value = imap.mailbox;

  renderSettingsSummary();
  renderMailPreview();
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
    idle: state.language === "de" ? "nicht geprueft" : state.language === "fr" ? "non vérifié" : state.language === "es" ? "no comprobado" : "not checked",
    checking: state.language === "de" ? "prueft" : state.language === "fr" ? "vérification" : state.language === "es" ? "comprobando" : "checking",
    ok: state.language === "de" ? "bereit" : state.language === "fr" ? "prêt" : state.language === "es" ? "listo" : "ready",
    failed: state.language === "de" ? "Konfiguration unvollstaendig" : state.language === "fr" ? "configuration incomplète" : state.language === "es" ? "configuración incompleta" : "configuration incomplete",
  }[state.imapStatus];

  document.querySelector("#settingsSummary").replaceChildren(
    bookTop("settings.core", "settings:ui+sourceImap"),
    el("p", {
      text: tr("settingsText"),
    }),
    el("ul", { className: "object-list" }, [
      el("li", {}, [el("span", { text: "UI theme" }), el("strong", { text: settingsModel.ui.theme })]),
      el("li", {}, [el("span", { text: "SettingsPlan section" }), el("strong", { text: imap.section })]),
      el("li", {}, [el("span", { text: "Domain module" }), el("strong", { text: imap.module })]),
      el("li", {}, [el("span", { text: "Secret provider" }), el("strong", { text: imap.secretProviderKey })]),
      el("li", {}, [el("span", { text: "IMAP status" }), el("strong", { text: statusText })]),
      el("li", {}, [el("span", { text: "../one rule" }), el("strong", { text: "reuse before steering-specific code" })]),
    ]),
    el("h3", { text: "Local onboarding" }),
    el("ul", { className: "object-list" }, [
      el("li", {}, [el("span", { text: onb("reviewName") }), el("strong", { text: localStorage.getItem("projektor-profile-name") || state.onboarding.name || "-" })]),
      el("li", {}, [el("span", { text: onb("reviewEmail") }), el("strong", { text: localStorage.getItem("projektor-profile-email") || state.onboarding.email || "-" })]),
      el("li", {}, [el("span", { text: onb("statsStep") }), el("strong", { text: localStorage.getItem("projektor-usage-stats") === "true" ? onb("reviewStatsOn") : onb("reviewStatsOff") })]),
    ]),
    el("div", { className: "settings-actions" }, [
      el("button", { className: "secondary-action", id: "resetOnboarding", type: "button", text: onb("resetOnboarding") }),
      el("a", { className: "secondary-action doc-link", href: "./docs/projektor-onboarding-mrd.md", text: "MRD" }),
      el("a", { className: "secondary-action doc-link", href: "./docs/projektor-onboarding-prd.md", text: "PRD" }),
    ]),
    el("h3", { text: tr("oneOwners") }),
    el("ul", { className: "topic-list" }, onePackageOwners.map(([pkg, owner]) =>
      el("li", {}, [
        el("strong", { text: pkg }),
        el("span", { text: owner }),
      ]),
    )),
  );
}

function renderMailPreview() {
  document.querySelector("#mailPreview").replaceChildren(
    bookTop("source.mail projection", "source:imap:demo-kita-2028"),
    el("h3", { text: "Projektmail als Quelle" }),
    el("p", {
      text:
        "IMAP wird als externe Quelle eingebunden. Nachrichten werden zu SourceEntry/ProjectMailRef-Projektionen, nicht zu unkontrollierten Kopien.",
    }),
    el("ul", { className: "topic-list" }, mailPreview.map(([date, sender, subject, tag]) =>
      el("li", {}, [
        el("strong", { text: subject }),
        el("span", { text: `${date} · ${sender} · ${tag}` }),
      ]),
    )),
  );
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
  settingsModel.imap.secretProviderKey = `source.imap.password:${settingsModel.imap.accountId || "missing-account"}`;
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
  const headers = ["Name", "Rolle", "Kanal", "Zugriff", "Leistungsphase", "E-Mail", "Hinweis"];
  const rows = [
    ["Bauherr Darmstadt", "ProjectOwnerRoleCertificate", "project.mail", "voll", "LP1-LP9", "bauherr@example.org", "Head"],
    ["Amt Bauaufsicht", "AuthorityRoleCertificate", "documents.lp4", "begrenzt", "LP4", "amt@example.org", "Behoerde"],
    ["Gewerk Rohbau", "TradeRoleCertificate", "site.lp8", "begrenzt", "LP6-LP8", "rohbau@example.org", "Ausfuehrung"],
  ];
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  state.journalExtra += 1;
  renderJournal();
  downloadTextFile("projektor-one-import-template.csv", "text/csv;charset=utf-8", csv);
}

function exportProjectBundle() {
  const bundle = {
    $type$: exportBundleModel.type,
    exportedAt: new Date().toISOString(),
    project: {
      id: demoProject.id,
      title: projectText("titles"),
      subtitle: projectText("subtitles"),
      activePhase: state.activePhase,
      syncAgeMinutes: state.syncCount,
    },
    roles,
    channels,
    settings: {
      ui: settingsModel.ui,
      sourceImap: {
        ...settingsModel.imap,
        password: undefined,
        accessToken: undefined,
      },
    },
    onePackageOwners,
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

render();
bindActions();
