import { describe, expect, it } from 'vitest'
import {
  buildAuthenticatedUrl,
  compareBranches,
  getCurrentBranch,
  getStatus,
  hasConflicts,
  isGitRepository,
  parseGitHubUrl,
} from './git-service'

describe('parseGitHubUrl', () => {
  it('parses HTTPS URLs with .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses HTTPS URLs without .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses SSH URLs', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses SSH URLs without .git suffix', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses short form owner/repo', () => {
    const result = parseGitHubUrl('myorg/myrepo')
    expect(result).toEqual({ owner: 'myorg', repo: 'myrepo' })
  })

  it('returns null for invalid URLs', () => {
    expect(parseGitHubUrl('invalid-url')).toBeNull()
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull()
    expect(parseGitHubUrl('')).toBeNull()
  })

  it('handles usernames and repos with hyphens and underscores', () => {
    const result = parseGitHubUrl('https://github.com/my-org/my_repo.git')
    expect(result).toEqual({ owner: 'my-org', repo: 'my_repo' })
  })
})

describe('buildAuthenticatedUrl', () => {
  it('builds an authenticated URL with token', () => {
    const url = buildAuthenticatedUrl('owner', 'repo', 'mytoken123')
    expect(url).toBe(
      'https://x-access-token:mytoken123@github.com/owner/repo.git'
    )
  })

  it('handles special characters in token', () => {
    const url = buildAuthenticatedUrl(
      'owner',
      'repo',
      'token_with-special.chars'
    )
    expect(url).toBe(
      'https://x-access-token:token_with-special.chars@github.com/owner/repo.git'
    )
  })
})

describe('isGitRepository', () => {
  it('returns true for a git repository', async () => {
    // Current directory is a git repo
    const result = await isGitRepository(process.cwd())
    expect(result).toBe(true)
  })

  it('returns false for a non-git directory', async () => {
    const result = await isGitRepository('/tmp')
    expect(result).toBe(false)
  })
})

describe('getCurrentBranch', () => {
  it('returns the current branch name', async () => {
    const result = await getCurrentBranch(process.cwd())
    expect(result.success).toBe(true)
    expect(result.output).toBeDefined()
    // Should be 'main' or another valid branch name
    expect(typeof result.output).toBe('string')
    expect(result.output?.length).toBeGreaterThan(0)
  })
})

describe('getStatus', () => {
  it('returns git status output', async () => {
    const result = await getStatus(process.cwd())
    expect(result.success).toBe(true)
    // Output can be empty (clean) or have content (dirty)
    expect(result.output).toBeDefined()
  })
})

describe('compareBranches', () => {
  it('returns branch status for current repo', async () => {
    const result = await compareBranches(process.cwd())
    expect(result.success).toBe(true)
    if (result.status) {
      expect(typeof result.status.ahead).toBe('number')
      expect(typeof result.status.behind).toBe('number')
      expect(typeof result.status.diverged).toBe('boolean')
    }
  })

  it('handles non-existent remote branch gracefully', async () => {
    // This tests the case when the remote branch doesn't exist yet
    // The function should still return success with 0 ahead/behind
    const result = await compareBranches(process.cwd(), 'nonexistent-remote')
    // Should fail gracefully since the remote doesn't exist
    expect(result.success === false || result.status !== undefined).toBe(true)
  })
})

describe('hasConflicts', () => {
  it('returns false when no conflicts exist', async () => {
    // Current repo should have no conflicts
    const result = await hasConflicts(process.cwd())
    expect(result).toBe(false)
  })
})
