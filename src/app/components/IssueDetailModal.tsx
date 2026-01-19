import Markdown from 'react-markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { IssueNodeData } from './IssueNode'

interface IssueDetailModalProps {
  issue: IssueNodeData | null
  onClose: () => void
}

const statusVariants: Record<string, string> = {
  open: 'bg-blue-500 text-white border-blue-500',
  in_progress: 'bg-amber-500 text-white border-amber-500',
  closed: 'bg-green-500 text-white border-green-500',
}

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
}

const typeLabels: Record<string, string> = {
  task: 'Task',
  bug: 'Bug',
  feature: 'Feature',
}

const priorityColors: Record<string, string> = {
  P0: 'text-red-500',
  P1: 'text-orange-500',
  P2: 'text-yellow-600',
  P3: 'text-gray-500',
}

const priorityLabels: Record<string, string> = {
  P0: 'P0 - Critical',
  P1: 'P1 - High',
  P2: 'P2 - Medium',
  P3: 'P3 - Low',
}

function IssueDetailModal({ issue, onClose }: IssueDetailModalProps) {
  const isOpen = issue !== null

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        data-testid="issue-detail-modal"
        className="sm:max-w-[480px] max-h-[80vh] flex flex-col overflow-hidden"
      >
        {issue && (
          <>
            <DialogHeader className="flex-shrink-0">
              <DialogTitle data-testid="issue-detail-title">
                {issue.title}
              </DialogTitle>
              <div
                className="mt-1 font-mono text-sm text-muted-foreground"
                data-testid="issue-detail-id"
              >
                {issue.issueId}
              </div>
            </DialogHeader>

            <div className="flex gap-4 flex-shrink-0">
              <div className="flex-1">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Status
                </div>
                <Badge
                  className={statusVariants[issue.status] || ''}
                  data-testid="issue-detail-status"
                >
                  {statusLabels[issue.status] || issue.status}
                </Badge>
              </div>

              <div className="flex-1">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Type
                </div>
                <div className="text-sm" data-testid="issue-detail-type">
                  {typeLabels[issue.type] || issue.type}
                </div>
              </div>

              <div className="flex-1">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Priority
                </div>
                <div
                  className={`text-sm font-semibold ${priorityColors[issue.priority] || 'text-gray-500'}`}
                  data-testid="issue-detail-priority"
                >
                  {priorityLabels[issue.priority] || issue.priority}
                </div>
              </div>
            </div>

            {issue.description && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground flex-shrink-0">
                  Description
                </div>
                <div
                  className="markdown-content prose prose-sm max-w-none text-foreground overflow-y-auto"
                  data-testid="issue-detail-description"
                >
                  <Markdown>{issue.description}</Markdown>
                </div>
              </div>
            )}

            <DialogFooter className="flex-shrink-0">
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="close-button"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default IssueDetailModal
