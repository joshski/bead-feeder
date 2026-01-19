/**
 * Contract tests for IssueTracker implementations.
 * Runs the same tests against both FakeIssueTracker and BeadsIssueTracker
 * to ensure identical behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BeadsIssueTracker } from './BeadsIssueTracker'
import { FakeIssueTracker } from './FakeIssueTracker'
import type { IssueTracker } from './IssueTracker'

// Contract test adapter interface
interface TestAdapter {
  name: string
  createTracker(): Promise<IssueTracker>
  cleanup(): Promise<void>
}

// Fake adapter - simple in-memory
const fakeAdapter: TestAdapter = {
  name: 'fake',
  createTracker: async () => new FakeIssueTracker(),
  cleanup: async () => {
    /* nothing to clean up */
  },
}

// Beads adapter - creates temp directory with bd init
// Use a closure to capture tempDir per test run
function createBeadsAdapter(): TestAdapter {
  let tempDir: string | undefined

  return {
    name: 'beads',
    createTracker: async () => {
      // Create unique temp directory for this test
      tempDir = join(
        tmpdir(),
        `beads-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      )
      mkdirSync(tempDir, { recursive: true })

      // Initialize git repo (required for bd)
      const { spawn } = await import('node:child_process')
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('git', ['init'], { cwd: tempDir })
        proc.on('close', code =>
          code === 0 ? resolve() : reject(new Error('git init failed'))
        )
        proc.on('error', reject)
      })

      // Configure git user for commits
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('git', ['config', 'user.email', 'test@test.com'], {
          cwd: tempDir,
        })
        proc.on('close', code =>
          code === 0 ? resolve() : reject(new Error('git config email failed'))
        )
        proc.on('error', reject)
      })
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('git', ['config', 'user.name', 'Test User'], {
          cwd: tempDir,
        })
        proc.on('close', code =>
          code === 0 ? resolve() : reject(new Error('git config name failed'))
        )
        proc.on('error', reject)
      })

      // Initialize beads
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('bd', ['init'], { cwd: tempDir })
        proc.on('close', code =>
          code === 0 ? resolve() : reject(new Error('bd init failed'))
        )
        proc.on('error', reject)
      })

      // Create empty issues.jsonl (needed for BD_NO_DAEMON mode)
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(tempDir, '.beads', 'issues.jsonl'), '')

      return new BeadsIssueTracker({ cwd: tempDir })
    },
    cleanup: async () => {
      if (tempDir) {
        try {
          rmSync(tempDir, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
        tempDir = undefined
      }
    },
  }
}

// Run contract tests against both implementations
// Create a fresh beads adapter for each describe block to avoid shared state
const adapters = [fakeAdapter, createBeadsAdapter()]

// Helper to run tests for each adapter (bun:test doesn't have describe.each)
for (const adapter of adapters) {
  describe(`IssueTracker contract ('${adapter.name}')`, () => {
    let tracker: IssueTracker

    beforeEach(async () => {
      tracker = await adapter.createTracker()
    })

    afterEach(async () => {
      await adapter.cleanup()
    })

    describe('createIssue', () => {
      it('creates issue with required fields', async () => {
        const result = await tracker.createIssue({ title: 'Test issue' })

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.title).toBe('Test issue')
        expect(result.data?.status).toBe('open')
        // ID format varies by implementation (bead-xxx for fake, beads-*-xxx for real)
        expect(result.data?.id).toMatch(/^bead/)
      })

      it('creates issue with all optional fields', async () => {
        const result = await tracker.createIssue({
          title: 'Full issue',
          description: 'A detailed description',
          type: 'bug',
          priority: 1,
        })

        expect(result.success).toBe(true)
        expect(result.data?.title).toBe('Full issue')
        expect(result.data?.description).toBe('A detailed description')
        expect(result.data?.type).toBe('bug')
        expect(result.data?.priority).toBe(1)
      })

      it('fails with empty title', async () => {
        const result = await tracker.createIssue({ title: '' })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      it('fails with whitespace-only title', async () => {
        const result = await tracker.createIssue({ title: '   ' })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      it('creates issue with feature type', async () => {
        const result = await tracker.createIssue({
          title: 'New feature',
          type: 'feature',
        })

        expect(result.success).toBe(true)
        expect(result.data?.type).toBe('feature')
      })

      it('creates issue with P0 priority', async () => {
        const result = await tracker.createIssue({
          title: 'Urgent issue',
          priority: 0,
        })

        expect(result.success).toBe(true)
        expect(result.data?.priority).toBe(0)
      })

      it('creates issue with P3 priority', async () => {
        const result = await tracker.createIssue({
          title: 'Low priority',
          priority: 3,
        })

        expect(result.success).toBe(true)
        expect(result.data?.priority).toBe(3)
      })
    })

    describe('getIssue', () => {
      it('returns issue by id', async () => {
        const created = await tracker.createIssue({ title: 'Find me' })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string

        const result = await tracker.getIssue(issueId)

        expect(result.success).toBe(true)
        expect(result.data?.id).toBe(issueId)
        expect(result.data?.title).toBe('Find me')
      })

      it('fails on non-existent issue', async () => {
        const result = await tracker.getIssue('bead-nonexistent')

        expect(result.success).toBe(false)
        expect(result.error).toContain('not found')
      })
    })

    describe('listIssues', () => {
      it('returns empty list when no issues', async () => {
        const result = await tracker.listIssues()

        expect(result.success).toBe(true)
        expect(result.data).toEqual([])
      })

      it('returns all created issues', async () => {
        await tracker.createIssue({ title: 'Issue 1' })
        await tracker.createIssue({ title: 'Issue 2' })
        await tracker.createIssue({ title: 'Issue 3' })

        const result = await tracker.listIssues()

        expect(result.success).toBe(true)
        expect(result.data?.length).toBe(3)
        const titles = result.data?.map(i => i.title).sort()
        expect(titles).toEqual(['Issue 1', 'Issue 2', 'Issue 3'])
      })
    })

    describe('updateIssue', () => {
      it('updates title', async () => {
        const created = await tracker.createIssue({ title: 'Original' })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string

        const result = await tracker.updateIssue(issueId, { title: 'Updated' })

        expect(result.success).toBe(true)
        expect(result.data?.title).toBe('Updated')
      })

      it('updates status to in_progress', async () => {
        const created = await tracker.createIssue({ title: 'Task' })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string

        const result = await tracker.updateIssue(issueId, {
          status: 'in_progress',
        })

        expect(result.success).toBe(true)
        expect(result.data?.status).toBe('in_progress')
      })

      it('updates description', async () => {
        const created = await tracker.createIssue({ title: 'Task' })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string

        const result = await tracker.updateIssue(issueId, {
          description: 'New description',
        })

        expect(result.success).toBe(true)
        expect(result.data?.description).toBe('New description')
      })

      it('updates type', async () => {
        const created = await tracker.createIssue({
          title: 'Task',
          type: 'task',
        })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string

        const result = await tracker.updateIssue(issueId, { type: 'bug' })

        expect(result.success).toBe(true)
        expect(result.data?.type).toBe('bug')
      })

      it('updates priority', async () => {
        const created = await tracker.createIssue({
          title: 'Task',
          priority: 2,
        })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string

        const result = await tracker.updateIssue(issueId, { priority: 0 })

        expect(result.success).toBe(true)
        expect(result.data?.priority).toBe(0)
      })

      it('fails on non-existent issue', async () => {
        const result = await tracker.updateIssue('bead-nonexistent', {
          title: 'New',
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('not found')
      })
    })

    describe('closeIssue', () => {
      it('closes open issue', async () => {
        const created = await tracker.createIssue({ title: 'To close' })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string

        const result = await tracker.closeIssue(issueId)

        expect(result.success).toBe(true)
        expect(result.data?.status).toBe('closed')
      })

      it('closes in_progress issue', async () => {
        const created = await tracker.createIssue({ title: 'Working on it' })
        expect(created.data).toBeDefined()
        const issueId = created.data?.id as string
        await tracker.updateIssue(issueId, { status: 'in_progress' })

        const result = await tracker.closeIssue(issueId)

        expect(result.success).toBe(true)
        expect(result.data?.status).toBe('closed')
      })

      it('fails on non-existent issue', async () => {
        const result = await tracker.closeIssue('bead-nonexistent')

        expect(result.success).toBe(false)
        expect(result.error).toContain('not found')
      })
    })

    describe('addDependency', () => {
      it('adds dependency between existing issues', async () => {
        const blocked = await tracker.createIssue({ title: 'Blocked task' })
        const blocker = await tracker.createIssue({ title: 'Blocker task' })
        expect(blocked.data).toBeDefined()
        expect(blocker.data).toBeDefined()
        const blockedId = blocked.data?.id as string
        const blockerId = blocker.data?.id as string

        const result = await tracker.addDependency(blockedId, blockerId)

        expect(result.success).toBe(true)
        expect(result.data?.issue_id).toBe(blockedId)
        expect(result.data?.depends_on_id).toBe(blockerId)
      })

      it('fails when blocked issue does not exist', async () => {
        const blocker = await tracker.createIssue({ title: 'Blocker' })
        expect(blocker.data).toBeDefined()
        const blockerId = blocker.data?.id as string

        const result = await tracker.addDependency(
          'bead-nonexistent',
          blockerId
        )

        expect(result.success).toBe(false)
        // Error message varies by implementation but should mention "not found" or "no issue found"
        expect(result.error?.toLowerCase()).toMatch(/not found|no issue found/)
      })

      it('fails when blocker issue does not exist', async () => {
        const blocked = await tracker.createIssue({ title: 'Blocked' })
        expect(blocked.data).toBeDefined()
        const blockedId = blocked.data?.id as string

        const result = await tracker.addDependency(
          blockedId,
          'bead-nonexistent'
        )

        expect(result.success).toBe(false)
        // Error message varies by implementation but should mention "not found" or "no issue found"
        expect(result.error?.toLowerCase()).toMatch(/not found|no issue found/)
      })

      it('detects self-dependency cycle', async () => {
        const issue = await tracker.createIssue({ title: 'Self block' })
        expect(issue.data).toBeDefined()
        const issueId = issue.data?.id as string

        const result = await tracker.addDependency(issueId, issueId)

        expect(result.success).toBe(false)
        // Error message can be "cycle" or "cannot depend on itself"
        expect(result.error?.toLowerCase()).toMatch(
          /cycle|cannot depend on itself/
        )
      })

      it('detects indirect cycle', async () => {
        const a = await tracker.createIssue({ title: 'A' })
        const b = await tracker.createIssue({ title: 'B' })
        const c = await tracker.createIssue({ title: 'C' })
        expect(a.data).toBeDefined()
        expect(b.data).toBeDefined()
        expect(c.data).toBeDefined()
        const aId = a.data?.id as string
        const bId = b.data?.id as string
        const cId = c.data?.id as string

        // A depends on B, B depends on C
        await tracker.addDependency(aId, bId)
        await tracker.addDependency(bId, cId)

        // Try to make C depend on A - would create cycle: A -> B -> C -> A
        const result = await tracker.addDependency(cId, aId)

        expect(result.success).toBe(false)
        expect(result.error?.toLowerCase()).toContain('cycle')
      })

      it('fails on duplicate dependency', async () => {
        const blocked = await tracker.createIssue({ title: 'Blocked' })
        const blocker = await tracker.createIssue({ title: 'Blocker' })
        expect(blocked.data).toBeDefined()
        expect(blocker.data).toBeDefined()
        const blockedId = blocked.data?.id as string
        const blockerId = blocker.data?.id as string

        await tracker.addDependency(blockedId, blockerId)
        const result = await tracker.addDependency(blockedId, blockerId)

        expect(result.success).toBe(false)
        // Error message can contain already/exists/duplicate or constraint/unique
        expect(result.error?.toLowerCase()).toMatch(
          /already|exists|duplicate|constraint|unique/
        )
      })

      it('updates dependency counts', async () => {
        const blocked = await tracker.createIssue({ title: 'Blocked' })
        const blocker = await tracker.createIssue({ title: 'Blocker' })
        expect(blocked.data).toBeDefined()
        expect(blocker.data).toBeDefined()
        const blockedId = blocked.data?.id as string
        const blockerId = blocker.data?.id as string

        await tracker.addDependency(blockedId, blockerId)

        const blockedIssue = await tracker.getIssue(blockedId)
        const blockerIssue = await tracker.getIssue(blockerId)

        expect(blockedIssue.data?.dependency_count).toBe(1)
        expect(blockerIssue.data?.dependent_count).toBe(1)
      })
    })

    describe('removeDependency', () => {
      it('removes existing dependency', async () => {
        const blocked = await tracker.createIssue({ title: 'Blocked' })
        const blocker = await tracker.createIssue({ title: 'Blocker' })
        expect(blocked.data).toBeDefined()
        expect(blocker.data).toBeDefined()
        const blockedId = blocked.data?.id as string
        const blockerId = blocker.data?.id as string
        await tracker.addDependency(blockedId, blockerId)

        const result = await tracker.removeDependency(blockedId, blockerId)

        expect(result.success).toBe(true)
      })

      it('fails when dependency does not exist', async () => {
        const blocked = await tracker.createIssue({ title: 'Blocked' })
        const blocker = await tracker.createIssue({ title: 'Blocker' })
        expect(blocked.data).toBeDefined()
        expect(blocker.data).toBeDefined()
        const blockedId = blocked.data?.id as string
        const blockerId = blocker.data?.id as string

        const result = await tracker.removeDependency(blockedId, blockerId)

        expect(result.success).toBe(false)
        // Error message varies by implementation - can be "not found" or "does not exist"
        expect(result.error?.toLowerCase()).toMatch(/not found|does not exist/)
      })

      it('updates dependency counts after removal', async () => {
        const blocked = await tracker.createIssue({ title: 'Blocked' })
        const blocker = await tracker.createIssue({ title: 'Blocker' })
        expect(blocked.data).toBeDefined()
        expect(blocker.data).toBeDefined()
        const blockedId = blocked.data?.id as string
        const blockerId = blocker.data?.id as string
        await tracker.addDependency(blockedId, blockerId)
        await tracker.removeDependency(blockedId, blockerId)

        const blockedIssue = await tracker.getIssue(blockedId)
        const blockerIssue = await tracker.getIssue(blockerId)

        expect(blockedIssue.data?.dependency_count).toBe(0)
        expect(blockerIssue.data?.dependent_count).toBe(0)
      })
    })

    describe('getGraph', () => {
      it('returns empty graph for no issues', async () => {
        const result = await tracker.getGraph()

        expect(result.success).toBe(true)
        expect(result.data?.issues).toEqual([])
        expect(result.data?.dependencies).toEqual([])
      })

      it('returns issues without dependencies', async () => {
        await tracker.createIssue({ title: 'Issue 1' })
        await tracker.createIssue({ title: 'Issue 2' })

        const result = await tracker.getGraph()

        expect(result.success).toBe(true)
        expect(result.data?.issues.length).toBe(2)
        expect(result.data?.dependencies).toEqual([])
      })

      it('returns issues with dependencies', async () => {
        const a = await tracker.createIssue({ title: 'A' })
        const b = await tracker.createIssue({ title: 'B' })
        expect(a.data).toBeDefined()
        expect(b.data).toBeDefined()
        const aId = a.data?.id as string
        const bId = b.data?.id as string
        await tracker.addDependency(aId, bId)

        const result = await tracker.getGraph()

        expect(result.success).toBe(true)
        expect(result.data?.issues.length).toBe(2)
        expect(result.data?.dependencies.length).toBe(1)
        expect(result.data?.dependencies[0].issue_id).toBe(aId)
        expect(result.data?.dependencies[0].depends_on_id).toBe(bId)
      })

      it('includes issueMap', async () => {
        const issue = await tracker.createIssue({ title: 'Mapped issue' })
        expect(issue.data).toBeDefined()
        const issueId = issue.data?.id as string

        const result = await tracker.getGraph()

        expect(result.success).toBe(true)
        expect(result.data?.issueMap[issueId]).toBeDefined()
        expect(result.data?.issueMap[issueId].title).toBe('Mapped issue')
      })
    })

    describe('sync', () => {
      it('succeeds after modifications', async () => {
        await tracker.createIssue({ title: 'New issue' })

        const result = await tracker.sync()

        expect(result.success).toBe(true)
      })

      it('succeeds with no modifications', async () => {
        const result = await tracker.sync()

        expect(result.success).toBe(true)
      })
    })
  })
} // end for adapter loop
