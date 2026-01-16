import { describe, expect, it } from 'vitest'
import type { BdIssue } from './issueToNode'
import { issuesToNodes, issueToNode } from './issueToNode'

const createMockIssue = (overrides: Partial<BdIssue> = {}): BdIssue => ({
  id: 'test-issue-123',
  title: 'Test Issue',
  description: 'A test issue',
  status: 'open',
  priority: 2,
  type: 'task',
  owner: 'test@example.com',
  created_at: '2026-01-14T00:00:00Z',
  created_by: 'Test User',
  updated_at: '2026-01-14T00:00:00Z',
  dependency_count: 0,
  dependent_count: 0,
  ...overrides,
})

describe('issueToNode', () => {
  it('transforms a bd issue to a React Flow node', () => {
    const issue = createMockIssue()
    const position = { x: 100, y: 200 }

    const node = issueToNode(issue, position)

    expect(node.id).toBe('test-issue-123')
    expect(node.type).toBe('issue')
    expect(node.position).toEqual({ x: 100, y: 200 })
    expect(node.data).toEqual({
      issueId: 'test-issue-123',
      title: 'Test Issue',
      description: 'A test issue',
      status: 'open',
      type: 'task',
      priority: 'P2',
    })
  })

  it('maps status correctly', () => {
    const openNode = issueToNode(createMockIssue({ status: 'open' }), {
      x: 0,
      y: 0,
    })
    expect(openNode.data.status).toBe('open')

    const inProgressNode = issueToNode(
      createMockIssue({ status: 'in_progress' }),
      { x: 0, y: 0 }
    )
    expect(inProgressNode.data.status).toBe('in_progress')

    const closedNode = issueToNode(createMockIssue({ status: 'closed' }), {
      x: 0,
      y: 0,
    })
    expect(closedNode.data.status).toBe('closed')
  })

  it('defaults unknown status to open', () => {
    const node = issueToNode(createMockIssue({ status: 'unknown' }), {
      x: 0,
      y: 0,
    })
    expect(node.data.status).toBe('open')
  })

  it('maps issue type correctly', () => {
    const taskNode = issueToNode(createMockIssue({ type: 'task' }), {
      x: 0,
      y: 0,
    })
    expect(taskNode.data.type).toBe('task')

    const bugNode = issueToNode(createMockIssue({ type: 'bug' }), {
      x: 0,
      y: 0,
    })
    expect(bugNode.data.type).toBe('bug')

    const featureNode = issueToNode(createMockIssue({ type: 'feature' }), {
      x: 0,
      y: 0,
    })
    expect(featureNode.data.type).toBe('feature')
  })

  it('defaults unknown issue type to task', () => {
    const node = issueToNode(createMockIssue({ type: 'unknown' }), {
      x: 0,
      y: 0,
    })
    expect(node.data.type).toBe('task')
  })

  it('maps priority correctly', () => {
    const p0Node = issueToNode(createMockIssue({ priority: 0 }), { x: 0, y: 0 })
    expect(p0Node.data.priority).toBe('P0')

    const p1Node = issueToNode(createMockIssue({ priority: 1 }), { x: 0, y: 0 })
    expect(p1Node.data.priority).toBe('P1')

    const p2Node = issueToNode(createMockIssue({ priority: 2 }), { x: 0, y: 0 })
    expect(p2Node.data.priority).toBe('P2')

    const p3Node = issueToNode(createMockIssue({ priority: 3 }), { x: 0, y: 0 })
    expect(p3Node.data.priority).toBe('P3')
  })

  it('defaults unknown priority to P2', () => {
    const node = issueToNode(createMockIssue({ priority: 99 }), { x: 0, y: 0 })
    expect(node.data.priority).toBe('P2')
  })
})

describe('issuesToNodes', () => {
  it('transforms an empty array to an empty array', () => {
    const nodes = issuesToNodes([])
    expect(nodes).toEqual([])
  })

  it('transforms a single issue with default position', () => {
    const issues = [createMockIssue()]
    const nodes = issuesToNodes(issues)

    expect(nodes).toHaveLength(1)
    expect(nodes[0].position).toEqual({ x: 0, y: 0 })
  })

  it('positions nodes in a grid layout', () => {
    const issues = [
      createMockIssue({ id: 'issue-1' }),
      createMockIssue({ id: 'issue-2' }),
      createMockIssue({ id: 'issue-3' }),
      createMockIssue({ id: 'issue-4' }),
      createMockIssue({ id: 'issue-5' }),
    ]

    const nodes = issuesToNodes(issues)

    expect(nodes).toHaveLength(5)
    // First row (4 nodes)
    expect(nodes[0].position).toEqual({ x: 0, y: 0 })
    expect(nodes[1].position).toEqual({ x: 300, y: 0 })
    expect(nodes[2].position).toEqual({ x: 600, y: 0 })
    expect(nodes[3].position).toEqual({ x: 900, y: 0 })
    // Second row (1 node)
    expect(nodes[4].position).toEqual({ x: 0, y: 150 })
  })

  it('respects custom options', () => {
    const issues = [
      createMockIssue({ id: 'issue-1' }),
      createMockIssue({ id: 'issue-2' }),
      createMockIssue({ id: 'issue-3' }),
    ]

    const nodes = issuesToNodes(issues, {
      startX: 50,
      startY: 100,
      spacingX: 200,
      spacingY: 100,
      nodesPerRow: 2,
    })

    expect(nodes).toHaveLength(3)
    // First row (2 nodes)
    expect(nodes[0].position).toEqual({ x: 50, y: 100 })
    expect(nodes[1].position).toEqual({ x: 250, y: 100 })
    // Second row (1 node)
    expect(nodes[2].position).toEqual({ x: 50, y: 200 })
  })

  it('preserves issue IDs as node IDs', () => {
    const issues = [
      createMockIssue({ id: 'bead-feeder-abc' }),
      createMockIssue({ id: 'bead-feeder-xyz' }),
    ]

    const nodes = issuesToNodes(issues)

    expect(nodes[0].id).toBe('bead-feeder-abc')
    expect(nodes[1].id).toBe('bead-feeder-xyz')
  })

  it('sets all nodes to issue type', () => {
    const issues = [
      createMockIssue({ id: 'issue-1' }),
      createMockIssue({ id: 'issue-2' }),
    ]

    const nodes = issuesToNodes(issues)

    expect(nodes.every(n => n.type === 'issue')).toBe(true)
  })
})
