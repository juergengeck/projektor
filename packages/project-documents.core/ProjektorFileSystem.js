import { documentPath, filerName } from "./paths.js";

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
const readonly = async () => fail(-13, "Project documents are read-only in Filer. Publish changes through Projektor.");

/** Domain projection implementing Filer's filesystem contract without a second storage/runtime. */
export class ProjektorFileSystem {
  constructor(plan) { this.plan = plan; }

  async resolve(path) {
    if (typeof path !== "string" || !path.startsWith("/") || (path !== "/" && path.split("/").slice(1).some(part => !part || part === "." || part === ".."))) fail(-22, "Invalid absolute Filer path.");
    const parts = path === "/" ? [] : path.slice(1).split("/");
    const { projects, version } = await this.plan.getSnapshot();
    if (!parts.length) return { children: ["Projekte"], metadataHash: version };
    if (parts[0] !== "Projekte") fail(-2, "Project path not found.");
    const projectName = project => `${filerName(project.label)} [${project.ref}]`;
    if (parts.length === 1) return { children: projects.map(projectName), metadataHash: version };
    const project = projects.find(project => projectName(project) === parts[1]);
    if (!project) fail(-2, "Project not found.");
    if (parts.length === 2) return { children: ["Dokumente"], metadataHash: project.version };
    if (parts[2] !== "Dokumente") fail(-2, "Project folder not found.");
    const relative = parts.slice(3).join("/");
    const files = project.documents.map(entry => ({ ...entry, nativePath: documentPath(entry.path) }));
    const entry = files.find(entry => entry.nativePath === relative);
    if (entry) return { projectRef: project.ref, entry };
    const prefix = relative ? `${relative}/` : "";
    const children = [...new Set(files.filter(entry => entry.nativePath.startsWith(prefix)).map(entry => entry.nativePath.slice(prefix.length).split("/")[0]))];
    if (relative && !children.length) fail(-2, "Document path not found.");
    return { children, metadataHash: project.version };
  }

  async readDir(path) {
    const node = await this.resolve(path);
    if (!node.children) fail(-20, "Path is not a directory.");
    return { children: node.children };
  }
  async stat(path) {
    const node = await this.resolve(path);
    return node.children
      ? { mode: 0o040555, size: 0, metadataHash: node.metadataHash }
      : { mode: 0o100444, size: node.entry.size, contentHash: node.entry.blob, metadataHash: node.entry.ref, mimeType: node.entry.mediaType };
  }
  async readFile(path) {
    const node = await this.resolve(path);
    if (node.children) fail(-21, "Path is a directory.");
    // Recheck current root membership at the domain read boundary.
    const bytes = await this.plan.readDocument({ projectRef: node.projectRef, artifactRef: node.entry.ref });
    return { content: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }
  async readFileInChunks(path, length, position) {
    if (![length, position].every(value => Number.isSafeInteger(value) && value >= 0)) fail(-22, "Invalid chunk range.");
    return { content: (await this.readFile(path)).content.slice(position, position + length) };
  }
  supportsChunkedReading() { return true; }
  async readlink() { fail(-22, "Project documents do not contain symlinks."); }
  createDir = readonly;
  createFile = readonly;
  chmod = readonly;
  rename = readonly;
  rmdir = readonly;
  unlink = readonly;
  symlink = readonly;
}
