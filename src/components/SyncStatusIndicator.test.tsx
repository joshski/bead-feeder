import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SyncStatusIndicator from './SyncStatusIndicator'

describe('SyncStatusIndicator', () => {
  it('displays synced status with green indicator', () => {
    render(<SyncStatusIndicator status="synced" />)
    expect(screen.getByText('Synced')).toBeDefined()
  })

  it('displays syncing status with animated indicator', () => {
    render(<SyncStatusIndicator status="syncing" />)
    expect(screen.getByText('Syncing...')).toBeDefined()
  })

  it('displays pending status with amber indicator', () => {
    render(<SyncStatusIndicator status="pending" />)
    expect(screen.getByText('Pending changes')).toBeDefined()
  })

  it('displays error status with red indicator', () => {
    render(<SyncStatusIndicator status="error" />)
    expect(screen.getByText('Sync error')).toBeDefined()
  })

  it('shows last sync time when synced', () => {
    const recentTime = Date.now() - 30000 // 30 seconds ago
    render(<SyncStatusIndicator status="synced" lastSyncTime={recentTime} />)
    expect(screen.getByText('just now')).toBeDefined()
  })

  it('formats last sync time in minutes', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    render(
      <SyncStatusIndicator status="synced" lastSyncTime={fiveMinutesAgo} />
    )
    expect(screen.getByText('5m ago')).toBeDefined()
  })

  it('formats last sync time in hours', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    render(<SyncStatusIndicator status="synced" lastSyncTime={twoHoursAgo} />)
    expect(screen.getByText('2h ago')).toBeDefined()
  })

  it('shows error message in title', () => {
    render(
      <SyncStatusIndicator
        status="error"
        errorMessage="Failed to push changes"
      />
    )
    const container = screen.getByText('Sync error').closest('div')
    expect(container?.getAttribute('title')).toBe('Failed to push changes')
  })
})
