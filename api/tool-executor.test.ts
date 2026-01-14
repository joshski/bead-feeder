import { describe, expect, it } from 'vitest'
import { executeTool } from './tool-executor'

describe('Tool Executor', () => {
  describe('executeTool', () => {
    it('returns error for unknown tool', async () => {
      const result = await executeTool('unknown_tool', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown tool')
    })
  })

  describe('create_issue', () => {
    it('creates an issue with title only', async () => {
      const result = await executeTool('create_issue', {
        title: 'Tool Executor Test Issue',
      })

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('id')
      expect(result.result).toHaveProperty('title', 'Tool Executor Test Issue')
    })

    it('creates an issue with all fields', async () => {
      const result = await executeTool('create_issue', {
        title: 'Full Tool Executor Test Issue',
        description: 'A test description',
        type: 'bug',
        priority: 1,
      })

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty(
        'title',
        'Full Tool Executor Test Issue'
      )
      expect(result.result).toHaveProperty('description', 'A test description')
      expect(result.result).toHaveProperty('issue_type', 'bug')
      expect(result.result).toHaveProperty('priority', 1)
    })
  })

  describe('update_issue', () => {
    it('returns error for non-existent issue', async () => {
      const result = await executeTool('update_issue', {
        issue_id: 'nonexistent-issue-id-xyz',
        title: 'New Title',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('close_issue', () => {
    it('returns error for non-existent issue', async () => {
      const result = await executeTool('close_issue', {
        issue_id: 'nonexistent-issue-id-xyz',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('add_dependency', () => {
    it('returns error for non-existent issues', async () => {
      const result = await executeTool('add_dependency', {
        blocked_issue_id: 'nonexistent-blocked-xyz',
        blocker_issue_id: 'nonexistent-blocker-xyz',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('remove_dependency', () => {
    it('returns error for non-existent dependency', async () => {
      const result = await executeTool('remove_dependency', {
        blocked_issue_id: 'nonexistent-blocked-xyz',
        blocker_issue_id: 'nonexistent-blocker-xyz',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
