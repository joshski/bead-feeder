import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Create a mock spawn function using vi.hoisted to allow use in vi.mock
const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}))

// Mock the child_process module
vi.mock('node:child_process', () => {
  return {
    default: {
      spawn: mockSpawn,
    },
    spawn: mockSpawn,
  }
})

import { executeTool } from './tool-executor'

describe('Tool Executor', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Helper to mock spawn for successful bd commands
  function mockSpawnSuccess(stdout: string) {
    const mockProcess = {
      stdout: {
        on: vi.fn((event: string, callback: (data: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from(stdout))
          }
        }),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          callback(0)
        }
      }),
    }
    mockSpawn.mockReturnValue(mockProcess)
  }

  // Helper to mock spawn for failed bd commands
  function mockSpawnFailure(stderr: string) {
    const mockProcess = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn((event: string, callback: (data: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from(stderr))
          }
        }),
      },
      on: vi.fn((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          callback(1)
        }
      }),
    }
    mockSpawn.mockReturnValue(mockProcess)
  }

  describe('executeTool', () => {
    it('returns error for unknown tool', async () => {
      const result = await executeTool('unknown_tool', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown tool')
    })
  })

  describe('create_issue', () => {
    it('creates an issue with title only', async () => {
      const mockResponse = JSON.stringify({
        id: 'test-issue-123',
        title: 'Tool Executor Test Issue',
        status: 'open',
        priority: 2,
        issue_type: 'task',
      })

      mockSpawnSuccess(mockResponse)

      const result = await executeTool('create_issue', {
        title: 'Tool Executor Test Issue',
      })

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('id')
      expect(result.result).toHaveProperty('title', 'Tool Executor Test Issue')
      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        ['create', 'Tool Executor Test Issue', '--json'],
        expect.any(Object)
      )
    })

    it('creates an issue with all fields', async () => {
      const mockResponse = JSON.stringify({
        id: 'test-issue-456',
        title: 'Full Tool Executor Test Issue',
        description: 'A test description',
        issue_type: 'bug',
        priority: 1,
        status: 'open',
      })

      mockSpawnSuccess(mockResponse)

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
      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        [
          'create',
          'Full Tool Executor Test Issue',
          '--json',
          '--description',
          'A test description',
          '--type',
          'bug',
          '--priority',
          '1',
        ],
        expect.any(Object)
      )
    })
  })

  describe('update_issue', () => {
    it('returns error for non-existent issue', async () => {
      mockSpawnFailure('Issue not found')

      const result = await executeTool('update_issue', {
        issue_id: 'nonexistent-issue-id-xyz',
        title: 'New Title',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('updates an issue successfully', async () => {
      const mockResponse = JSON.stringify({
        id: 'existing-issue-123',
        title: 'Updated Title',
        status: 'open',
      })

      mockSpawnSuccess(mockResponse)

      const result = await executeTool('update_issue', {
        issue_id: 'existing-issue-123',
        title: 'Updated Title',
      })

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('title', 'Updated Title')
    })
  })

  describe('close_issue', () => {
    it('returns error for non-existent issue', async () => {
      mockSpawnFailure('Issue not found')

      const result = await executeTool('close_issue', {
        issue_id: 'nonexistent-issue-id-xyz',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('closes an issue successfully', async () => {
      const mockResponse = JSON.stringify({
        id: 'existing-issue-123',
        title: 'Some Issue',
        status: 'closed',
      })

      mockSpawnSuccess(mockResponse)

      const result = await executeTool('close_issue', {
        issue_id: 'existing-issue-123',
      })

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('status', 'closed')
    })
  })

  describe('add_dependency', () => {
    it('returns error for non-existent issues', async () => {
      mockSpawnFailure('Issue not found')

      const result = await executeTool('add_dependency', {
        blocked_issue_id: 'nonexistent-blocked-xyz',
        blocker_issue_id: 'nonexistent-blocker-xyz',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('adds a dependency successfully', async () => {
      const mockResponse = JSON.stringify({
        issue_id: 'blocked-123',
        depends_on_id: 'blocker-456',
        type: 'blocks',
      })

      mockSpawnSuccess(mockResponse)

      const result = await executeTool('add_dependency', {
        blocked_issue_id: 'blocked-123',
        blocker_issue_id: 'blocker-456',
      })

      expect(result.success).toBe(true)
      expect(result.result).toHaveProperty('issue_id', 'blocked-123')
      expect(result.result).toHaveProperty('depends_on_id', 'blocker-456')
    })
  })

  describe('remove_dependency', () => {
    it('returns error for non-existent dependency', async () => {
      mockSpawnFailure('Dependency not found')

      const result = await executeTool('remove_dependency', {
        blocked_issue_id: 'nonexistent-blocked-xyz',
        blocker_issue_id: 'nonexistent-blocker-xyz',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('removes a dependency successfully', async () => {
      const mockResponse = JSON.stringify({
        success: true,
      })

      mockSpawnSuccess(mockResponse)

      const result = await executeTool('remove_dependency', {
        blocked_issue_id: 'blocked-123',
        blocker_issue_id: 'blocker-456',
      })

      expect(result.success).toBe(true)
    })
  })
})
