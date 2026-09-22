// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/lab/theme.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.

/**
 * Lab lane appearance: one preference across light, dark, and system.
 * `system` follows the OS color scheme; the resolved effective theme is what
 * reaches the document and the shared app theme key (the in-lane apps only
 * understand light/dark).
 */
export type LabThemeMode = "light" | "dark" | "system";

export type LabEffectiveTheme = "light" | "dark";

const THEME_CYCLE: LabThemeMode[] = ["light", "dark", "system"];

export function nextLabThemeMode(mode: LabThemeMode): LabThemeMode {
  const index = THEME_CYCLE.indexOf(mode);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}

export function resolveLabEffectiveTheme(mode: LabThemeMode, systemDark: boolean): LabEffectiveTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return systemDark ? "dark" : "light";
}

export function parseLabThemeMode(stored: string | null): LabThemeMode | null {
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return null;
}
