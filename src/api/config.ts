import * as os from 'node:os'
import * as path from 'node:path'

/** Default directory for cloned GitHub repositories */
export const DEFAULT_GITHUB_REPOS_DIR = path.join(
  os.tmpdir(),
  'bead-feeder-github-repos'
)

/**
 * Application configuration
 */
export interface AppConfig {
  /** Root directory where all repository data is stored */
  rootDataDir: string
}

/**
 * Get the current application configuration from environment variables
 */
export function getConfig(): AppConfig {
  return {
    rootDataDir:
      process.env.BEAD_FEEDER_GITHUB_REPOS_DIR ||
      path.resolve(DEFAULT_GITHUB_REPOS_DIR),
  }
}

/**
 * Get the file system path for a repository
 * @param owner - Repository owner (e.g., 'josh-beads-test-1')
 * @param repo - Repository name (e.g., 'bead-feeder-example-issues')
 * @param userId - Optional user ID for per-user clones. If provided, creates path like:
 *                 temp/github-repositories/{userId}/{owner}/{repo}/
 *                 If omitted, uses shared path (for backwards compatibility):
 *                 temp/github-repositories/{owner}/{repo}/
 * @returns Absolute path to the repository directory
 */
export function getRepoPath(
  owner: string,
  repo: string,
  userId?: string
): string {
  const config = getConfig()
  if (userId) {
    return path.join(config.rootDataDir, userId, owner, repo)
  }
  return path.join(config.rootDataDir, owner, repo)
}

/**
 * Get the local repository path (used when no owner/repo specified)
 * @returns Absolute path to the local repository directory
 */
export function getLocalRepoPath(): string {
  return getConfig().rootDataDir
}
