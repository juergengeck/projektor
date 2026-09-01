export const QUESTIONNAIRE_ITEM_TYPES = [
  "group",
  "display",
  "string",
  "integer",
  "date",
  "choice",
  "open-choice",
  "slider",
];

const QUESTIONNAIRE_ITEM_TYPE_SET = new Set(QUESTIONNAIRE_ITEM_TYPES);
const OPTION_REQUIRED_TYPES = new Set(["choice", "open-choice"]);

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value;
}

function cloneJson(value, name) {
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError(`${name} must be structurally cloneable.`);
  }
}

export function createQuestionnaire({ language, name, title, url, status = "draft", ...rest }) {
  requireString(language, "language");
  requireString(name, "name");
  requireString(title, "title");
  requireString(url, "url");
  requireString(status, "status");

  return {
    resourceType: "Questionnaire",
    language,
    name,
    title,
    url,
    status,
    ...cloneJson(rest, "questionnaire fields"),
    item: [],
  };
}

export function createItem({ linkId, text, type, ...rest }) {
  requireString(linkId, "linkId");
  requireString(text, "text");
  requireString(type, "type");

  if (!QUESTIONNAIRE_ITEM_TYPE_SET.has(type)) {
    throw new RangeError(`Unknown questionnaire item type: ${type}.`);
  }

  return {
    linkId,
    text,
    type,
    ...cloneJson(rest, "item fields"),
  };
}

export function addItem(parent, item) {
  assertPlainObject(parent, "parent");
  assertPlainObject(item, "item");

  if (!Array.isArray(parent.item)) {
    parent.item = [];
  }
  parent.item.push(item);
  return parent;
}

export function addAnswerOption(item, { system, version, code, display }) {
  assertPlainObject(item, "item");
  requireString(system, "system");
  requireString(version, "version");
  requireString(code, "code");
  requireString(display, "display");

  if (!Array.isArray(item.answerOption)) {
    item.answerOption = [];
  }
  item.answerOption.push({
    valueCoding: {
      system,
      version,
      code,
      display,
    },
  });
  return item;
}

function validateItem(item, seenLinkIds, path) {
  assertPlainObject(item, `${path} item`);
  const linkId = requireString(item.linkId, `${path}.linkId`);
  requireString(item.text, `${path}.text`);
  const type = requireString(item.type, `${path}.type`);

  if (!QUESTIONNAIRE_ITEM_TYPE_SET.has(type)) {
    throw new RangeError(`${path} has unknown item type: ${type}.`);
  }
  if (seenLinkIds.has(linkId)) {
    throw new Error(`Duplicate questionnaire linkId: ${linkId}.`);
  }
  seenLinkIds.add(linkId);

  if (OPTION_REQUIRED_TYPES.has(type) && (!Array.isArray(item.answerOption) || item.answerOption.length === 0)) {
    throw new Error(`${path} (${linkId}) of type ${type} requires at least one answerOption.`);
  }

  if (Array.isArray(item.answerOption)) {
    item.answerOption.forEach((option, index) => {
      assertPlainObject(option, `${path}.answerOption[${index}]`);
      assertPlainObject(option.valueCoding, `${path}.answerOption[${index}].valueCoding`);
      requireString(option.valueCoding.system, `${path}.answerOption[${index}].valueCoding.system`);
      requireString(option.valueCoding.version, `${path}.answerOption[${index}].valueCoding.version`);
      requireString(option.valueCoding.code, `${path}.answerOption[${index}].valueCoding.code`);
      requireString(option.valueCoding.display, `${path}.answerOption[${index}].valueCoding.display`);
    });
  }

  if (item.item !== undefined) {
    if (!Array.isArray(item.item)) {
      throw new TypeError(`${path}.item must be an array.`);
    }
    item.item.forEach((child, index) => validateItem(child, seenLinkIds, `${path}.item[${index}]`));
  }
}

export function validateQuestionnaire(questionnaire) {
  assertPlainObject(questionnaire, "questionnaire");
  if (questionnaire.resourceType !== "Questionnaire") {
    throw new Error("Questionnaire resourceType must be Questionnaire.");
  }
  requireString(questionnaire.language, "questionnaire.language");
  requireString(questionnaire.name, "questionnaire.name");
  requireString(questionnaire.title, "questionnaire.title");
  requireString(questionnaire.url, "questionnaire.url");
  requireString(questionnaire.status, "questionnaire.status");

  if (!Array.isArray(questionnaire.item)) {
    throw new TypeError("questionnaire.item must be an array.");
  }

  const seenLinkIds = new Set();
  questionnaire.item.forEach((item, index) => validateItem(item, seenLinkIds, `questionnaire.item[${index}]`));
  return questionnaire;
}

export function serializeQuestionnaire(questionnaire) {
  validateQuestionnaire(questionnaire);
  return JSON.stringify(questionnaire);
}

export function parseQuestionnaire(json) {
  const parsed = typeof json === "string" ? JSON.parse(json) : cloneJson(json, "questionnaire");
  validateQuestionnaire(parsed);
  return parsed;
}
