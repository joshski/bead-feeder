import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CreateIssueModal, { type ChatMessage } from './CreateIssueModal'

describe('CreateIssueModal', () => {
  const mockOnClose = mock(() => {})
  const mockOnSendMessage = mock(() => {})

  const getDefaultProps = () => ({
    isOpen: true,
    onClose: mockOnClose,
    chatMessages: [] as ChatMessage[],
    onSendMessage: mockOnSendMessage,
    isChatLoading: false,
  })

  beforeEach(() => {
    mockOnClose.mockClear()
    mockOnSendMessage.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render when isOpen is false', () => {
    render(<CreateIssueModal {...getDefaultProps()} isOpen={false} />)
    expect(screen.queryByTestId('create-issue-modal')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(<CreateIssueModal {...getDefaultProps()} />)
    expect(screen.getByTestId('create-issue-modal')).toBeInTheDocument()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = mock(() => {})
    render(<CreateIssueModal {...getDefaultProps()} onClose={onClose} />)
    // shadcn/ui Dialog uses a button with sr-only "Close" text
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  // Chat functionality tests
  describe('Chat functionality', () => {
    it('renders chat panel', () => {
      render(<CreateIssueModal {...getDefaultProps()} />)
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    })

    it('displays welcome message when no messages', () => {
      render(<CreateIssueModal {...getDefaultProps()} />)
      expect(screen.getByTestId('welcome-message')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Hi! I can create issues, close issues, add dependencies, and more.'
        )
      ).toBeInTheDocument()
    })

    it('renders user messages', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello there!' },
      ]
      render(
        <CreateIssueModal {...getDefaultProps()} chatMessages={messages} />
      )
      expect(screen.getByText('Hello there!')).toBeInTheDocument()
      expect(screen.getByTestId('message-user')).toBeInTheDocument()
      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('renders assistant messages with markdown', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'assistant', content: 'Here is **bold** text' },
      ]
      render(
        <CreateIssueModal {...getDefaultProps()} chatMessages={messages} />
      )
      const messageEl = screen.getByTestId('message-assistant')
      expect(messageEl).toBeInTheDocument()
      // Check that the message has the "Assistant" label (not the dialog title)
      expect(messageEl).toHaveTextContent('Assistant')
      expect(screen.getByText('bold')).toBeInTheDocument()
    })

    it('renders message input and send button', () => {
      render(<CreateIssueModal {...getDefaultProps()} />)
      expect(screen.getByTestId('message-input')).toBeInTheDocument()
      expect(screen.getByTestId('send-button')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('What do you want to do?')
      ).toBeInTheDocument()
    })

    it('calls onSendMessage when form is submitted', () => {
      const onSendMessage = mock(() => {})
      render(
        <CreateIssueModal
          {...getDefaultProps()}
          onSendMessage={onSendMessage}
        />
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
      const onSendMessage = mock(() => {})
      render(
        <CreateIssueModal
          {...getDefaultProps()}
          onSendMessage={onSendMessage}
        />
      )
      const input = screen.getByTestId('message-input')
      const button = screen.getByTestId('send-button')

      fireEvent.change(input, { target: { value: 'Button click message' } })
      fireEvent.click(button)

      expect(onSendMessage).toHaveBeenCalledWith('Button click message')
    })

    it('calls onSendMessage when Enter is pressed (without Shift)', () => {
      const onSendMessage = mock(() => {})
      render(
        <CreateIssueModal
          {...getDefaultProps()}
          onSendMessage={onSendMessage}
        />
      )
      const input = screen.getByTestId('message-input')

      fireEvent.change(input, { target: { value: 'Enter key message' } })
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

      expect(onSendMessage).toHaveBeenCalledWith('Enter key message')
    })

    it('does not send message when Shift+Enter is pressed', () => {
      const onSendMessage = mock(() => {})
      render(
        <CreateIssueModal
          {...getDefaultProps()}
          onSendMessage={onSendMessage}
        />
      )
      const input = screen.getByTestId('message-input')

      fireEvent.change(input, { target: { value: 'New line message' } })
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not send empty message', () => {
      const onSendMessage = mock(() => {})
      render(
        <CreateIssueModal
          {...getDefaultProps()}
          onSendMessage={onSendMessage}
        />
      )
      const button = screen.getByTestId('send-button')

      fireEvent.click(button)

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not send whitespace-only message', () => {
      const onSendMessage = mock(() => {})
      render(
        <CreateIssueModal
          {...getDefaultProps()}
          onSendMessage={onSendMessage}
        />
      )
      const input = screen.getByTestId('message-input')
      const button = screen.getByTestId('send-button')

      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.click(button)

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('disables input and button when loading', () => {
      render(<CreateIssueModal {...getDefaultProps()} isChatLoading />)
      const input = screen.getByTestId('message-input')
      const button = screen.getByTestId('send-button')

      expect(input).toBeDisabled()
      expect(button).toBeDisabled()
    })

    it('shows loading indicator when loading', () => {
      render(<CreateIssueModal {...getDefaultProps()} isChatLoading />)
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })

    it('does not send message when loading', () => {
      const onSendMessage = mock(() => {})
      render(
        <CreateIssueModal
          {...getDefaultProps()}
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
      render(
        <CreateIssueModal {...getDefaultProps()} chatMessages={messages} />
      )

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
      render(
        <CreateIssueModal {...getDefaultProps()} chatMessages={messages} />
      )

      expect(screen.getByText('console.log()')).toBeInTheDocument()
    })

    it('auto-scrolls to bottom when new messages are added', () => {
      const scrollIntoViewMock = mock(() => {})
      Element.prototype.scrollIntoView = scrollIntoViewMock

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'First message' },
      ]
      const { rerender } = render(
        <CreateIssueModal {...getDefaultProps()} chatMessages={messages} />
      )

      // Clear any scroll calls from initial render
      scrollIntoViewMock.mockClear()

      // Adding a new message triggers scroll
      const newMessages: ChatMessage[] = [
        ...messages,
        { id: '2', role: 'assistant', content: 'Second message' },
      ]
      rerender(
        <CreateIssueModal {...getDefaultProps()} chatMessages={newMessages} />
      )

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' })
    })

    it('auto-scrolls when loading state changes', () => {
      const scrollIntoViewMock = mock(() => {})
      Element.prototype.scrollIntoView = scrollIntoViewMock

      const { rerender } = render(<CreateIssueModal {...getDefaultProps()} />)
      scrollIntoViewMock.mockClear()

      // Changing to loading state triggers scroll
      rerender(<CreateIssueModal {...getDefaultProps()} isChatLoading />)
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' })
    })
  })
})
