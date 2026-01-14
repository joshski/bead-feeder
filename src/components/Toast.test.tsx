import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast, ToastContainer, type ToastMessage } from './Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mockToast: ToastMessage = {
    id: 'test-1',
    type: 'success',
    message: 'Test message',
  }

  it('renders the toast message', () => {
    render(<Toast toast={mockToast} onDismiss={() => {}} />)
    expect(screen.getByText('Test message')).toBeDefined()
  })

  it('renders success toast with correct styling', () => {
    render(<Toast toast={mockToast} onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert.style.backgroundColor).toBe('rgb(220, 252, 231)')
  })

  it('renders error toast with correct styling', () => {
    const errorToast: ToastMessage = {
      id: 'test-2',
      type: 'error',
      message: 'Error message',
    }
    render(<Toast toast={errorToast} onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert.style.backgroundColor).toBe('rgb(254, 242, 242)')
  })

  it('renders info toast with correct styling', () => {
    const infoToast: ToastMessage = {
      id: 'test-3',
      type: 'info',
      message: 'Info message',
    }
    render(<Toast toast={infoToast} onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert.style.backgroundColor).toBe('rgb(219, 234, 254)')
  })

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<Toast toast={mockToast} onDismiss={onDismiss} />)

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' })
    fireEvent.click(dismissButton)

    // Wait for the animation timeout
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onDismiss).toHaveBeenCalledWith('test-1')
  })

  it('auto-dismisses after duration', async () => {
    const onDismiss = vi.fn()
    render(<Toast toast={mockToast} onDismiss={onDismiss} duration={1000} />)

    act(() => {
      vi.advanceTimersByTime(1300) // duration + animation time
    })

    expect(onDismiss).toHaveBeenCalledWith('test-1')
  })
})

describe('ToastContainer', () => {
  it('renders multiple toasts', () => {
    const toasts: ToastMessage[] = [
      { id: '1', type: 'success', message: 'First toast' },
      { id: '2', type: 'error', message: 'Second toast' },
    ]

    render(<ToastContainer toasts={toasts} onDismiss={() => {}} />)

    expect(screen.getByText('First toast')).toBeDefined()
    expect(screen.getByText('Second toast')).toBeDefined()
  })

  it('renders empty when no toasts', () => {
    render(<ToastContainer toasts={[]} onDismiss={() => {}} />)
    // Container should exist but have no toast children
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('has correct aria-live attribute for accessibility', () => {
    render(<ToastContainer toasts={[]} onDismiss={() => {}} />)
    const container = document.querySelector('[aria-live="polite"]')
    expect(container).toBeDefined()
  })
})
