import type {BLOB} from '../../../one/packages/one.core/lib/recipes.js';
import type {
  SHA256Hash,
  SHA256IdHash,
} from '../../../one/packages/one.core/lib/util/type-checks.js';

declare module '@OneObjectInterfaces' {
  export interface OneVersionedObjectInterfaces {
    ProjectGitSource: ProjectGitSource;
  }

  export interface OneIdObjectInterfaces {
    ProjectGitSource: Pick<ProjectGitSource, '$type$' | 'sourceId'>;
  }

  export interface OneUnversionedObjectInterfaces {
    ProjectSourceArtifact: ProjectSourceArtifact;
  }
}

export interface ProjectGitSource {
  $type$: 'ProjectGitSource';
  $version$: 'v1';
  sourceId: string;
  projectId: string;
  adapter: 'source.git';
  repoUrl: string;
  defaultBranch: string;
  rootPath: string;
  detachedWorktreeRoot?: string;
  trackedPathGlobs: string[];
  ignoredPathGlobs: string[];
  schemaVersion: string;
}

export interface ProjectSourceArtifact {
  $type$: 'ProjectSourceArtifact';
  source: SHA256IdHash<ProjectGitSource>;
  path: string;
  revision: string;
  blob: SHA256Hash<BLOB>;
  byteLength: number;
  mediaType?: string;
  sourceEntryId?: string;
  sourceModifiedAt?: number;
  ingestedAt: number;
  ingestedBy: string;
  schemaVersion: string;
}
