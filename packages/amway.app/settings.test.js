import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AMWAY_SETTINGS_SECTION_ID,
  AmwaySettingsStore,
  amwaySettingsSchema,
  registerAmwaySettings,
} from "./settings.js";

test("Amway settings live on the settings.core registry", async () => {
  const first = registerAmwaySettings();
  const second = registerAmwaySettings();
  assert.equal(first.id, AMWAY_SETTINGS_SECTION_ID);
  assert.equal(second, first);
  assert.equal(first.module, "amway.app");
  const schema = amwaySettingsSchema();
  assert.deepEqual(schema.fields.map(field => field.key), ["language", "theme"]);
  const language = schema.fields[0];
  assert.deepEqual(language.options.map(option => option.value), ["de", "en", "fr"]);
  assert.equal(language.default, "de");
  assert.equal(schema.fields[1].default, "system");
});

test("settings values default, validate, and persist per account", () => {
  const store = new AmwaySettingsStore();
  assert.deepEqual(store.getValues("a@example.de"), { language: "de", theme: "system" });
  assert.deepEqual(store.setValue("a@example.de", "language", "fr"), { language: "fr", theme: "system" });
  assert.deepEqual(store.setValue("a@example.de", "theme", "dark"), { language: "fr", theme: "dark" });
  assert.deepEqual(store.getValues("b@example.de"), { language: "de", theme: "system" });
  assert.throws(() => store.setValue("a@example.de", "language", "es"), /Unknown language/);
  assert.throws(() => store.setValue("a@example.de", "theme", "neon"), /Unknown theme/);
  assert.throws(() => store.setValue("a@example.de", "skin", "vger"), /unknown key/);
});
