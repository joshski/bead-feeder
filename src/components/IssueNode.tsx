import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { useNavigate } from 'react-router'

export type IssueStatus = 'open' | 'in_progress' | 'closed'
export type IssueType = 'task' | 'bug' | 'feature'
export type IssuePriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface IssueNodeData extends Record<string, unknown> {
  issueId: string
  title: string
  status: IssueStatus
  type: IssueType
  priority: IssuePriority
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

const typeIcons: Record<IssueType, string> = {
  task: '☐',
  bug: '🐛',
  feature: '✨',
}

const priorityColors: Record<IssuePriority, string> = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#6b7280',
}

function IssueNode({ data }: NodeProps) {
  const navigate = useNavigate()
  const issueData = data as unknown as IssueNodeData

  const handleClick = () => {
    navigate(`/issues/${issueData.issueId}`)
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
        minWidth: '180px',
        maxWidth: '250px',
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
      <Handle type="target" position={Position.Top} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '14px' }} data-testid="issue-type">
          {typeIcons[issueData.type]}
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: priorityColors[issueData.priority],
          }}
          data-testid="issue-priority"
        >
          {issueData.priority}
        </span>
      </div>

      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#1f2937',
          marginBottom: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        data-testid="issue-title"
      >
        {issueData.title}
      </div>

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

      <Handle type="source" position={Position.Bottom} />
    </button>
  )
}

export default IssueNode
