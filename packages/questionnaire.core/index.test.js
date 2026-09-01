import assert from "node:assert/strict";
import {
  addAnswerOption,
  addItem,
  createItem,
  createQuestionnaire,
  parseQuestionnaire,
  serializeQuestionnaire,
  validateQuestionnaire,
} from "./index.js";

const questionnaire = createQuestionnaire({
  language: "de-DE",
  name: "projektor-questionnaire-demo",
  title: "Projekt-Fragebogen",
  url: "https://projektor.one/questionnaires/demo",
});

assert.equal(questionnaire.resourceType, "Questionnaire");
assert.equal(questionnaire.status, "draft");
assert.deepEqual(questionnaire.item, []);

const group = createItem({
  linkId: "scope",
  text: "Projektumfang",
  type: "group",
});
const choice = createItem({
  linkId: "scope.kind",
  text: "Welche Projektart ist geplant?",
  type: "choice",
});
addAnswerOption(choice, {
  system: "https://projektor.one/codes/project-kind",
  version: "2026-06-12",
  code: "school",
  display: "Schule",
});
addItem(group, choice);
addItem(questionnaire, group);

assert.equal(questionnaire.item[0].item[0].answerOption[0].valueCoding.code, "school");
assert.equal(validateQuestionnaire(questionnaire), questionnaire);

const roundTrip = parseQuestionnaire(serializeQuestionnaire(questionnaire));
assert.deepEqual(roundTrip, questionnaire);

assert.throws(
  () => createItem({ linkId: "unsupported", text: "Unsupported", type: "boolean" }),
  /Unknown questionnaire item type/,
);

const duplicate = createQuestionnaire({
  language: "de-DE",
  name: "duplicate-link-id",
  title: "Duplicate link id",
  url: "https://projektor.one/questionnaires/duplicate",
});
addItem(duplicate, createItem({ linkId: "same", text: "First", type: "string" }));
addItem(duplicate, createItem({ linkId: "same", text: "Second", type: "integer" }));
assert.throws(() => validateQuestionnaire(duplicate), /Duplicate questionnaire linkId: same/);

const missingOptions = createQuestionnaire({
  language: "de-DE",
  name: "missing-options",
  title: "Missing options",
  url: "https://projektor.one/questionnaires/missing-options",
});
addItem(missingOptions, createItem({ linkId: "choice", text: "Pick one", type: "open-choice" }));
assert.throws(() => validateQuestionnaire(missingOptions), /requires at least one answerOption/);

assert.throws(() => parseQuestionnaire('{"resourceType":"Patient"}'), /resourceType/);
