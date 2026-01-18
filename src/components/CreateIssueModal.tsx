import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CreateIssueModalProps {
  isOpen: boolean
  onClose: () => void
  chatMessages: ChatMessage[]
  onSendMessage: (message: string) => void
  isChatLoading?: boolean
}

function CreateIssueModal({
  isOpen,
  onClose,
  chatMessages,
  onSendMessage,
  isChatLoading = false,
}: CreateIssueModalProps) {
  const [chatInput, setChatInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messageCount = chatMessages.length
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageCount, isChatLoading])

  const handleChatSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = chatInput.trim()
      if (trimmed && !isChatLoading) {
        onSendMessage(trimmed)
        setChatInput('')
      }
    },
    [chatInput, isChatLoading, onSendMessage]
  )

  const handleChatKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const trimmed = chatInput.trim()
        if (trimmed && !isChatLoading) {
          onSendMessage(trimmed)
          setChatInput('')
        }
      }
    },
    [chatInput, isChatLoading, onSendMessage]
  )

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        data-testid="create-issue-modal"
        className="sm:max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Assistant</DialogTitle>
        </DialogHeader>

        {/* Chat Section */}
        <div className="flex flex-col flex-1 min-h-0" data-testid="chat-panel">
          {/* Message History */}
          <div
            className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1"
            data-testid="message-history"
          >
            {chatMessages.length === 0 && (
              <div
                className="flex flex-col items-start"
                data-testid="welcome-message"
              >
                <div className="max-w-[90%] px-3 py-2 rounded-lg text-sm bg-white border shadow-sm rounded-bl-sm">
                  <div className="markdown-content prose prose-sm max-w-none">
                    <p>Hi! I can help you with:</p>
                    <ul>
                      <li>Create issues</li>
                      <li>Close issues</li>
                      <li>Add dependencies between issues</li>
                      <li>Answer questions about the project</li>
                    </ul>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">Assistant</div>
              </div>
            )}
            {chatMessages.map(message => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                data-testid={`message-${message.role}`}
              >
                <div
                  className={`max-w-[90%] px-3 py-2 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white border shadow-sm rounded-bl-sm'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="markdown-content prose prose-sm max-w-none">
                      <Markdown>{message.content}</Markdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex items-start" data-testid="loading-indicator">
                <div className="bg-white border shadow-sm px-3 py-2 rounded-lg rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.6s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="mt-2">
            <div className="relative">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="What do you want to do?"
                disabled={isChatLoading}
                rows={3}
                className="w-full px-3 py-2 pr-12 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="message-input"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="absolute right-2 bottom-3 w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                data-testid="send-button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <title>Send message</title>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        <style>{`
          .markdown-content p {
            margin: 0 0 4px 0;
          }
          .markdown-content p:last-child {
            margin-bottom: 0;
          }
          .markdown-content code {
            background-color: #f3f4f6;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 12px;
          }
          .markdown-content pre {
            background-color: #1f2937;
            color: #f9fafb;
            padding: 8px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 4px 0;
          }
          .markdown-content pre code {
            background-color: transparent;
            padding: 0;
            color: inherit;
          }
          .markdown-content ul, .markdown-content ol {
            margin: 4px 0;
            padding-left: 16px;
          }
          .markdown-content li {
            margin: 2px 0;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}

export default CreateIssueModal
