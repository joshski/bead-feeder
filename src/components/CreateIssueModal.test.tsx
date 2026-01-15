import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreateIssueModal from './CreateIssueModal'

describe('CreateIssueModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render when isOpen is false', () => {
    render(
      <CreateIssueModal isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    )
    expect(screen.queryByTestId('create-issue-modal')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(
      <CreateIssueModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    )
    expect(screen.getByTestId('create-issue-modal')).toBeInTheDocument()
  })

  it('renders all form fields', () => {
    render(
      <CreateIssueModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    )
    expect(screen.getByTestId('title-input')).toBeInTheDocument()
    expect(screen.getByTestId('description-input')).toBeInTheDocument()
    expect(screen.getByTestId('type-select')).toBeInTheDocument()
    expect(screen.getByTestId('priority-select')).toBeInTheDocument()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(
      <CreateIssueModal isOpen={true} onClose={onClose} onSubmit={vi.fn()} />
    )
    // shadcn/ui Dialog uses a button with sr-only "Close" text
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    render(
      <CreateIssueModal isOpen={true} onClose={onClose} onSubmit={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('cancel-button'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error when submitting without title', async () => {
    render(
      <CreateIssueModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('submit-button'))
    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Title is required'
    )
  })

  it('calls onSubmit with form data when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <CreateIssueModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />
    )

    fireEvent.change(screen.getByTestId('title-input'), {
      target: { value: 'New Issue Title' },
    })
    fireEvent.change(screen.getByTestId('description-input'), {
      target: { value: 'Issue description' },
    })
    // Note: Radix Select doesn't support native change events
    // Default values are task (type) and 2 (priority)

    fireEvent.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'New Issue Title',
        description: 'Issue description',
        type: 'task',
        priority: 2,
      })
    })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error when onSubmit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('API error'))
    render(
      <CreateIssueModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />
    )

    fireEvent.change(screen.getByTestId('title-input'), {
      target: { value: 'Test Issue' },
    })
    fireEvent.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('API error')
    })
  })

  it('disables submit button while submitting', async () => {
    const onSubmit = vi
      .fn()
      .mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
    render(
      <CreateIssueModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />
    )

    fireEvent.change(screen.getByTestId('title-input'), {
      target: { value: 'Test Issue' },
    })
    fireEvent.click(screen.getByTestId('submit-button'))

    expect(screen.getByTestId('submit-button')).toHaveTextContent('Creating...')
    expect(screen.getByTestId('submit-button')).toBeDisabled()
  })

  it('resets form after successful submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <CreateIssueModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />
    )

    fireEvent.change(screen.getByTestId('title-input'), {
      target: { value: 'Test Issue' },
    })
    fireEvent.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})
