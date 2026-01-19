/**
 * IssueTracker module exports and factory function.
 */

export { BeadsIssueTracker } from './BeadsIssueTracker'
export { FakeIssueTracker } from './FakeIssueTracker'
export * from './IssueTracker'

import { BeadsIssueTracker } from './BeadsIssueTracker'
import { FakeIssueTracker } from './FakeIssueTracker'
import type { IssueTracker, IssueTrackerConfig } from './IssueTracker'

/**
 * Factory function to create an IssueTracker instance.
 * @param type - The type of tracker to create ('beads' or 'fake')
 * @param config - Configuration options
 */
export function createIssueTracker(
  type: 'beads' | 'fake',
  config?: IssueTrackerConfig
): IssueTracker {
  switch (type) {
    case 'beads':
      return new BeadsIssueTracker(config)
    case 'fake':
      return new FakeIssueTracker(config)
    default:
      throw new Error(`Unknown issue tracker type: ${type}`)
  }
}
