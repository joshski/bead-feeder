import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SyncStatusIndicator from './SyncStatusIndicator'

describe('SyncStatusIndicator', () => {
  afterEach(() => {
    cleanup()
  })

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

  it('shows refresh button when onRefresh is provided', () => {
    const onRefresh = mock(() => {})
    render(<SyncStatusIndicator status="synced" onRefresh={onRefresh} />)
    expect(screen.getByTestId('refresh-button')).toBeDefined()
  })

  it('does not show refresh button without onRefresh callback', () => {
    render(<SyncStatusIndicator status="synced" />)
    expect(screen.queryByTestId('refresh-button')).toBeNull()
  })

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = mock(() => {})
    render(<SyncStatusIndicator status="synced" onRefresh={onRefresh} />)
    fireEvent.click(screen.getByTestId('refresh-button'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('disables refresh button when syncing', () => {
    const onRefresh = mock(() => {})
    render(<SyncStatusIndicator status="syncing" onRefresh={onRefresh} />)
    const button = screen.getByTestId('refresh-button')
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('spins refresh icon when syncing', () => {
    const onRefresh = mock(() => {})
    render(<SyncStatusIndicator status="syncing" onRefresh={onRefresh} />)
    const button = screen.getByTestId('refresh-button')
    const svg = button.querySelector('svg')
    expect(svg?.style.animation).toBe('spin 1s linear infinite')
  })

  it('does not spin refresh icon when synced', () => {
    const onRefresh = mock(() => {})
    render(<SyncStatusIndicator status="synced" onRefresh={onRefresh} />)
    const button = screen.getByTestId('refresh-button')
    const svg = button.querySelector('svg')
    expect(svg?.style.animation).toBe('')
  })
})
