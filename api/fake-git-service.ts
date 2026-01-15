/**
 * Fake git service functions for testing.
 * These functions simulate git operations without actually modifying remotes.
 */

interface GitResult {
  success: boolean
  output?: string
  error?: string
}

/**
 * Fake push that always succeeds without actually pushing.
 * In fake mode, we log the operation but don't perform it.
 */
export async function fakePushRepository(
  cwd: string,
  _token: string,
  remote = 'origin',
  branch?: string
): Promise<GitResult> {
  const branchInfo = branch ? ` (branch: ${branch})` : ''
  console.log(`[FAKE] Would push to ${remote}${branchInfo} from ${cwd}`)
  return { success: true, output: 'Fake push completed' }
}

/**
 * Fake pull that always succeeds without actually pulling.
 * In fake mode, we log the operation but don't perform it.
 */
export async function fakePullRepository(
  cwd: string,
  _token: string,
  remote = 'origin',
  branch?: string
): Promise<GitResult> {
  const branchInfo = branch ? ` (branch: ${branch})` : ''
  console.log(`[FAKE] Would pull from ${remote}${branchInfo} to ${cwd}`)
  return { success: true, output: 'Already up to date.' }
}

/**
 * Fake fetch that always succeeds without actually fetching.
 */
export async function fakeFetchRepository(
  cwd: string,
  _token: string,
  remote = 'origin'
): Promise<GitResult> {
  console.log(`[FAKE] Would fetch from ${remote} in ${cwd}`)
  return { success: true, output: '' }
}

/**
 * Check if fake mode is enabled
 */
export function isFakeModeEnabled(): boolean {
  return process.env.FAKE_MODE === 'true'
}
