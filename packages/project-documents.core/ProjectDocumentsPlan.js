import { calculateIdHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";
import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { getObjectByIdHash, storeVersionedObject } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { readBlobAsUint8Array } from "../../../one/packages/one.core/lib/storage-blob.js";
import { isMissingObjectError } from "../../../one/packages/source.core/dist/index.js";
import { ingestProjectSourceArtifact } from "../project-source.core/index.js";
import { documentPath, filerName, requiredText, validateDocumentPaths } from "./paths.js";

/** Local owner domain boundary. Filer receives only this owner's explicitly published collections. */
export class ProjectDocumentsPlan {
  constructor({ owner, now = () => Date.now() }) {
    this.owner = owner;
    this.now = now;
    this.writeTail = Promise.resolve();
  }

  async init() {
    const root = { $type$: "ProjectDocumentCatalog", owner: this.owner, collectionRefs: [] };
    this.rootId = await calculateIdHashOfObj(root);
    try { await getObjectByIdHash(this.rootId); }
    catch (error) {
      if (!isMissingObjectError(error)) throw error;
      await storeVersionedObject(root);
    }
    return this.getSnapshot();
  }

  async catalog() {
    if (!this.rootId) throw new Error("Documents are not initialized.");
    const saved = await getObjectByIdHash(this.rootId);
    if (saved.obj.$type$ !== "ProjectDocumentCatalog" || saved.obj.owner !== this.owner) throw new Error("Document catalog owner mismatch.");
    return saved;
  }

  async collection(projectRef) {
    const catalog = await this.catalog();
    if (!catalog.obj.collectionRefs.includes(projectRef)) throw new Error("Project is not published for this owner.");
    const saved = await getObjectByIdHash(projectRef);
    if (saved.obj.$type$ !== "ProjectDocumentCollection" || saved.obj.owner !== this.owner) throw new Error("Project owner mismatch.");
    return saved;
  }

  async entries(collection) {
    const entries = await Promise.all(collection.artifactRefs.map(async ref => {
      const artifact = await getObject(ref);
      if (artifact.$type$ !== "ProjectSourceArtifact") throw new Error("Invalid document artifact.");
      const source = await getObjectByIdHash(artifact.source);
      if (source.obj.$type$ !== "ProjectGitSource" || source.obj.projectId !== collection.projectId) throw new Error("Document source belongs to another project.");
      return { ref, path: artifact.path, size: artifact.byteLength, revision: artifact.revision, mediaType: artifact.mediaType, blob: artifact.blob };
    }));
    validateDocumentPaths(entries.map(entry => entry.path));
    return entries;
  }

  async getProject({ projectRef }) {
    const saved = await this.collection(projectRef);
    return { ref: projectRef, version: saved.hash, projectId: saved.obj.projectId, label: saved.obj.label, documents: await this.entries(saved.obj) };
  }

  async getSnapshot() {
    const catalog = await this.catalog();
    return { rootRef: this.rootId, owner: this.owner, version: catalog.hash, projects: await Promise.all(catalog.obj.collectionRefs.map(projectRef => this.getProject({ projectRef }))) };
  }

  write(action) {
    const work = this.writeTail.then(action);
    this.writeTail = work.then(() => undefined, () => undefined);
    return work;
  }

  createProject({ projectId, label, expectedVersion }) {
    return this.write(async () => {
      const catalog = await this.catalog();
      if (catalog.hash !== expectedVersion) throw new Error("Project catalog changed. Refresh before creating a project.");
      const root = { $type$: "ProjectDocumentCollection", owner: this.owner, projectId: requiredText(projectId, "projectId"), label: requiredText(label, "label"), artifactRefs: [] };
      // Reserve space for the stable full id suffix in the native folder name.
      if (new TextEncoder().encode(filerName(root.label)).length > 170) throw new Error("Project label is too long.");
      const ref = await calculateIdHashOfObj(root);
      if (catalog.obj.collectionRefs.includes(ref)) throw new Error("Project already exists.");
      // An interrupted first publication must not replace an existing collection's contents.
      try { await getObjectByIdHash(ref); throw new Error("Project root already exists outside the catalog."); }
      catch (error) { if (!isMissingObjectError(error)) throw error; }
      await storeVersionedObject(root);
      await storeVersionedObject({ ...catalog.obj, collectionRefs: [...catalog.obj.collectionRefs, ref] });
      return this.getSnapshot();
    });
  }

  importDocument({ projectRef, expectedVersion, source, path, revision, contentBase64, mediaType }) {
    return this.write(async () => {
      const saved = await this.collection(projectRef);
      if (saved.hash !== expectedVersion) throw new Error("Project documents changed. Refresh before importing.");
      documentPath(path);
      if (path !== path.trim()) throw new Error("Document path must not have surrounding whitespace.");
      if (source?.projectId !== saved.obj.projectId) throw new Error("Document source belongs to another project.");
      if (typeof contentBase64 !== "string" || contentBase64.length > 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)) throw new Error("Document must be canonical base64, at most 1 MiB encoded.");
      const current = await this.entries(saved.obj);
      const retained = current.filter(entry => entry.path !== path);
      validateDocumentPaths([...retained.map(entry => entry.path), path]);
      const artifact = await ingestProjectSourceArtifact({ source, path, revision, mediaType, bytes: Buffer.from(contentBase64, "base64"), ingestedAt: this.now(), ingestedBy: this.owner });
      await storeVersionedObject({ ...saved.obj, artifactRefs: [...retained.map(entry => entry.ref), artifact.artifactHash] });
      return this.getProject({ projectRef });
    });
  }

  removeDocument({ projectRef, artifactRef, expectedVersion }) {
    return this.write(async () => {
      const saved = await this.collection(projectRef);
      if (saved.hash !== expectedVersion) throw new Error("Project documents changed. Refresh before removing.");
      if (!saved.obj.artifactRefs.includes(artifactRef)) throw new Error("Document is not published in this project.");
      await storeVersionedObject({ ...saved.obj, artifactRefs: saved.obj.artifactRefs.filter(ref => ref !== artifactRef) });
      return this.getProject({ projectRef });
    });
  }

  async readDocument({ projectRef, artifactRef }) {
    const saved = await this.collection(projectRef);
    const entry = (await this.entries(saved.obj)).find(entry => entry.ref === artifactRef);
    if (!entry) throw new Error("Document is no longer published in this project.");
    const bytes = await readBlobAsUint8Array(entry.blob);
    if (bytes.byteLength !== entry.size) throw new Error("Document size does not match its artifact.");
    return bytes;
  }
}
