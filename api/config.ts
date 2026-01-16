import * as path from 'node:path'

/** Default data directory relative to project root */
export const DEFAULT_DATA_DIR = './temp/github-repositories'

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
      process.env.BEAD_FEEDER_DATA_DIR || path.resolve(DEFAULT_DATA_DIR),
  }
}

/**
 * Get the file system path for a repository
 * @param owner - Repository owner (e.g., 'josh-beads-test-1')
 * @param repo - Repository name (e.g., 'bead-feeder-example-issues')
 * @returns Absolute path to the repository directory
 */
export function getRepoPath(owner: string, repo: string): string {
  const config = getConfig()
  return path.join(config.rootDataDir, owner, repo)
}

/**
 * Get the local repository path (used when no owner/repo specified)
 * @returns Absolute path to the local repository directory
 */
export function getLocalRepoPath(): string {
  return getConfig().rootDataDir
}
