import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { IssueNodeData } from './IssueNode'
import IssueNode from './IssueNode'

const defaultData: IssueNodeData = {
  issueId: 'issue-123',
  title: 'Fix authentication bug',
  status: 'open',
  type: 'bug',
  priority: 'P1',
}

function renderIssueNode(data: IssueNodeData = defaultData) {
  return render(
    <ReactFlowProvider>
      <IssueNode
        id="test-node"
        data={data as unknown as Record<string, unknown>}
        type="issue"
        dragging={false}
        draggable={true}
        zIndex={0}
        isConnectable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        selectable={true}
        deletable={false}
        selected={false}
      />
    </ReactFlowProvider>
  )
}

describe('IssueNode', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders issue title', () => {
    renderIssueNode()
    expect(screen.getByTestId('issue-title')).toHaveTextContent(
      'Fix authentication bug'
    )
  })

  it('renders issue status with correct label', () => {
    renderIssueNode()
    expect(screen.getByTestId('issue-status')).toHaveTextContent('Open')
  })

  it('renders in_progress status correctly', () => {
    renderIssueNode({ ...defaultData, status: 'in_progress' })
    expect(screen.getByTestId('issue-status')).toHaveTextContent('In Progress')
  })

  it('renders closed status correctly', () => {
    renderIssueNode({ ...defaultData, status: 'closed' })
    expect(screen.getByTestId('issue-status')).toHaveTextContent('Closed')
  })

  it('renders priority and type as combined text label', () => {
    renderIssueNode()
    expect(screen.getByTestId('issue-type-priority')).toHaveTextContent(
      'P1 bug'
    )
  })

  it('renders task type with priority', () => {
    renderIssueNode({ ...defaultData, type: 'task' })
    expect(screen.getByTestId('issue-type-priority')).toHaveTextContent(
      'P1 task'
    )
  })

  it('renders feature type with priority', () => {
    renderIssueNode({ ...defaultData, type: 'feature' })
    expect(screen.getByTestId('issue-type-priority')).toHaveTextContent(
      'P1 feature'
    )
  })

  it('calls onSelect callback on click when provided', () => {
    const onSelect = mock(() => {})
    const dataWithCallback: IssueNodeData = { ...defaultData, onSelect }
    renderIssueNode(dataWithCallback)
    fireEvent.click(screen.getByTestId('issue-node'))
    expect(onSelect).toHaveBeenCalledWith(dataWithCallback)
  })

  it('does not throw when clicked without onSelect callback', () => {
    renderIssueNode()
    expect(() => {
      fireEvent.click(screen.getByTestId('issue-node'))
    }).not.toThrow()
  })

  it('renders with different priorities', () => {
    renderIssueNode({ ...defaultData, priority: 'P0' })
    expect(screen.getByTestId('issue-type-priority')).toHaveTextContent(
      'P0 bug'
    )
  })
})
