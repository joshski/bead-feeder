import { useCallback, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { IssueType } from './IssueNode'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CreateIssueModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (issue: CreateIssueData) => Promise<void>
  chatMessages: ChatMessage[]
  onSendMessage: (message: string) => void
  isChatLoading?: boolean
}

export interface CreateIssueData {
  title: string
  description?: string
  type: IssueType
  priority: number
}

const typeOptions: { value: IssueType; label: string; icon: string }[] = [
  { value: 'task', label: 'Task', icon: '☐' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
  { value: 'feature', label: 'Feature', icon: '✨' },
]

const priorityOptions = [
  { value: 0, label: 'P0 - Critical' },
  { value: 1, label: 'P1 - High' },
  { value: 2, label: 'P2 - Medium' },
  { value: 3, label: 'P3 - Low' },
]

function CreateIssueModal({
  isOpen,
  onClose,
  onSubmit,
  chatMessages,
  onSendMessage,
  isChatLoading = false,
}: CreateIssueModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IssueType>('task')
  const [priority, setPriority] = useState(2)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
      })
      setTitle('')
      setDescription('')
      setType('task')
      setPriority(2)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue')
    } finally {
      setIsSubmitting(false)
    }
  }

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
        className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription>
            Fill in the form or chat with AI to create an issue
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Form Section */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 space-y-4 overflow-y-auto pr-2"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter issue title"
                data-testid="title-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter issue description (optional)"
                rows={3}
                data-testid="description-input"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={type}
                  onValueChange={value => setType(value as IssueType)}
                >
                  <SelectTrigger
                    id="type"
                    className="w-full"
                    data-testid="type-select"
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={priority.toString()}
                  onValueChange={value => setPriority(Number(value))}
                >
                  <SelectTrigger
                    id="priority"
                    className="w-full"
                    data-testid="priority-select"
                  >
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                data-testid="error-message"
              >
                {error}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="submit-button"
              >
                {isSubmitting ? 'Creating...' : 'Create Issue'}
              </Button>
            </DialogFooter>
          </form>

          {/* Chat Section */}
          <div
            className="flex-1 flex flex-col border-l pl-4 min-h-0"
            data-testid="chat-panel"
          >
            <div className="text-sm font-medium text-gray-700 mb-2">
              AI Assistant
            </div>

            {/* Message History */}
            <div
              className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1"
              data-testid="message-history"
            >
              {chatMessages.length === 0 ? (
                <div
                  className="text-center text-gray-500 text-sm py-4"
                  data-testid="empty-state"
                >
                  Ask AI to help create issues
                </div>
              ) : (
                chatMessages.map(message => (
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
                ))
              )}
              {isChatLoading && (
                <div
                  className="flex items-start"
                  data-testid="loading-indicator"
                >
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
            <form onSubmit={handleChatSubmit} className="mt-2 flex gap-2">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Type a message..."
                disabled={isChatLoading}
                rows={1}
                className="flex-1 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="message-input"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isChatLoading || !chatInput.trim()}
                data-testid="send-button"
              >
                Send
              </Button>
            </form>
          </div>
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
