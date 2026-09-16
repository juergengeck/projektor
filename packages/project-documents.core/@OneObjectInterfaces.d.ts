import type {Person} from '../../../one/packages/one.core/lib/recipes.js';
import type {SHA256Hash, SHA256IdHash} from '../../../one/packages/one.core/lib/util/type-checks.js';
import type {ProjectSourceArtifact} from '../project-source.core/@OneObjectInterfaces.js';

export interface ProjectDocumentCollection {
  $type$: 'ProjectDocumentCollection';
  owner: SHA256IdHash<Person>;
  projectId: string;
  label: string;
  artifactRefs: SHA256Hash<ProjectSourceArtifact>[];
}
export interface ProjectDocumentCatalog {
  $type$: 'ProjectDocumentCatalog';
  owner: SHA256IdHash<Person>;
  collectionRefs: SHA256IdHash<ProjectDocumentCollection>[];
}
declare module '@OneObjectInterfaces' {
  interface OneVersionedObjectInterfaces {
    ProjectDocumentCollection: ProjectDocumentCollection;
    ProjectDocumentCatalog: ProjectDocumentCatalog;
  }
  interface OneIdObjectInterfaces {
    ProjectDocumentCollection: Pick<ProjectDocumentCollection, '$type$' | 'owner' | 'projectId'>;
    ProjectDocumentCatalog: Pick<ProjectDocumentCatalog, '$type$' | 'owner'>;
  }
}
