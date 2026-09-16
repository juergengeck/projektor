/**
 * Amway settings on the real settings.core registry.
 *
 * The `amway` section (language, theme) is registered on settings.core's
 * `SettingsRegistry` with `defineSection`/`defineField`; defaults and
 * validation come from the registry. Values are process-local per account
 * in this slice; ONE-backed `DynamicSettingsStorage` replaces
 * `AmwaySettingsStore` when the durable runtime lands.
 *
 * The browser shell never imports this module directly: it reads and writes
 * settings through the server's `getSettings`/`updateSettings` operations.
 */

import {
  SettingsRegistry,
  defineSection,
  defineField,
} from "../../../one/packages/settings.core/dist/registry/SettingsRegistry.js";

export const AMWAY_SETTINGS_SECTION_ID = "amway";
export const AMWAY_THEMES = ["light", "dark", "system"];
export const AMWAY_SETTING_LANGUAGES = ["de", "en", "fr"];

export function registerAmwaySettings() {
  if (SettingsRegistry.hasSection(AMWAY_SETTINGS_SECTION_ID)) {
    return SettingsRegistry.getSection(AMWAY_SETTINGS_SECTION_ID);
  }
  const section = defineSection({
    id: AMWAY_SETTINGS_SECTION_ID,
    name: "Amway",
    module: "amway.app",
    order: 10,
    fields: [
      defineField({
        key: "language",
        type: "select",
        label: "Language",
        description: "Choose the workspace language.",
        default: "de",
        options: [
          { value: "de", label: "Deutsch" },
          { value: "en", label: "English" },
          { value: "fr", label: "Français" },
        ],
        validate: value => AMWAY_SETTING_LANGUAGES.includes(value) ? null : "Unknown language.",
      }),
      defineField({
        key: "theme",
        type: "select",
        label: "Theme",
        description: "Follow the device theme or choose a fixed color mode.",
        default: "system",
        options: [
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system", label: "System" },
        ],
        validate: value => AMWAY_THEMES.includes(value) ? null : "Unknown theme.",
      }),
    ],
  });
  SettingsRegistry.registerSection(section);
  return section;
}

export function amwaySettingsSchema() {
  const section = registerAmwaySettings();
  return {
    id: section.id,
    name: section.name,
    fields: section.fields.map(field => ({
      key: field.key,
      type: field.type,
      label: field.label,
      description: field.description,
      default: field.default,
      options: field.options?.map(option => ({ ...option })),
    })),
  };
}

export class AmwaySettingsStore {
  constructor() {
    registerAmwaySettings();
    this.values = new Map();
  }

  getValues(account) {
    const defaults = SettingsRegistry.getSectionDefaults(
      SettingsRegistry.getSection(AMWAY_SETTINGS_SECTION_ID),
    );
    return { ...defaults, ...this.values.get(account) };
  }

  setValue(account, key, value) {
    const section = SettingsRegistry.getSection(AMWAY_SETTINGS_SECTION_ID);
    if (!section.fields.some(field => field.key === key)) {
      throw new Error(`Amway settings: unknown key ${key}.`);
    }
    const current = this.values.get(account) ?? {};
    const errors = SettingsRegistry.validateSection(AMWAY_SETTINGS_SECTION_ID, { ...current, [key]: value });
    if (errors.has(key)) throw new Error(`Amway settings: ${errors.get(key)}`);
    this.values.set(account, { ...this.values.get(account), [key]: value });
    return this.getValues(account);
  }
}
