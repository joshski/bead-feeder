import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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

interface CreateIssueModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (issue: CreateIssueData) => Promise<void>
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
}: CreateIssueModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IssueType>('task')
  const [priority, setPriority] = useState(2)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        data-testid="create-issue-modal"
        className="sm:max-w-[480px]"
      >
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <DialogFooter>
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
      </DialogContent>
    </Dialog>
  )
}

export default CreateIssueModal
