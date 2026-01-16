import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeIssueTracker } from './issue-tracker'
import { executeTool } from './tool-executor'

describe('Tool Executor', () => {
  let tracker: FakeIssueTracker

  beforeEach(() => {
    tracker = new FakeIssueTracker()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('executeTool', () => {
    it('returns error for unknown tool', async () => {
      const result = await executeTool('unknown_tool', {}, tracker)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown tool')
    })
  })

  describe('create_issue', () => {
    it('creates an issue with title only', async () => {
      const result = await executeTool(
        'create_issue',
        {
          title: 'Tool Executor Test Issue',
        },
        tracker
      )

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('id')
      expect(result.result).toHaveProperty('title', 'Tool Executor Test Issue')
      expect(result.commitMessage).toContain('Create issue')
      expect(result.commitMessage).toContain('Tool Executor Test Issue')
    })

    it('creates an issue with all fields', async () => {
      const result = await executeTool(
        'create_issue',
        {
          title: 'Full Tool Executor Test Issue',
          description: 'A test description',
          type: 'bug',
          priority: 1,
        },
        tracker
      )

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty(
        'title',
        'Full Tool Executor Test Issue'
      )
      expect(result.result).toHaveProperty('description', 'A test description')
      expect(result.result).toHaveProperty('type', 'bug')
      expect(result.result).toHaveProperty('priority', 1)
    })
  })

  describe('update_issue', () => {
    it('returns error for non-existent issue', async () => {
      const result = await executeTool(
        'update_issue',
        {
          issue_id: 'nonexistent-issue-id-xyz',
          title: 'New Title',
        },
        tracker
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('updates an issue successfully', async () => {
      // First create an issue
      const createResult = await tracker.createIssue({
        title: 'Original Title',
      })
      const issueId = createResult.data?.id as string

      const result = await executeTool(
        'update_issue',
        {
          issue_id: issueId,
          title: 'Updated Title',
        },
        tracker
      )

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('title', 'Updated Title')
      expect(result.commitMessage).toBe(
        `feat(beads): Update issue ${issueId} (title)`
      )
    })

    it('includes all updated fields in commit message', async () => {
      // First create an issue
      const createResult = await tracker.createIssue({
        title: 'Original Title',
      })
      const issueId = createResult.data?.id as string

      const result = await executeTool(
        'update_issue',
        {
          issue_id: issueId,
          status: 'in_progress',
          priority: 1,
        },
        tracker
      )

      expect(result.success).toBe(true)
      expect(result.commitMessage).toBe(
        `feat(beads): Update issue ${issueId} (status -> in_progress, priority -> P1)`
      )
    })
  })

  describe('close_issue', () => {
    it('returns error for non-existent issue', async () => {
      const result = await executeTool(
        'close_issue',
        {
          issue_id: 'nonexistent-issue-id-xyz',
        },
        tracker
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('closes an issue successfully', async () => {
      // First create an issue
      const createResult = await tracker.createIssue({ title: 'Some Issue' })
      const issueId = createResult.data?.id as string

      const result = await executeTool(
        'close_issue',
        {
          issue_id: issueId,
        },
        tracker
      )

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('status', 'closed')
      expect(result.commitMessage).toBe(`feat(beads): Close issue ${issueId}`)
    })
  })

  describe('add_dependency', () => {
    it('returns error for non-existent issues', async () => {
      const result = await executeTool(
        'add_dependency',
        {
          blocked_issue_id: 'nonexistent-blocked-xyz',
          blocker_issue_id: 'nonexistent-blocker-xyz',
        },
        tracker
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('adds a dependency successfully', async () => {
      // First create two issues
      const blocked = await tracker.createIssue({ title: 'Blocked Task' })
      const blocker = await tracker.createIssue({ title: 'Blocker Task' })
      const blockedId = blocked.data?.id as string
      const blockerId = blocker.data?.id as string

      const result = await executeTool(
        'add_dependency',
        {
          blocked_issue_id: blockedId,
          blocker_issue_id: blockerId,
        },
        tracker
      )

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('issue_id', blockedId)
      expect(result.result).toHaveProperty('depends_on_id', blockerId)
      expect(result.commitMessage).toBe(
        `feat(beads): Add dependency ${blockerId} blocks ${blockedId}`
      )
    })
  })

  describe('remove_dependency', () => {
    it('returns error for non-existent dependency', async () => {
      // Create issues but don't add a dependency
      const blocked = await tracker.createIssue({ title: 'Blocked Task' })
      const blocker = await tracker.createIssue({ title: 'Blocker Task' })
      const blockedId = blocked.data?.id as string
      const blockerId = blocker.data?.id as string

      const result = await executeTool(
        'remove_dependency',
        {
          blocked_issue_id: blockedId,
          blocker_issue_id: blockerId,
        },
        tracker
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('removes a dependency successfully', async () => {
      // First create two issues and add a dependency
      const blocked = await tracker.createIssue({ title: 'Blocked Task' })
      const blocker = await tracker.createIssue({ title: 'Blocker Task' })
      const blockedId = blocked.data?.id as string
      const blockerId = blocker.data?.id as string
      await tracker.addDependency(blockedId, blockerId)

      const result = await executeTool(
        'remove_dependency',
        {
          blocked_issue_id: blockedId,
          blocker_issue_id: blockerId,
        },
        tracker
      )

      expect(result.success).toBe(true)
      expect(result.commitMessage).toBe(
        `feat(beads): Remove dependency ${blockerId} blocks ${blockedId}`
      )
    })
  })
})
