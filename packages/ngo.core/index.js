export const NGO_CAPABILITY = {
  capabilityId: "projektor.ngo",
  label: "NGO",
  kind: "project-type",
  domains: ["ngo.donors", "ngo.participants", "ngo.safeguarding", "ngo.visa-deadlines"],
  inputShapes: ["ngo-backup", "ngo-csv"],
  outputShapes: ["ngo-person-export", "ngo-donation-export", "ngo-participant-export", "ngo-backup"],
  effects: ["manage", "search", "sort", "filter", "export", "backup", "restore"],
  tags: ["local-first", "donation-ledger", "participant-program", "gdpr-retention"],
};

export const DONATION_TYPES = ["Spende", "Mitgliedsbeitrag", "Dauerspende"];
export const NGO_DONOR_TYPE = "NgoDonor";
export const NGO_DONATION_TYPE = "NgoDonation";
export const NGO_DONOR_CHANGE_TYPE = "NgoDonorChange";
export const NGO_ONE_SCHEMA_VERSION = "0.1.0";

export const NgoDonationRecipe = {
  $type$: "Recipe",
  name: NGO_DONATION_TYPE,
  rule: [
    { itemprop: "donationId", itemtype: { type: "string" }, isId: true },
    { itemprop: "donor", itemtype: { type: "referenceToId", allowedTypes: new Set([NGO_DONOR_TYPE]) } },
    { itemprop: "type", itemtype: { type: "string" } },
    { itemprop: "amount", itemtype: { type: "number" } },
    { itemprop: "date", itemtype: { type: "string" } },
    { itemprop: "purpose", itemtype: { type: "string" } },
    { itemprop: "thanked", itemtype: { type: "boolean" } },
    { itemprop: "createdAt", itemtype: { type: "number" } },
    { itemprop: "updatedAt", itemtype: { type: "number" } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};

export const NgoDonorRecipe = {
  $type$: "Recipe",
  name: NGO_DONOR_TYPE,
  rule: [
    { itemprop: "donorId", itemtype: { type: "string" }, isId: true },
    { itemprop: "name", itemtype: { type: "string" } },
    { itemprop: "isMember", itemtype: { type: "boolean" } },
    { itemprop: "email", itemtype: { type: "string" }, optional: true },
    { itemprop: "phone", itemtype: { type: "string" }, optional: true },
    { itemprop: "street", itemtype: { type: "string" }, optional: true },
    { itemprop: "postalCode", itemtype: { type: "string" }, optional: true },
    { itemprop: "city", itemtype: { type: "string" }, optional: true },
    { itemprop: "memberSince", itemtype: { type: "string" }, optional: true },
    { itemprop: "recurringDonor", itemtype: { type: "boolean" } },
    { itemprop: "thanked", itemtype: { type: "boolean" } },
    { itemprop: "asked", itemtype: { type: "boolean" } },
    { itemprop: "emailMarketingConsent", itemtype: { type: "boolean" } },
    { itemprop: "receiptSentAt", itemtype: { type: "string" }, optional: true },
    { itemprop: "tags", itemtype: { type: "array", item: { type: "string" } } },
    { itemprop: "notes", itemtype: { type: "string" }, optional: true },
    { itemprop: "donations", itemtype: { type: "array", item: { type: "referenceToId", allowedTypes: new Set([NGO_DONATION_TYPE]) } } },
    { itemprop: "updatedAt", itemtype: { type: "number" } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};

export const NgoDonorChangeRecipe = {
  $type$: "Recipe",
  name: NGO_DONOR_CHANGE_TYPE,
  rule: [
    { itemprop: "changeId", itemtype: { type: "string" }, isId: true },
    { itemprop: "donor", itemtype: { type: "referenceToId", allowedTypes: new Set([NGO_DONOR_TYPE]) } },
    { itemprop: "kind", itemtype: { type: "string" } },
    { itemprop: "createdAt", itemtype: { type: "number" } },
    { itemprop: "previousDonorVersion", itemtype: { type: "referenceToObj", allowedTypes: new Set([NGO_DONOR_TYPE]) }, optional: true },
    { itemprop: "nextDonorVersion", itemtype: { type: "referenceToObj", allowedTypes: new Set([NGO_DONOR_TYPE]) }, optional: true },
    { itemprop: "donation", itemtype: { type: "referenceToId", allowedTypes: new Set([NGO_DONATION_TYPE]) }, optional: true },
    { itemprop: "reason", itemtype: { type: "string" }, optional: true },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};

export const NgoCoreRecipes = [NgoDonorRecipe, NgoDonationRecipe, NgoDonorChangeRecipe];
export const NgoCoreReverseMaps = [
  [NGO_DONOR_TYPE, new Set(["donations"])],
  [NGO_DONOR_CHANGE_TYPE, new Set(["donor", "previousDonorVersion", "nextDonorVersion", "donation"])],
];
export const NgoCoreReverseMapsForIdObjects = [];
export const PARTICIPANT_MAIN_STAGES = [
  "Erstkontakt",
  "Aufnahme",
  "Eingewöhnung",
  "Deutschkurs",
  "Bildung / Ausbildung",
  "Übergang in Arbeit",
  "Verselbstständigung",
  "Ehemalige",
];
export const GERMAN_COURSE_STATES = ["interessiert", "läuft", "abgeschlossen", "nicht relevant"];
export const TRAINING_STATES = [
  "kein Thema",
  "sucht Ausbildungsplatz",
  "Bewerbungsphase",
  "Vertrag abgeschlossen",
  "in Ausbildung",
  "abgeschlossen",
];

const YEARLY_RECEIPT_THRESHOLD_EUR = 300;
const VISA_ALERT_LEAD_DAYS = 45;
const TODAY_UTC = "2026-06-03";

export function createNgoProjectData(overrides = {}) {
  return normalizeNgoProjectData({
    schemaVersion: "0.1.0",
    capability: NGO_CAPABILITY,
    settings: {
      receiptThresholdEur: YEARLY_RECEIPT_THRESHOLD_EUR,
      visaAlertLeadDays: VISA_ALERT_LEAD_DAYS,
      retentionPolicy: "Bei Austritt zu Ehemalige werden nicht mehr erforderliche Daten gelöscht; aufbewahrungspflichtige Spenden- und Abschlussvermerke bleiben nach DSGVO-Regel dokumentiert.",
    },
    donors: [],
    participants: [],
    ...overrides,
  });
}

export function createNgoDemoProjectData() {
  return createNgoProjectData({
    donors: [
      {
        id: "donor-anne-keller",
        name: "Anne Keller",
        isMember: true,
        email: "anne.keller@example.org",
        phone: "+49 6151 123456",
        street: "Mauerstraße 14",
        postalCode: "64283",
        city: "Darmstadt",
        memberSince: "2024-03-01",
        recurringDonor: true,
        thanked: true,
        asked: true,
        emailMarketingConsent: true,
        receiptSentAt: "2026-02-05",
        tags: ["Patin", "Newsletter"],
        notes: "Möchte zum Jahresbericht eingeladen werden.",
        donations: [
          { id: "don-001", type: "Mitgliedsbeitrag", amount: 120, date: "2026-01-10", purpose: "Jahresbeitrag" },
          { id: "don-002", type: "Dauerspende", amount: 50, date: "2026-02-10", purpose: "Programm allgemein" },
          { id: "don-003", type: "Dauerspende", amount: 50, date: "2026-03-10", purpose: "Programm allgemein" },
        ],
      },
      {
        id: "donor-murat-demir",
        name: "Murat Demir",
        isMember: false,
        email: "murat.demir@example.org",
        phone: "+49 6151 223344",
        street: "Rheinstraße 71",
        postalCode: "64295",
        city: "Darmstadt",
        memberSince: "",
        recurringDonor: false,
        thanked: false,
        asked: true,
        emailMarketingConsent: false,
        receiptSentAt: "",
        tags: ["Großspende"],
        notes: "Telefonisch nach Projektbesuch fragen.",
        donations: [
          { id: "don-004", type: "Spende", amount: 500, date: "2026-04-18", purpose: "Bildung / Ausbildung" },
        ],
      },
      {
        id: "donor-lena-schulz",
        name: "Lena Schulz",
        isMember: true,
        email: "lena.schulz@example.org",
        phone: "",
        street: "Heidelberger Straße 28",
        postalCode: "64285",
        city: "Darmstadt",
        memberSince: "2025-09-15",
        recurringDonor: false,
        thanked: false,
        asked: false,
        emailMarketingConsent: true,
        receiptSentAt: "",
        tags: ["Ehrenamt"],
        notes: "Kann bei Sprachkurs-Material helfen.",
        donations: [
          { id: "don-005", type: "Mitgliedsbeitrag", amount: 60, date: "2026-01-15", purpose: "Mitgliedschaft" },
          { id: "don-006", type: "Spende", amount: 80, date: "2026-05-22", purpose: "Deutschkurs" },
        ],
      },
    ],
    participants: [
      {
        id: "participant-maya-rai",
        firstName: "Maya",
        lastName: "Rai",
        birthday: "2006-10-12",
        birthPlace: "Pokhara",
        familyStatus: "ledig",
        idNumber: "NPL-AX-40291",
        program: {
          admissionDate: "2025-11-03",
          currentStage: "Deutschkurs",
          collaboration: "aktiv",
          supervisedBy: "Sabine Reuter",
          selfCommitment: { signed: true, date: "2025-11-04" },
        },
        visa: { relevant: true, kind: "Ausbildungsvorbereitung", appliedAt: "2026-03-02", deadline: "2026-07-15" },
        languageEducation: { germanCourseStatus: "läuft", courseLevel: "B1 Integrationskurs", languages: "Nepali, Hindi, Englisch" },
        training: { status: "Bewerbungsphase", schoolDegree: "Secondary School", education: "Brückenkurs", careerWish: "Pflege", job: "", interests: "Kochen, soziale Arbeit", skills: "Basis-PC, Teamarbeit" },
        sensitive: { caste: "nicht erfasst", hasChildren: false, childCount: 0, familySituation: "Eltern im Ausland", healthMedication: "regelmäßige Kontrolle", specialNotes: "Prüfungsangst beachten" },
        relatives: [{ participantId: "participant-sita-rai", relation: "Cousine" }],
        notes: "Betreuungsgespräch für November vormerken.",
      },
      {
        id: "participant-sita-rai",
        firstName: "Sita",
        lastName: "Rai",
        birthday: "2009-02-04",
        birthPlace: "Kathmandu",
        familyStatus: "ledig",
        idNumber: "NPL-MN-99812",
        program: {
          admissionDate: "2026-01-18",
          currentStage: "Eingewöhnung",
          collaboration: "aktiv",
          supervisedBy: "Nadia Berger",
          selfCommitment: { signed: false, date: "" },
        },
        visa: { relevant: true, kind: "Schülerinnenvisum", appliedAt: "2026-04-20", deadline: "2026-06-28" },
        languageEducation: { germanCourseStatus: "interessiert", courseLevel: "A2 Start geplant", languages: "Nepali, Hindi" },
        training: { status: "kein Thema", schoolDegree: "laufend", education: "Schule", careerWish: "offen", job: "", interests: "Musik", skills: "Deutsch A1" },
        sensitive: { caste: "nicht erfasst", hasChildren: false, childCount: 0, familySituation: "Halbwaise", healthMedication: "keine Dauermedikation", specialNotes: "Minderjährig: Vormundschaft beachten" },
        relatives: [{ participantId: "participant-maya-rai", relation: "Cousine" }],
        notes: "Keine Selbstverpflichtung, Safeguarding-Pfad aktiv halten.",
      },
      {
        id: "participant-aisha-noor",
        firstName: "Aisha",
        lastName: "Noor",
        birthday: "2001-07-29",
        birthPlace: "Dhaka",
        familyStatus: "verheiratet",
        idNumber: "BGD-78221",
        program: {
          admissionDate: "2024-09-01",
          currentStage: "Übergang in Arbeit",
          collaboration: "aktiv",
          supervisedBy: "Sabine Reuter",
          selfCommitment: { signed: true, date: "2024-09-02" },
        },
        visa: { relevant: false, kind: "", appliedAt: "", deadline: "" },
        languageEducation: { germanCourseStatus: "abgeschlossen", courseLevel: "B2 abgeschlossen", languages: "Bengali, Englisch, Deutsch" },
        training: { status: "Vertrag abgeschlossen", schoolDegree: "Higher Secondary", education: "Pflegehelferin", careerWish: "Pflegefachkraft", job: "Seniorenzentrum Darmstadt", interests: "Gesundheit", skills: "Pflegepraktikum, Deutsch B2" },
        sensitive: { caste: "nicht relevant", hasChildren: true, childCount: 1, familySituation: "Eltern im Ausland", healthMedication: "keine", specialNotes: "Kinderbetreuung bei Arbeitszeiten prüfen" },
        relatives: [],
        notes: "Arbeitsvertrag ab 01.08.2026 prüfen.",
      },
    ],
  });
}

export function normalizeNgoProjectData(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    schemaVersion: source.schemaVersion || "0.1.0",
    capability: { ...NGO_CAPABILITY, ...(source.capability || {}) },
    settings: {
      receiptThresholdEur: Number(source.settings?.receiptThresholdEur || YEARLY_RECEIPT_THRESHOLD_EUR),
      visaAlertLeadDays: Number(source.settings?.visaAlertLeadDays || VISA_ALERT_LEAD_DAYS),
      retentionPolicy: source.settings?.retentionPolicy || "",
    },
    donors: Array.isArray(source.donors) ? source.donors.map(normalizeDonor) : [],
    participants: Array.isArray(source.participants) ? source.participants.map(normalizeParticipant) : [],
  };
}

export function addNgoDonor(data, { name, isMember = false } = {}) {
  const normalized = normalizeNgoProjectData(data);
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw new Error("Name is required.");
  normalized.donors.push(normalizeDonor({
    id: stableSlug("donor", trimmedName, normalized.donors.length + 1),
    name: trimmedName,
    isMember,
    thanked: false,
    asked: false,
    emailMarketingConsent: false,
    donations: [],
  }));
  return normalized;
}

export function addNgoDonation(data, { donorId, type, amount, date, purpose = "", thanked = false, now = Date.now() } = {}) {
  const normalized = normalizeNgoProjectData(data);
  const donorIndex = normalized.donors.findIndex((donor) => donor.id === donorId);
  if (donorIndex < 0) throw new Error("Donor not found.");
  const previousDonor = normalizeDonor(normalized.donors[donorIndex]);
  const donation = normalizeDonation({
    id: stableSlug("donation", `${previousDonor.id}-${date || ""}-${amount || 0}-${previousDonor.donations.length + 1}`, 0),
    type,
    amount,
    date,
    purpose,
    thanked,
    createdAt: now,
    updatedAt: now,
  });
  if (!donation.date) throw new Error("Donation date is required.");
  if (!Number.isFinite(donation.amount) || donation.amount <= 0) throw new Error("Donation amount must be positive.");
  const donor = normalizeDonor({
    ...previousDonor,
    thanked: previousDonor.thanked && donation.thanked,
    donations: [...previousDonor.donations, donation],
    updatedAt: now,
  });
  normalized.donors[donorIndex] = donor;
  return { data: normalized, donor, donation };
}

export function addNgoParticipant(data, { firstName, lastName } = {}) {
  const normalized = normalizeNgoProjectData(data);
  const trimmedFirstName = String(firstName || "").trim();
  const trimmedLastName = String(lastName || "").trim();
  if (!trimmedFirstName || !trimmedLastName) throw new Error("First and last name are required.");
  normalized.participants.push(normalizeParticipant({
    id: stableSlug("participant", `${trimmedFirstName}-${trimmedLastName}`, normalized.participants.length + 1),
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    program: { currentStage: PARTICIPANT_MAIN_STAGES[0] },
  }));
  return normalized;
}

export function donorMetrics(data) {
  const normalized = normalizeNgoProjectData(data);
  const donors = normalized.donors.map((donor) => donorPersona(donor, normalized.settings.receiptThresholdEur));
  const total = donors.reduce((sum, donor) => sum + donor.totalAmount, 0);
  return {
    supporterCount: donors.length,
    totalReceived: roundMoney(total),
    openThanks: donors.filter((donor) => donor.needsThanks).length,
    members: donors.filter((donor) => donor.isMember).length,
    recurringDonors: donors.filter((donor) => donor.recurringDonor).length,
    donors,
  };
}

export function participantMetrics(data, today = TODAY_UTC) {
  const normalized = normalizeNgoProjectData(data);
  const participants = normalized.participants.map((participant) => participantPersona(participant, normalized.settings.visaAlertLeadDays, today));
  const ages = participants.map((participant) => participant.age).filter((age) => Number.isFinite(age));
  const averageAge = ages.length ? Math.round((ages.reduce((sum, age) => sum + age, 0) / ages.length) * 10) / 10 : 0;
  return {
    participantCount: participants.length,
    averageAge,
    withChildren: participants.filter((participant) => participant.hasChildren).length,
    inGermanCourse: participants.filter((participant) => participant.germanCourseStatus === "läuft").length,
    openVisaDeadlines: participants.filter((participant) => participant.visaWarning).length,
    participants,
  };
}

export function queryNgoDonors(data, { search = "", sort = "name", onlyOpen = false } = {}) {
  const term = normalizeSearch(search);
  const rows = donorMetrics(data).donors
    .filter((donor) => !term || normalizeSearch([
      donor.name,
      donor.email,
      donor.phone,
      donor.city,
      donor.tags.join(" "),
      donor.notes,
    ].join(" ")).includes(term))
    .filter((donor) => !onlyOpen || donor.needsThanks || donor.receiptNeeded);

  rows.sort((left, right) => compareDonors(left, right, sort));
  return rows;
}

export function queryNgoParticipants(data, { search = "", sort = "name" } = {}, today = TODAY_UTC) {
  const term = normalizeSearch(search);
  const rows = participantMetrics(data, today).participants
    .filter((participant) => !term || normalizeSearch([
      participant.name,
      participant.currentStage,
      participant.supervisedBy,
      participant.familySituation,
      participant.notes,
    ].join(" ")).includes(term));

  rows.sort((left, right) => compareParticipants(left, right, sort));
  return rows;
}

export function csvFromNgoPeople(data) {
  const rows = donorMetrics(data).donors.map((donor) => [
    donor.name,
    donor.isMember ? "ja" : "nein",
    donor.email,
    donor.phone,
    donor.street,
    donor.postalCode,
    donor.city,
    donor.totalAmount,
    donor.entryCount,
    donor.firstDonationDate,
    donor.lastDonationDate,
    donor.largestDonationAmount,
    donor.needsThanks ? "ja" : "nein",
    donor.receiptNeeded ? "ja" : "nein",
    donor.receiptSentAt,
    donor.tags.join("; "),
    donor.notes,
  ]);
  return csv([
    "Name",
    "Mitglied",
    "E-Mail",
    "Telefon",
    "Straße",
    "PLZ",
    "Ort",
    "Gesamt",
    "Anzahl Einträge",
    "Erste Spende",
    "Letzte Spende",
    "Größte Spende",
    "Zu bedanken",
    "Spendenquittung benötigt",
    "Verschickt am",
    "Tags",
    "Notizen",
  ], rows);
}

export function csvFromNgoDonations(data) {
  const normalized = normalizeNgoProjectData(data);
  const donorById = new Map(normalized.donors.map((donor) => [donor.id, donor]));
  const rows = normalized.donors.flatMap((donor) =>
    donor.donations.map((donation) => [
      donor.name,
      donorById.get(donor.id)?.isMember ? "ja" : "nein",
      donation.type,
      donation.amount,
      donation.date,
      donation.purpose,
      donation.thanked ? "ja" : "nein",
    ]),
  );
  return csv(["Person", "Mitglied", "Typ", "Betrag", "Datum", "Verwendungszweck", "Gedankt"], rows);
}

export function csvFromNgoParticipants(data, today = TODAY_UTC) {
  const rows = participantMetrics(data, today).participants.map((participant) => [
    participant.name,
    participant.age,
    participant.currentStage,
    participant.hasChildren ? "ja" : "nein",
    participant.childCount,
    participant.visaDeadline,
    participant.visaWarning ? "ja" : "nein",
    participant.admissionDate,
    participant.supervisedBy,
    participant.germanCourseStatus,
    participant.trainingStatus,
    participant.selfCommitmentRequired ? "ja" : "nein",
    participant.selfCommitmentSigned ? "ja" : "nein",
    participant.notes,
  ]);
  return csv([
    "Name",
    "Alter",
    "Aktueller Stand",
    "Kinder",
    "Anzahl Kinder",
    "Visum-Frist",
    "Visum-Warnung",
    "Aufnahme",
    "Betreut durch",
    "Deutschkurs",
    "Ausbildung",
    "Selbstverpflichtung erforderlich",
    "Selbstverpflichtung unterschrieben",
    "Notizen",
  ], rows);
}

export function createNgoBackup(data) {
  return {
    kind: "projektor.one/ngo-backup",
    schemaVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    ngo: normalizeNgoProjectData(data),
  };
}

export function restoreNgoBackup(payload) {
  if (payload?.kind === "projektor.one/ngo-backup") return normalizeNgoProjectData(payload.ngo);
  return normalizeNgoProjectData(payload?.ngo || payload);
}

export class NgoPlan {
  constructor({ data = createNgoProjectData(), oneCore } = {}) {
    this.data = normalizeNgoProjectData(data);
    this.oneCore = oneCore || null;
  }

  setOneCore(oneCore) {
    this.oneCore = oneCore;
  }

  async init() {
    registerNgoCoreRecipes(this.requireOneCore());
  }

  async getWorkspace() {
    return normalizeNgoProjectData(this.data);
  }

  async replaceWorkspace({ data } = {}) {
    this.data = normalizeNgoProjectData(data);
    return this.getWorkspace();
  }

  async projectWorkspace({ data = this.data, now = Date.now() } = {}) {
    const oneCore = this.requireOneCore();
    const normalized = normalizeNgoProjectData(data);
    const donors = [];
    const donations = [];
    for (const donor of normalized.donors) {
      for (const donation of donor.donations) {
        const obj = await createNgoDonationObject(oneCore, donor, donation, { now });
        donations.push(await oneObjectEnvelope(oneCore, obj));
      }
      const obj = await createNgoDonorObject(oneCore, donor, { now });
      donors.push(await oneObjectEnvelope(oneCore, obj));
    }
    return { donors, donations };
  }

  async addDonation(params = {}) {
    const result = await addNgoDonationVersion(this.data, params, this.requireOneCore());
    this.data = result.data;
    return result;
  }

  getToolDefinitions() {
    return [
      {
        name: "getWorkspace",
        description: "Return the current NGO workspace projection.",
        inputSchema: { type: "object", properties: {} },
        returns: "NGO workspace data",
      },
      {
        name: "addDonation",
        description: "Add a donation as ONE versioned objects and update the donor version.",
        inputSchema: {
          type: "object",
          properties: {
            donorId: { type: "string", description: "Stable donor id." },
            type: { type: "string", enum: DONATION_TYPES, description: "Donation type." },
            amount: { type: "number", description: "Donation amount in EUR." },
            date: { type: "string", description: "ISO date." },
            purpose: { type: "string", description: "Donation purpose." },
            thanked: { type: "boolean", description: "Whether this donation has already been thanked." },
            reason: { type: "string", description: "Human reason for the versioned change." },
          },
          required: ["donorId", "amount", "date"],
        },
        returns: "Updated workspace, stored ONE object refs, and donation details.",
      },
    ];
  }

  getPublicOperation() {
    return {
      getWorkspace: (params) => this.getWorkspace(params),
      replaceWorkspace: (params) => this.replaceWorkspace(params),
      projectWorkspace: (params) => this.projectWorkspace(params),
      addDonation: (params) => this.addDonation(params),
    };
  }

  requireOneCore() {
    return requireNgoOneCore(this.oneCore);
  }
}

export class NgoModule {
  static demands = [
    { targetType: "OneCore", required: true },
    { targetType: "OperationRegistry", required: false },
    { targetType: "NgoWorkspace", required: false },
  ];

  static supplies = [
    { targetType: "NgoPlan" },
  ];

  constructor({ data } = {}) {
    this.name = "NgoModule";
    this.deps = {};
    this.initialData = data;
    this.ngoPlan = null;
  }

  setDependency(targetType, instance) {
    this.deps[targetTypeToDependencyKey(targetType)] = instance;
  }

  async init() {
    const data = this.deps.ngoWorkspace || this.initialData || createNgoProjectData();
    this.ngoPlan = new NgoPlan({ data, oneCore: this.deps.oneCore });
    await this.ngoPlan.init();
  }

  async shutdown() {
    this.deps.operationRegistry?.unregister?.("ngo");
    this.ngoPlan = null;
  }

  emitSupplies(registry) {
    if (!this.ngoPlan) throw new Error("NgoModule has not been initialized.");
    registry.supply("NgoPlan", this.ngoPlan);
    const operationRegistry = this.deps.operationRegistry || registry.getOperationRegistry?.();
    operationRegistry?.register?.("ngo", this.ngoPlan.getPublicOperation(), {
      category: "ngo",
      description: "NGO donor, gift, and participant operations backed by ONE versioned objects.",
      methods: [
        { name: "getWorkspace", description: "Return the current NGO workspace projection." },
        { name: "replaceWorkspace", description: "Replace the in-memory NGO workspace projection." },
        { name: "projectWorkspace", description: "Project NGO workspace records to ONE object envelopes." },
        { name: "addDonation", description: "Add a gift and create the corresponding ONE versions." },
      ],
      tools: this.ngoPlan.getToolDefinitions(),
    });
  }
}

export function createNgoModule(options = {}) {
  return new NgoModule(options);
}

export function registerNgoCoreRecipes(oneCore) {
  const runtime = requireNgoOneCore(oneCore);
  for (const recipe of NgoCoreRecipes) {
    if (!runtime.hasRecipe(recipe.name)) runtime.addRecipeToRuntime(recipe);
  }
}

export function createNgoRecipeRuntimeConfig({
  recipes = [],
  reverseMaps = [],
  reverseMapsForIdObjects = [],
} = {}) {
  return {
    recipes: [...NgoCoreRecipes, ...recipes],
    reverseMaps: mergeReverseMapEntries([...NgoCoreReverseMaps, ...reverseMaps]),
    reverseMapsForIdObjects: mergeReverseMapEntries([...NgoCoreReverseMapsForIdObjects, ...reverseMapsForIdObjects]),
  };
}

export async function createNgoDonationObject(oneCore, donor, donation, { now = Date.now() } = {}) {
  const runtime = requireNgoOneCore(oneCore);
  registerNgoCoreRecipes(runtime);
  const normalizedDonor = normalizeDonor(donor);
  const normalizedDonation = normalizeDonation(donation);
  const donorIdHash = await runtime.calculateIdHashOfObj(createNgoDonorIdObject(normalizedDonor.id));
  return {
    $type$: NGO_DONATION_TYPE,
    donationId: normalizedDonation.id,
    donor: donorIdHash,
    type: normalizedDonation.type,
    amount: normalizedDonation.amount,
    date: normalizedDonation.date,
    purpose: normalizedDonation.purpose,
    thanked: normalizedDonation.thanked,
    createdAt: Number(donation.createdAt || now),
    updatedAt: Number(donation.updatedAt || now),
    schemaVersion: NGO_ONE_SCHEMA_VERSION,
  };
}

export async function createNgoDonorObject(oneCore, donor, { now = Date.now() } = {}) {
  const runtime = requireNgoOneCore(oneCore);
  registerNgoCoreRecipes(runtime);
  const normalized = normalizeDonor(donor);
  const donations = [];
  for (const donation of normalized.donations) {
    donations.push(await runtime.calculateIdHashOfObj(createNgoDonationIdObject(donation.id)));
  }
  return stripUndefined({
    $type$: NGO_DONOR_TYPE,
    donorId: normalized.id,
    name: normalized.name,
    isMember: normalized.isMember,
    email: normalized.email || undefined,
    phone: normalized.phone || undefined,
    street: normalized.street || undefined,
    postalCode: normalized.postalCode || undefined,
    city: normalized.city || undefined,
    memberSince: normalized.memberSince || undefined,
    recurringDonor: normalized.recurringDonor,
    thanked: normalized.thanked,
    asked: normalized.asked,
    emailMarketingConsent: normalized.emailMarketingConsent,
    receiptSentAt: normalized.receiptSentAt || undefined,
    tags: normalized.tags,
    notes: normalized.notes || undefined,
    donations,
    updatedAt: Number(donor.updatedAt || now),
    schemaVersion: NGO_ONE_SCHEMA_VERSION,
  });
}

export async function addNgoDonationVersion(data, { donorId, type, amount, date, purpose = "", thanked = false, reason = "", now = Date.now() } = {}, oneCore) {
  const runtime = requireNgoOneCore(oneCore);
  registerNgoCoreRecipes(runtime);
  const normalized = normalizeNgoProjectData(data);
  const donorIndex = normalized.donors.findIndex((donor) => donor.id === donorId);
  if (donorIndex < 0) throw new Error("Donor not found.");
  const previousDonor = normalizeDonor(normalized.donors[donorIndex]);
  const donation = normalizeDonation({
    id: stableSlug("donation", `${previousDonor.id}-${date || ""}-${amount || 0}-${previousDonor.donations.length + 1}`, 0),
    type,
    amount,
    date,
    purpose,
    thanked,
    createdAt: now,
    updatedAt: now,
  });
  const nextDonor = normalizeDonor({
    ...previousDonor,
    thanked: previousDonor.thanked && donation.thanked,
    donations: [...previousDonor.donations, donation],
    updatedAt: now,
  });
  const previousDonorObject = await createNgoDonorObject(runtime, previousDonor, { now });
  const donationObject = await createNgoDonationObject(runtime, nextDonor, donation, { now });
  const nextDonorObject = await createNgoDonorObject(runtime, nextDonor, { now });
  const previousStored = await storeNgoVersionedObject(runtime, previousDonorObject);
  const donationStored = await storeNgoVersionedObject(runtime, donationObject);
  const nextStored = await storeNgoVersionedObject(runtime, nextDonorObject);
  const changeObject = await createNgoDonorChangeObject(runtime, {
    donor: nextDonor,
    kind: "donation-added",
    previousDonorVersionHash: previousStored.hash,
    nextDonorVersionHash: nextStored.hash,
    donationIdHash: donationStored.idHash,
    reason,
    now,
  });
  const changeStored = await storeNgoVersionedObject(runtime, changeObject);
  normalized.donors[donorIndex] = nextDonor;
  return {
    data: normalized,
    donor: nextDonor,
    donation,
    one: {
      previousDonor: previousStored,
      donation: donationStored,
      nextDonor: nextStored,
      change: changeStored,
    },
  };
}

async function createNgoDonorChangeObject(oneCore, {
  donor,
  kind,
  previousDonorVersionHash,
  nextDonorVersionHash,
  donationIdHash,
  reason = "",
  now = Date.now(),
} = {}) {
  const runtime = requireNgoOneCore(oneCore);
  if (!donor) throw new TypeError("donor is required.");
  const changeKind = String(kind || "").trim();
  if (!changeKind) throw new TypeError("kind is required.");
  const normalizedDonor = normalizeDonor(donor);
  const donorRef = await runtime.calculateIdHashOfObj(createNgoDonorIdObject(normalizedDonor.id));
  return stripUndefined({
    $type$: NGO_DONOR_CHANGE_TYPE,
    changeId: stableSlug("ngo-change", `${normalizedDonor.id}-${changeKind}-${now}`, 0),
    donor: donorRef,
    kind: changeKind,
    createdAt: Number(now),
    previousDonorVersion: previousDonorVersionHash || undefined,
    nextDonorVersion: nextDonorVersionHash || undefined,
    donation: donationIdHash || undefined,
    reason: String(reason || "") || undefined,
    schemaVersion: NGO_ONE_SCHEMA_VERSION,
  });
}

function createNgoDonorIdObject(donorId) {
  return { $type$: NGO_DONOR_TYPE, donorId: String(donorId || "") };
}

function createNgoDonationIdObject(donationId) {
  return { $type$: NGO_DONATION_TYPE, donationId: String(donationId || "") };
}

async function oneObjectEnvelope(oneCore, obj) {
  const runtime = requireNgoOneCore(oneCore);
  return {
    obj,
    idHash: await runtime.calculateIdHashOfObj(obj),
    hash: await runtime.calculateHashOfObj(obj),
  };
}

async function storeNgoVersionedObject(oneCore, obj) {
  const runtime = requireNgoOneCore(oneCore);
  if (typeof runtime.storeVersionedObject === "function") {
    const stored = await runtime.storeVersionedObject(obj);
    return {
      obj: stored.obj || obj,
      idHash: stored.idHash,
      hash: stored.hash,
      status: stored.status,
      timestamp: stored.timestamp,
    };
  }
  return oneObjectEnvelope(runtime, obj);
}

function requireNgoOneCore(oneCore) {
  if (!oneCore) throw new Error("NgoPlan requires a OneCore dependency.");
  for (const name of ["hasRecipe", "addRecipeToRuntime", "calculateIdHashOfObj", "calculateHashOfObj"]) {
    if (typeof oneCore[name] !== "function") {
      throw new Error(`OneCore dependency is missing ${name}.`);
    }
  }
  return oneCore;
}

function mergeReverseMapEntries(entries) {
  const merged = new Map();
  for (const [type, properties] of entries) {
    const current = merged.get(type) || new Set();
    for (const property of properties || []) current.add(property);
    merged.set(type, current);
  }
  return merged;
}

function targetTypeToDependencyKey(targetType) {
  const text = String(targetType || "");
  const acronymPrefix = text.match(/^[A-Z]+(?=[A-Z][a-z]|[0-9]|$)/)?.[0];
  if (acronymPrefix) return acronymPrefix.toLowerCase() + text.slice(acronymPrefix.length);
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function normalizeDonor(donor = {}) {
  return {
    id: String(donor.id || stableSlug("donor", donor.name || "person", 0)),
    name: String(donor.name || ""),
    isMember: Boolean(donor.isMember ?? donor.member),
    email: String(donor.email || ""),
    phone: String(donor.phone || ""),
    street: String(donor.street || ""),
    postalCode: String(donor.postalCode || donor.zip || ""),
    city: String(donor.city || ""),
    memberSince: String(donor.memberSince || ""),
    recurringDonor: Boolean(donor.recurringDonor),
    thanked: Boolean(donor.thanked),
    asked: Boolean(donor.asked),
    emailMarketingConsent: Boolean(donor.emailMarketingConsent),
    receiptSentAt: String(donor.receiptSentAt || ""),
    tags: Array.isArray(donor.tags) ? donor.tags.map(String) : [],
    notes: String(donor.notes || ""),
    donations: Array.isArray(donor.donations) ? donor.donations.map(normalizeDonation) : [],
    updatedAt: Number(donor.updatedAt || 0),
  };
}

function normalizeDonation(donation = {}) {
  const type = DONATION_TYPES.includes(donation.type) ? donation.type : DONATION_TYPES[0];
  return {
    id: String(donation.id || stableSlug("donation", `${donation.date || ""}-${donation.amount || 0}`, 0)),
    type,
    amount: Number(donation.amount || 0),
    date: String(donation.date || ""),
    purpose: String(donation.purpose || ""),
    thanked: donation.thanked == null ? true : Boolean(donation.thanked),
  };
}

function normalizeParticipant(participant = {}) {
  const program = participant.program || {};
  const sensitive = participant.sensitive || {};
  const birthday = String(participant.birthday || "");
  const age = ageAt(birthday, TODAY_UTC);
  const isAdult = !Number.isFinite(age) || age >= 18;
  const currentStage = PARTICIPANT_MAIN_STAGES.includes(program.currentStage) ? program.currentStage : PARTICIPANT_MAIN_STAGES[0];

  return {
    id: String(participant.id || stableSlug("participant", `${participant.firstName || ""}-${participant.lastName || ""}`, 0)),
    firstName: String(participant.firstName || ""),
    lastName: String(participant.lastName || ""),
    birthday,
    birthPlace: String(participant.birthPlace || ""),
    familyStatus: String(participant.familyStatus || ""),
    idNumber: String(participant.idNumber || ""),
    program: {
      admissionDate: String(program.admissionDate || ""),
      currentStage,
      collaboration: String(program.collaboration || ""),
      supervisedBy: String(program.supervisedBy || ""),
      selfCommitment: {
        signed: isAdult ? Boolean(program.selfCommitment?.signed) : false,
        date: isAdult ? String(program.selfCommitment?.date || "") : "",
      },
    },
    visa: {
      relevant: Boolean(participant.visa?.relevant),
      kind: String(participant.visa?.kind || ""),
      appliedAt: String(participant.visa?.appliedAt || ""),
      deadline: String(participant.visa?.deadline || ""),
    },
    languageEducation: {
      germanCourseStatus: GERMAN_COURSE_STATES.includes(participant.languageEducation?.germanCourseStatus)
        ? participant.languageEducation.germanCourseStatus
        : GERMAN_COURSE_STATES[3],
      courseLevel: String(participant.languageEducation?.courseLevel || ""),
      languages: String(participant.languageEducation?.languages || ""),
    },
    training: {
      status: TRAINING_STATES.includes(participant.training?.status) ? participant.training.status : TRAINING_STATES[0],
      schoolDegree: String(participant.training?.schoolDegree || ""),
      education: String(participant.training?.education || ""),
      careerWish: String(participant.training?.careerWish || ""),
      job: String(participant.training?.job || ""),
      interests: String(participant.training?.interests || ""),
      skills: String(participant.training?.skills || ""),
    },
    sensitive: {
      caste: String(sensitive.caste || ""),
      hasChildren: Boolean(sensitive.hasChildren),
      childCount: Number(sensitive.childCount || 0),
      familySituation: String(sensitive.familySituation || ""),
      healthMedication: String(sensitive.healthMedication || ""),
      specialNotes: String(sensitive.specialNotes || ""),
    },
    relatives: Array.isArray(participant.relatives)
      ? participant.relatives.map((relative) => ({
          participantId: String(relative.participantId || ""),
          relation: String(relative.relation || ""),
        }))
      : [],
    notes: String(participant.notes || ""),
  };
}

function donorPersona(donor, threshold) {
  const donations = donor.donations.slice().sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const totalAmount = roundMoney(donations.reduce((sum, donation) => sum + donation.amount, 0));
  const largest = donations.reduce((max, donation) => Math.max(max, donation.amount), 0);
  const yearlyTotals = donations.reduce((byYear, donation) => {
    const year = String(donation.date || "").slice(0, 4);
    byYear.set(year, roundMoney((byYear.get(year) || 0) + donation.amount));
    return byYear;
  }, new Map());
  const receiptNeeded = [...yearlyTotals.values()].some((sum) => sum >= threshold) && !donor.receiptSentAt;
  const needsThanks = !donor.thanked || donations.some((donation) => donation.thanked === false);

  return {
    ...donor,
    totalAmount,
    entryCount: donations.length,
    firstDonationDate: donations[0]?.date || "",
    lastDonationDate: donations.at(-1)?.date || "",
    largestDonationAmount: roundMoney(largest),
    needsThanks,
    receiptNeeded,
  };
}

function participantPersona(participant, leadDays, today) {
  const age = ageAt(participant.birthday, today);
  const daysUntilVisaDeadline = participant.visa.relevant && participant.visa.deadline
    ? daysBetween(today, participant.visa.deadline)
    : null;
  const visaWarning = Number.isFinite(daysUntilVisaDeadline) && daysUntilVisaDeadline <= leadDays;
  const isAdult = !Number.isFinite(age) || age >= 18;

  return {
    ...participant,
    name: `${participant.firstName} ${participant.lastName}`.trim(),
    age,
    admissionDate: participant.program.admissionDate,
    currentStage: participant.program.currentStage,
    supervisedBy: participant.program.supervisedBy,
    selfCommitmentRequired: isAdult,
    selfCommitmentSigned: Boolean(participant.program.selfCommitment.signed),
    visaDeadline: participant.visa.deadline,
    daysUntilVisaDeadline,
    visaWarning,
    germanCourseStatus: participant.languageEducation.germanCourseStatus,
    trainingStatus: participant.training.status,
    hasChildren: participant.sensitive.hasChildren,
    childCount: participant.sensitive.childCount,
    familySituation: participant.sensitive.familySituation,
  };
}

function compareDonors(left, right, sort) {
  if (sort === "sum") return right.totalAmount - left.totalAmount || left.name.localeCompare(right.name);
  if (sort === "last") return String(right.lastDonationDate).localeCompare(String(left.lastDonationDate)) || left.name.localeCompare(right.name);
  if (sort === "open") return Number(right.needsThanks || right.receiptNeeded) - Number(left.needsThanks || left.receiptNeeded) || left.name.localeCompare(right.name);
  return left.name.localeCompare(right.name);
}

function compareParticipants(left, right, sort) {
  if (sort === "age") return (left.age || 0) - (right.age || 0) || left.name.localeCompare(right.name);
  if (sort === "admission") return String(right.admissionDate).localeCompare(String(left.admissionDate)) || left.name.localeCompare(right.name);
  if (sort === "stage") return PARTICIPANT_MAIN_STAGES.indexOf(left.currentStage) - PARTICIPANT_MAIN_STAGES.indexOf(right.currentStage) || left.name.localeCompare(right.name);
  if (sort === "visa") return Number(right.visaWarning) - Number(left.visaWarning) || (left.daysUntilVisaDeadline ?? 9999) - (right.daysUntilVisaDeadline ?? 9999);
  return left.name.localeCompare(right.name);
}

function normalizeSearch(value) {
  return String(value || "").trim().toLocaleLowerCase("de-DE");
}

function stableSlug(prefix, text, suffix) {
  const slug = String(text || "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
  return `${prefix}-${slug}${suffix ? `-${suffix}` : ""}`;
}

function ageAt(birthday, today) {
  if (!birthday) return null;
  const birth = new Date(`${birthday}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(now.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function csv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
