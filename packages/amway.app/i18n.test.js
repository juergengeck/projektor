import assert from "node:assert/strict";
import { test } from "node:test";
import { AMWAY_LANGUAGES, languageKeys, translate } from "./i18n.js";

test("every language carries the same non-empty strings", () => {
  assert.deepEqual([...AMWAY_LANGUAGES].sort(), ["de", "en", "fr"]);
  const reference = languageKeys("en").sort();
  assert.ok(reference.length > 0);
  for (const lang of AMWAY_LANGUAGES) {
    assert.deepEqual(languageKeys(lang).sort(), reference, `i18n parity for ${lang}`);
    for (const key of reference) {
      assert.ok(translate(lang, key).trim().length > 0, `${lang}:${key} is empty`);
    }
  }
});

test("amway.de wording and fallbacks", () => {
  assert.equal(translate("de", "auth.signin"), "Anmelden");
  assert.equal(translate("fr", "auth.signin"), "Se connecter");
  assert.equal(translate("en", "auth.signin"), "Sign in");
  assert.equal(translate("xx", "auth.signin"), "Sign in");
  assert.throws(() => translate("en", "missing.key"), /missing key/);
});
