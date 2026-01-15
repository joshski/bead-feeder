// Dependency as stored in issues.jsonl (full object format)
interface IssueDependencyObject {
  issue_id: string
  depends_on_id: string
  type: string
  created_at?: string
  created_by?: string
}

export interface BdIssue {
  id: string
  title: string
  status: string
  type?: string
  priority?: number
  // Dependencies can be either string IDs (old format) or full objects (new format)
  dependencies?: (string | IssueDependencyObject)[]
}

export interface BdDependency {
  issue_id: string
  depends_on_id: string
  type: string
}

export interface GraphApiResponse {
  Root: BdIssue
  Issues: BdIssue[]
  Dependencies: BdDependency[]
  IssueMap: Record<string, BdIssue>
}

export function buildGraphsFromIssues(issues: BdIssue[]): GraphApiResponse[] {
  if (issues.length === 0) {
    return []
  }

  // Build dependency map: issue_id -> depends_on_ids
  const dependsOnMap = new Map<string, Set<string>>()
  // Build reverse map: issue_id -> issues that depend on it
  const dependedByMap = new Map<string, Set<string>>()

  for (const issue of issues) {
    if (issue.dependencies && Array.isArray(issue.dependencies)) {
      // Extract dependency IDs - handle both string format and object format
      const depIds: string[] = issue.dependencies.map(dep => {
        if (typeof dep === 'string') {
          return dep
        }
        // Object format: { issue_id, depends_on_id, type, ... }
        return dep.depends_on_id
      })

      dependsOnMap.set(issue.id, new Set(depIds))
      for (const depId of depIds) {
        if (!dependedByMap.has(depId)) {
          dependedByMap.set(depId, new Set())
        }
        dependedByMap.get(depId)?.add(issue.id)
      }
    }
  }

  // Find root issues (no incoming dependencies)
  const rootIssues = issues.filter(issue => {
    const deps = dependsOnMap.get(issue.id)
    return !deps || deps.size === 0
  })

  // If no roots found, all issues might be in cycles - use all as roots
  const roots = rootIssues.length > 0 ? rootIssues : issues

  // Build issue map
  const issueMap: Record<string, BdIssue> = {}
  for (const issue of issues) {
    issueMap[issue.id] = issue
  }

  // Build dependencies array
  const dependencies: BdDependency[] = []
  for (const issue of issues) {
    const deps = dependsOnMap.get(issue.id)
    if (deps) {
      for (const depId of deps) {
        dependencies.push({
          issue_id: issue.id,
          depends_on_id: depId,
          type: 'blocks',
        })
      }
    }
  }

  // Create one graph per root
  return roots.map(root => ({
    Root: root,
    Issues: issues,
    Dependencies: dependencies,
    IssueMap: issueMap,
  }))
}
