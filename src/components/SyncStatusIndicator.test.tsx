import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('displays conflict status with ahead/behind info', () => {
    render(
      <SyncStatusIndicator
        status="conflict"
        conflictInfo={{ ahead: 2, behind: 3 }}
      />
    )
    expect(screen.getByText('Conflict')).toBeDefined()
    expect(screen.getByText('(2 ahead, 3 behind)')).toBeDefined()
  })

  it('shows resolution buttons when in conflict state with onResolve', () => {
    const onResolve = vi.fn()
    render(
      <SyncStatusIndicator
        status="conflict"
        conflictInfo={{ ahead: 1, behind: 1 }}
        onResolve={onResolve}
      />
    )
    expect(screen.getByText('Pull')).toBeDefined()
    expect(screen.getByText('Abort')).toBeDefined()
  })

  it('calls onResolve with theirs when Pull is clicked', () => {
    const onResolve = vi.fn()
    render(
      <SyncStatusIndicator
        status="conflict"
        conflictInfo={{ ahead: 1, behind: 1 }}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByText('Pull'))
    expect(onResolve).toHaveBeenCalledWith('theirs')
  })

  it('calls onResolve with abort when Abort is clicked', () => {
    const onResolve = vi.fn()
    render(
      <SyncStatusIndicator
        status="conflict"
        conflictInfo={{ ahead: 1, behind: 1 }}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByText('Abort'))
    expect(onResolve).toHaveBeenCalledWith('abort')
  })

  it('does not show resolution buttons without onResolve callback', () => {
    render(
      <SyncStatusIndicator
        status="conflict"
        conflictInfo={{ ahead: 1, behind: 1 }}
      />
    )
    expect(screen.queryByText('Pull')).toBeNull()
    expect(screen.queryByText('Abort')).toBeNull()
  })
})
