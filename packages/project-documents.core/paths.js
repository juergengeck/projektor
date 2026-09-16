export function requiredText(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

/** Reversible escaping; literal percent signs cannot alias an escaped character. */
export function filerName(value) {
  const escaped = value.normalize("NFC").replace(/[%/\\:\x00-\x1f\x7f]/g, character => `%${character.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()}`);
  if (!escaped || escaped === "." || escaped === ".." || new TextEncoder().encode(escaped).length > 240) throw new Error("Unsupported Filer filename.");
  return escaped;
}

export function documentPath(value) {
  if (typeof value !== "string" || value.startsWith("/") || value.includes("\\") || value.includes("\0")) throw new Error("Document path must be relative.");
  const parts = value.split("/");
  parts.forEach(filerName);
  return parts.map(filerName).join("/");
}

/** Refuse ambiguous names on case-insensitive native filesystems, including directory aliases. */
export function validateDocumentPaths(paths) {
  const entries = new Map();
  for (const path of paths) {
    const parts = documentPath(path).split("/");
    for (let i = 1; i <= parts.length; i++) {
      const name = parts.slice(0, i).join("/");
      const directory = i < parts.length;
      const key = name.toLowerCase();
      const prior = entries.get(key);
      if (prior && (prior.name !== name || !prior.directory || !directory)) throw new Error(`Conflicting document path: ${path}`);
      entries.set(key, { name, directory });
    }
  }
}
