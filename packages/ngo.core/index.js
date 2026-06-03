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
