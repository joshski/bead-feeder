import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreateIssueModal, { type ChatMessage } from './CreateIssueModal'

describe('CreateIssueModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    chatMessages: [] as ChatMessage[],
    onSendMessage: vi.fn(),
    isChatLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render when isOpen is false', () => {
    render(<CreateIssueModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByTestId('create-issue-modal')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(<CreateIssueModal {...defaultProps} />)
    expect(screen.getByTestId('create-issue-modal')).toBeInTheDocument()
  })

  it('renders all form fields', () => {
    render(<CreateIssueModal {...defaultProps} />)
    expect(screen.getByTestId('title-input')).toBeInTheDocument()
    expect(screen.getByTestId('description-input')).toBeInTheDocument()
    expect(screen.getByTestId('type-select')).toBeInTheDocument()
    expect(screen.getByTestId('priority-select')).toBeInTheDocument()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<CreateIssueModal {...defaultProps} onClose={onClose} />)
    // shadcn/ui Dialog uses a button with sr-only "Close" text
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<CreateIssueModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('cancel-button'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error when submitting without title', async () => {
    render(<CreateIssueModal {...defaultProps} />)
    fireEvent.click(screen.getByTestId('submit-button'))
    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Title is required'
    )
  })

  it('calls onSubmit with form data when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <CreateIssueModal
        {...defaultProps}
        onClose={onClose}
        onSubmit={onSubmit}
      />
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
    render(<CreateIssueModal {...defaultProps} onSubmit={onSubmit} />)

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
    render(<CreateIssueModal {...defaultProps} onSubmit={onSubmit} />)

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
      <CreateIssueModal
        {...defaultProps}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByTestId('title-input'), {
      target: { value: 'Test Issue' },
    })
    fireEvent.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  // Chat functionality tests
  describe('Chat functionality', () => {
    it('renders chat panel', () => {
      render(<CreateIssueModal {...defaultProps} />)
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('displays empty state when no messages', () => {
      render(<CreateIssueModal {...defaultProps} />)
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(
        screen.getByText('Ask AI to help create issues')
      ).toBeInTheDocument()
    })

    it('renders user messages', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello there!' },
      ]
      render(<CreateIssueModal {...defaultProps} chatMessages={messages} />)
      expect(screen.getByText('Hello there!')).toBeInTheDocument()
      expect(screen.getByTestId('message-user')).toBeInTheDocument()
      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('renders assistant messages with markdown', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'assistant', content: 'Here is **bold** text' },
      ]
      render(<CreateIssueModal {...defaultProps} chatMessages={messages} />)
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument()
      expect(screen.getByText('Assistant')).toBeInTheDocument()
      expect(screen.getByText('bold')).toBeInTheDocument()
    })

    it('renders message input and send button', () => {
      render(<CreateIssueModal {...defaultProps} />)
      expect(screen.getByTestId('message-input')).toBeInTheDocument()
      expect(screen.getByTestId('send-button')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('Type a message...')
      ).toBeInTheDocument()
    })

    it('calls onSendMessage when form is submitted', () => {
      const onSendMessage = vi.fn()
      render(
        <CreateIssueModal {...defaultProps} onSendMessage={onSendMessage} />
      )
      const input = screen.getByTestId('message-input')
      const form = input.closest('form')

      fireEvent.change(input, { target: { value: 'Test message' } })
      expect(form).not.toBeNull()
      fireEvent.submit(form as HTMLFormElement)

      expect(onSendMessage).toHaveBeenCalledWith('Test message')
      expect(input).toHaveValue('')
    })

    it('calls onSendMessage when send button is clicked', () => {
      const onSendMessage = vi.fn()
      render(
        <CreateIssueModal {...defaultProps} onSendMessage={onSendMessage} />
      )
      const input = screen.getByTestId('message-input')
      const button = screen.getByTestId('send-button')

      fireEvent.change(input, { target: { value: 'Button click message' } })
      fireEvent.click(button)

      expect(onSendMessage).toHaveBeenCalledWith('Button click message')
    })

    it('calls onSendMessage when Enter is pressed (without Shift)', () => {
      const onSendMessage = vi.fn()
      render(
        <CreateIssueModal {...defaultProps} onSendMessage={onSendMessage} />
      )
      const input = screen.getByTestId('message-input')

      fireEvent.change(input, { target: { value: 'Enter key message' } })
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

      expect(onSendMessage).toHaveBeenCalledWith('Enter key message')
    })

    it('does not send message when Shift+Enter is pressed', () => {
      const onSendMessage = vi.fn()
      render(
        <CreateIssueModal {...defaultProps} onSendMessage={onSendMessage} />
      )
      const input = screen.getByTestId('message-input')

      fireEvent.change(input, { target: { value: 'New line message' } })
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not send empty message', () => {
      const onSendMessage = vi.fn()
      render(
        <CreateIssueModal {...defaultProps} onSendMessage={onSendMessage} />
      )
      const button = screen.getByTestId('send-button')

      fireEvent.click(button)

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not send whitespace-only message', () => {
      const onSendMessage = vi.fn()
      render(
        <CreateIssueModal {...defaultProps} onSendMessage={onSendMessage} />
      )
      const input = screen.getByTestId('message-input')
      const button = screen.getByTestId('send-button')

      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.click(button)

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('disables input and button when loading', () => {
      render(<CreateIssueModal {...defaultProps} isChatLoading />)
      const input = screen.getByTestId('message-input')
      const button = screen.getByTestId('send-button')

      expect(input).toBeDisabled()
      expect(button).toBeDisabled()
    })

    it('shows loading indicator when loading', () => {
      render(<CreateIssueModal {...defaultProps} isChatLoading />)
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })

    it('does not send message when loading', () => {
      const onSendMessage = vi.fn()
      render(
        <CreateIssueModal
          {...defaultProps}
          onSendMessage={onSendMessage}
          isChatLoading
        />
      )
      const input = screen.getByTestId('message-input')

      fireEvent.change(input, { target: { value: 'Loading message' } })
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('renders multiple messages in order', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'First message' },
        { id: '2', role: 'assistant', content: 'Second message' },
        { id: '3', role: 'user', content: 'Third message' },
      ]
      render(<CreateIssueModal {...defaultProps} chatMessages={messages} />)

      expect(screen.getByText('First message')).toBeInTheDocument()
      expect(screen.getByText('Second message')).toBeInTheDocument()
      expect(screen.getByText('Third message')).toBeInTheDocument()
    })

    it('renders markdown code blocks', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'assistant',
          content: 'Use `console.log()` for debugging',
        },
      ]
      render(<CreateIssueModal {...defaultProps} chatMessages={messages} />)

      expect(screen.getByText('console.log()')).toBeInTheDocument()
    })
  })
})
