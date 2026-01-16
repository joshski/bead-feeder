import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'

export type IssueStatus = 'open' | 'in_progress' | 'closed'
export type IssueType = 'task' | 'bug' | 'feature'
export type IssuePriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface IssueNodeData extends Record<string, unknown> {
  issueId: string
  title: string
  description?: string
  status: IssueStatus
  type: IssueType
  priority: IssuePriority
  onSelect?: (data: IssueNodeData) => void
}

const statusColors: Record<IssueStatus, string> = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  closed: '#22c55e',
}

const statusLabels: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
}

const priorityColors: Record<IssuePriority, string> = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#6b7280',
}

function IssueNode({ data }: NodeProps) {
  const issueData = data as unknown as IssueNodeData

  const handleClick = () => {
    if (issueData.onSelect) {
      issueData.onSelect(issueData)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        border: `2px solid ${statusColors[issueData.status]}`,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
        width: '300px',
        textAlign: 'left',
        display: 'block',
        position: 'relative',
      }}
      data-testid="issue-node"
      data-issue-id={issueData.issueId}
      data-issue-status={issueData.status}
      data-issue-type={issueData.type}
      data-issue-priority={issueData.priority}
    >
      <Handle type="target" position={Position.Left} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: priorityColors[issueData.priority],
          }}
          data-testid="issue-type-priority"
        >
          {issueData.priority} {issueData.type}
        </span>
        <div
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: statusColors[issueData.status],
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 500,
          }}
          data-testid="issue-status"
        >
          {statusLabels[issueData.status]}
        </div>
      </div>

      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#1f2937',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        data-testid="issue-title"
      >
        {issueData.title}
      </div>

      <Handle type="source" position={Position.Right} />
    </button>
  )
}

export default IssueNode
