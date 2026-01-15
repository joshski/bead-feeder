/**
 * Debug logging utilities for DAG rendering
 * These log statements are permanent and help diagnose rendering issues
 */

const DEBUG_PREFIX = '[DAG]'

/**
 * Check if debug logging is enabled
 * Enable via localStorage: localStorage.setItem('DAG_DEBUG', 'true')
 */
function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('DAG_DEBUG') === 'true'
}

/**
 * Log DAG-related debug information
 */
export function dagLog(message: string, data?: unknown): void {
  if (!isDebugEnabled()) return
  if (data !== undefined) {
    console.log(`${DEBUG_PREFIX} ${message}`, data)
  } else {
    console.log(`${DEBUG_PREFIX} ${message}`)
  }
}

/**
 * Log DAG warnings (always shown)
 */
export function dagWarn(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(`${DEBUG_PREFIX} ${message}`, data)
  } else {
    console.warn(`${DEBUG_PREFIX} ${message}`)
  }
}

/**
 * Log DAG errors (always shown)
 */
export function dagError(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.error(`${DEBUG_PREFIX} ${message}`, data)
  } else {
    console.error(`${DEBUG_PREFIX} ${message}`)
  }
}

/**
 * Log graph data summary
 */
export function logGraphSummary(
  issueCount: number,
  dependencyCount: number,
  nodeCount: number,
  edgeCount: number
): void {
  dagLog(
    `Graph summary: ${issueCount} issues, ${dependencyCount} dependencies → ${nodeCount} nodes, ${edgeCount} edges`
  )
}

/**
 * Log layout computation
 */
export function logLayoutComputed(
  nodeCount: number,
  direction: string,
  durationMs: number
): void {
  dagLog(
    `Layout computed: ${nodeCount} nodes, direction=${direction}, took ${durationMs.toFixed(1)}ms`
  )
}
