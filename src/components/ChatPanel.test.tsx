import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatPanel, { type ChatMessage } from './ChatPanel'

describe('ChatPanel', () => {
  const mockOnSendMessage = vi.fn()

  beforeEach(() => {
    mockOnSendMessage.mockClear()
  })

  it('renders the chat panel with header', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('displays empty state when no messages', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(
      screen.getByText('No messages yet. Start a conversation!')
    ).toBeInTheDocument()
  })

  it('renders user messages', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello there!' },
    ]
    render(<ChatPanel messages={messages} onSendMessage={mockOnSendMessage} />)
    expect(screen.getByText('Hello there!')).toBeInTheDocument()
    expect(screen.getByTestId('message-user')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('renders assistant messages with markdown', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'assistant', content: 'Here is **bold** text' },
    ]
    render(<ChatPanel messages={messages} onSendMessage={mockOnSendMessage} />)
    expect(screen.getByTestId('message-assistant')).toBeInTheDocument()
    expect(screen.getByText('Assistant')).toBeInTheDocument()
    expect(screen.getByText('bold')).toBeInTheDocument()
  })

  it('renders message input and send button', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    expect(screen.getByTestId('message-input')).toBeInTheDocument()
    expect(screen.getByTestId('send-button')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
  })

  it('calls onSendMessage when form is submitted', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    const input = screen.getByTestId('message-input')
    const form = input.closest('form')

    fireEvent.change(input, { target: { value: 'Test message' } })
    expect(form).not.toBeNull()
    fireEvent.submit(form as HTMLFormElement)

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
    expect(input).toHaveValue('')
  })

  it('calls onSendMessage when send button is clicked', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    const input = screen.getByTestId('message-input')
    const button = screen.getByTestId('send-button')

    fireEvent.change(input, { target: { value: 'Button click message' } })
    fireEvent.click(button)

    expect(mockOnSendMessage).toHaveBeenCalledWith('Button click message')
  })

  it('calls onSendMessage when Enter is pressed (without Shift)', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    const input = screen.getByTestId('message-input')

    fireEvent.change(input, { target: { value: 'Enter key message' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    expect(mockOnSendMessage).toHaveBeenCalledWith('Enter key message')
  })

  it('does not send message when Shift+Enter is pressed', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    const input = screen.getByTestId('message-input')

    fireEvent.change(input, { target: { value: 'New line message' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('does not send empty message', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    const button = screen.getByTestId('send-button')

    fireEvent.click(button)

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('does not send whitespace-only message', () => {
    render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />)
    const input = screen.getByTestId('message-input')
    const button = screen.getByTestId('send-button')

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(button)

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('disables input and button when loading', () => {
    render(
      <ChatPanel messages={[]} onSendMessage={mockOnSendMessage} isLoading />
    )
    const input = screen.getByTestId('message-input')
    const button = screen.getByTestId('send-button')

    expect(input).toBeDisabled()
    expect(button).toBeDisabled()
  })

  it('shows loading indicator when loading', () => {
    render(
      <ChatPanel messages={[]} onSendMessage={mockOnSendMessage} isLoading />
    )
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('does not send message when loading', () => {
    render(
      <ChatPanel messages={[]} onSendMessage={mockOnSendMessage} isLoading />
    )
    const input = screen.getByTestId('message-input')

    fireEvent.change(input, { target: { value: 'Loading message' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('renders multiple messages in order', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'First message' },
      { id: '2', role: 'assistant', content: 'Second message' },
      { id: '3', role: 'user', content: 'Third message' },
    ]
    render(<ChatPanel messages={messages} onSendMessage={mockOnSendMessage} />)

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
    render(<ChatPanel messages={messages} onSendMessage={mockOnSendMessage} />)

    expect(screen.getByText('console.log()')).toBeInTheDocument()
  })
})
