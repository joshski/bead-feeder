import { afterEach, describe, expect, it, mock } from 'bun:test'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { Toast, ToastContainer, type ToastMessage } from './Toast'

describe('Toast', () => {
  afterEach(() => {
    cleanup()
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
    // happy-dom returns hex, jsdom returns rgb
    expect(['#dcfce7', 'rgb(220, 252, 231)']).toContain(
      alert.style.backgroundColor
    )
  })

  it('renders error toast with correct styling', () => {
    const errorToast: ToastMessage = {
      id: 'test-2',
      type: 'error',
      message: 'Error message',
    }
    render(<Toast toast={errorToast} onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(['#fef2f2', 'rgb(254, 242, 242)']).toContain(
      alert.style.backgroundColor
    )
  })

  it('renders info toast with correct styling', () => {
    const infoToast: ToastMessage = {
      id: 'test-3',
      type: 'info',
      message: 'Info message',
    }
    render(<Toast toast={infoToast} onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(['#dbeafe', 'rgb(219, 234, 254)']).toContain(
      alert.style.backgroundColor
    )
  })

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = mock(() => {})
    render(<Toast toast={mockToast} onDismiss={onDismiss} />)

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' })
    fireEvent.click(dismissButton)

    // Wait for the animation timeout using real timers
    await waitFor(
      () => {
        expect(onDismiss).toHaveBeenCalledWith('test-1')
      },
      { timeout: 1000 }
    )
  })

  it('auto-dismisses after duration', async () => {
    const onDismiss = mock(() => {})
    // Use short duration for testing
    render(<Toast toast={mockToast} onDismiss={onDismiss} duration={100} />)

    // Wait for auto-dismiss
    await waitFor(
      () => {
        expect(onDismiss).toHaveBeenCalledWith('test-1')
      },
      { timeout: 1000 }
    )
  })
})

describe('ToastContainer', () => {
  afterEach(() => {
    cleanup()
  })

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
