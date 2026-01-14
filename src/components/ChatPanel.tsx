import { useCallback, useRef, useState } from 'react'
import Markdown from 'react-markdown'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
}

function ChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = inputValue.trim()
      if (trimmed && !isLoading) {
        onSendMessage(trimmed)
        setInputValue('')
      }
    },
    [inputValue, isLoading, onSendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const trimmed = inputValue.trim()
        if (trimmed && !isLoading) {
          onSendMessage(trimmed)
          setInputValue('')
        }
      }
    },
    [inputValue, isLoading, onSendMessage]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#f9fafb',
        borderLeft: '1px solid #e5e7eb',
      }}
      data-testid="chat-panel"
    >
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#1f2937',
          }}
        >
          Chat
        </h2>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}
        data-testid="message-history"
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '14px',
              marginTop: '24px',
            }}
            data-testid="empty-state"
          >
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              style={{
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
              data-testid={`message-${message.role}`}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius:
                    message.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  backgroundColor:
                    message.role === 'user' ? '#3b82f6' : '#ffffff',
                  color: message.role === 'user' ? '#ffffff' : '#1f2937',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                {message.role === 'assistant' ? (
                  <div
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.5',
                    }}
                    className="markdown-content"
                  >
                    <Markdown>{message.content}</Markdown>
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                    {message.content}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  marginTop: '4px',
                  paddingLeft: message.role === 'assistant' ? '4px' : '0',
                  paddingRight: message.role === 'user' ? '4px' : '0',
                }}
              >
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}
            data-testid="loading-indicator"
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '16px 16px 16px 4px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#9ca3af',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#9ca3af',
                    animation: 'pulse 1.5s infinite 0.3s',
                  }}
                />
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#9ca3af',
                    animation: 'pulse 1.5s infinite 0.6s',
                  }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          padding: '16px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '8px',
          }}
        >
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            data-testid="message-input"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor:
                isLoading || !inputValue.trim() ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              cursor:
                isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
            }}
            data-testid="send-button"
          >
            Send
          </button>
        </div>
      </form>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .markdown-content p {
          margin: 0 0 8px 0;
        }
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        .markdown-content code {
          background-color: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
        }
        .markdown-content pre {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
          color: inherit;
        }
        .markdown-content ul, .markdown-content ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .markdown-content li {
          margin: 4px 0;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          margin: 12px 0 8px 0;
          font-weight: 600;
        }
        .markdown-content a {
          color: #3b82f6;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default ChatPanel
