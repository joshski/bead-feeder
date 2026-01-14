import { describe, expect, it } from 'vitest'
import {
  type BdDependency,
  dependenciesToEdges,
  dependencyToEdge,
} from './dependencyToEdge'

describe('dependencyToEdge', () => {
  it('creates an edge with the correct id', () => {
    const dependency: BdDependency = {
      issue_id: 'blocked-issue',
      depends_on_id: 'blocker-issue',
      type: 'blocks',
    }

    const edge = dependencyToEdge(dependency)

    expect(edge.id).toBe('blocker-issue-blocked-issue')
  })

  it('sets source to the blocker (depends_on_id)', () => {
    const dependency: BdDependency = {
      issue_id: 'blocked-issue',
      depends_on_id: 'blocker-issue',
      type: 'blocks',
    }

    const edge = dependencyToEdge(dependency)

    expect(edge.source).toBe('blocker-issue')
  })

  it('sets target to the blocked issue (issue_id)', () => {
    const dependency: BdDependency = {
      issue_id: 'blocked-issue',
      depends_on_id: 'blocker-issue',
      type: 'blocks',
    }

    const edge = dependencyToEdge(dependency)

    expect(edge.target).toBe('blocked-issue')
  })

  it('uses smoothstep edge type', () => {
    const dependency: BdDependency = {
      issue_id: 'issue-1',
      depends_on_id: 'issue-2',
      type: 'blocks',
    }

    const edge = dependencyToEdge(dependency)

    expect(edge.type).toBe('smoothstep')
  })

  it('creates non-animated edges', () => {
    const dependency: BdDependency = {
      issue_id: 'issue-1',
      depends_on_id: 'issue-2',
      type: 'blocks',
    }

    const edge = dependencyToEdge(dependency)

    expect(edge.animated).toBe(false)
  })

  it('handles dependencies with optional fields', () => {
    const dependency: BdDependency = {
      issue_id: 'issue-1',
      depends_on_id: 'issue-2',
      type: 'blocks',
      created_at: '2026-01-13T20:01:39.515583389Z',
      created_by: 'Josh Chisholm',
    }

    const edge = dependencyToEdge(dependency)

    expect(edge.id).toBe('issue-2-issue-1')
    expect(edge.source).toBe('issue-2')
    expect(edge.target).toBe('issue-1')
  })
})

describe('dependenciesToEdges', () => {
  it('returns empty array for empty input', () => {
    const edges = dependenciesToEdges([])

    expect(edges).toEqual([])
  })

  it('transforms single dependency', () => {
    const dependencies: BdDependency[] = [
      {
        issue_id: 'blocked',
        depends_on_id: 'blocker',
        type: 'blocks',
      },
    ]

    const edges = dependenciesToEdges(dependencies)

    expect(edges).toHaveLength(1)
    expect(edges[0].id).toBe('blocker-blocked')
  })

  it('transforms multiple dependencies', () => {
    const dependencies: BdDependency[] = [
      {
        issue_id: 'issue-a',
        depends_on_id: 'issue-b',
        type: 'blocks',
      },
      {
        issue_id: 'issue-c',
        depends_on_id: 'issue-b',
        type: 'blocks',
      },
      {
        issue_id: 'issue-a',
        depends_on_id: 'issue-c',
        type: 'blocks',
      },
    ]

    const edges = dependenciesToEdges(dependencies)

    expect(edges).toHaveLength(3)
    expect(edges.map(e => e.id)).toEqual([
      'issue-b-issue-a',
      'issue-b-issue-c',
      'issue-c-issue-a',
    ])
  })

  it('preserves edge direction for all edges', () => {
    const dependencies: BdDependency[] = [
      {
        issue_id: 'child-1',
        depends_on_id: 'parent',
        type: 'blocks',
      },
      {
        issue_id: 'child-2',
        depends_on_id: 'parent',
        type: 'blocks',
      },
    ]

    const edges = dependenciesToEdges(dependencies)

    expect(edges.every(e => e.source === 'parent')).toBe(true)
    expect(edges.map(e => e.target)).toEqual(['child-1', 'child-2'])
  })

  it('all edges use smoothstep type', () => {
    const dependencies: BdDependency[] = [
      { issue_id: 'a', depends_on_id: 'b', type: 'blocks' },
      { issue_id: 'c', depends_on_id: 'd', type: 'blocks' },
    ]

    const edges = dependenciesToEdges(dependencies)

    expect(edges.every(e => e.type === 'smoothstep')).toBe(true)
  })
})
