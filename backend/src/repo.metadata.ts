import path from "path"
import { APP_CONFIG } from "./config";
import { cloneRepo, walkFileTree } from "./utils";
import type { updateState } from "./server.interface";

export interface RepoMetadata
{
  repoUrl: string;
  repoName: string;
  /** The full list of all relevant files in the repository. */
  allFiles: { relative: string, absolute: string }[];
}

const repoMetadataCache = new Map<string, RepoMetadata>();

export async function getRepoMetadata ( repoUrl: string, updateState?: updateState ): Promise<RepoMetadata>
{
  const repoName = path.basename( repoUrl, '.git' );
  const localPath = path.join( APP_CONFIG.LOCAL_REPO_DIR, repoName );

  if ( repoMetadataCache.has( repoUrl ) )
  {
    console.log( `[CACHE HIT] Using cached file list for ${repoUrl}` );
    return repoMetadataCache.get( repoUrl )!;
  }

  console.log( `[CACHE MISS] Discovering Cloning Repo/Loading Repo ${repoUrl}` );

  updateState && updateState( 'preparing', `Cloning ${repoName}...` );
  // This function now handles cloning AND file discovery.
  await cloneRepo( repoUrl, localPath );

  const allFiles = walkFileTree( localPath )

  const metadata: RepoMetadata = {
    repoUrl,
    repoName,
    allFiles,
  };

  repoMetadataCache.set( repoUrl, metadata );
  return metadata;
}