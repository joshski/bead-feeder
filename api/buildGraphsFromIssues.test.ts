import { describe, expect, it } from 'vitest'
import { buildGraphsFromIssues } from './buildGraphsFromIssues'

describe('buildGraphsFromIssues', () => {
  it('returns empty array for empty issues', () => {
    const result = buildGraphsFromIssues([])
    expect(result).toEqual([])
  })

  it('creates a graph for a single issue with no dependencies', () => {
    const issues = [{ id: 'issue-1', title: 'Test Issue', status: 'open' }]

    const result = buildGraphsFromIssues(issues)

    expect(result).toHaveLength(1)
    expect(result[0].Root.id).toBe('issue-1')
    expect(result[0].Issues).toHaveLength(1)
    expect(result[0].Dependencies).toHaveLength(0)
    expect(result[0].IssueMap['issue-1']).toBeDefined()
  })

  it('creates correct dependencies array from issue dependencies', () => {
    const issues = [
      { id: 'issue-1', title: 'Root Issue', status: 'open' },
      {
        id: 'issue-2',
        title: 'Dependent Issue',
        status: 'open',
        dependencies: ['issue-1'],
      },
    ]

    const result = buildGraphsFromIssues(issues)

    expect(result[0].Dependencies).toHaveLength(1)
    expect(result[0].Dependencies[0]).toEqual({
      issue_id: 'issue-2',
      depends_on_id: 'issue-1',
      type: 'blocks',
    })
  })

  it('identifies root issues (those with no dependencies)', () => {
    const issues = [
      { id: 'root', title: 'Root Issue', status: 'open' },
      {
        id: 'child',
        title: 'Child Issue',
        status: 'open',
        dependencies: ['root'],
      },
    ]

    const result = buildGraphsFromIssues(issues)

    // Root issue should be used as the graph root
    expect(result).toHaveLength(1)
    expect(result[0].Root.id).toBe('root')
  })

  it('handles multiple root issues (creates multiple graphs)', () => {
    const issues = [
      { id: 'root-1', title: 'Root 1', status: 'open' },
      { id: 'root-2', title: 'Root 2', status: 'open' },
      { id: 'child', title: 'Child', status: 'open', dependencies: ['root-1'] },
    ]

    const result = buildGraphsFromIssues(issues)

    // Both root-1 and root-2 have no dependencies, so they're roots
    expect(result).toHaveLength(2)
    const rootIds = result.map(g => g.Root.id)
    expect(rootIds).toContain('root-1')
    expect(rootIds).toContain('root-2')
  })

  it('handles issues with multiple dependencies', () => {
    const issues = [
      { id: 'a', title: 'A', status: 'open' },
      { id: 'b', title: 'B', status: 'open' },
      { id: 'c', title: 'C', status: 'open', dependencies: ['a', 'b'] },
    ]

    const result = buildGraphsFromIssues(issues)

    // Two roots (a and b have no deps)
    expect(result).toHaveLength(2)
    // C depends on both a and b
    const deps = result[0].Dependencies
    expect(deps).toHaveLength(2)
    const depIds = deps.map(d => d.depends_on_id)
    expect(depIds).toContain('a')
    expect(depIds).toContain('b')
  })

  it('builds complete IssueMap for all issues', () => {
    const issues = [
      { id: 'issue-1', title: 'Issue 1', status: 'open' },
      { id: 'issue-2', title: 'Issue 2', status: 'in_progress' },
      { id: 'issue-3', title: 'Issue 3', status: 'closed' },
    ]

    const result = buildGraphsFromIssues(issues)

    const issueMap = result[0].IssueMap
    expect(Object.keys(issueMap)).toHaveLength(3)
    expect(issueMap['issue-1'].title).toBe('Issue 1')
    expect(issueMap['issue-2'].title).toBe('Issue 2')
    expect(issueMap['issue-3'].title).toBe('Issue 3')
  })

  it('preserves all issue properties', () => {
    const issues = [
      {
        id: 'issue-1',
        title: 'Test Issue',
        status: 'open',
        type: 'bug',
        priority: 1,
        dependencies: [],
      },
    ]

    const result = buildGraphsFromIssues(issues)

    const issue = result[0].IssueMap['issue-1']
    expect(issue.type).toBe('bug')
    expect(issue.priority).toBe(1)
  })

  it('handles circular dependencies (all issues become roots)', () => {
    // When all issues have dependencies, they might form a cycle
    // In this case, all issues are used as roots
    const issues = [
      { id: 'a', title: 'A', status: 'open', dependencies: ['b'] },
      { id: 'b', title: 'B', status: 'open', dependencies: ['a'] },
    ]

    const result = buildGraphsFromIssues(issues)

    // Both have dependencies, so neither is a natural root
    // The function should use all issues as roots in this case
    expect(result).toHaveLength(2)
  })
})
