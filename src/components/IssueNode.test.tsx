import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IssueNodeData } from './IssueNode'
import IssueNode from './IssueNode'

const mockNavigate = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const defaultData: IssueNodeData = {
  issueId: 'issue-123',
  title: 'Fix authentication bug',
  status: 'open',
  type: 'bug',
  priority: 'P1',
}

function renderIssueNode(data: IssueNodeData = defaultData) {
  return render(
    <MemoryRouter>
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
    </MemoryRouter>
  )
}

describe('IssueNode', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

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

  it('renders issue type icon', () => {
    renderIssueNode()
    expect(screen.getByTestId('issue-type')).toHaveTextContent('🐛')
  })

  it('renders task type icon', () => {
    renderIssueNode({ ...defaultData, type: 'task' })
    expect(screen.getByTestId('issue-type')).toHaveTextContent('☐')
  })

  it('renders feature type icon', () => {
    renderIssueNode({ ...defaultData, type: 'feature' })
    expect(screen.getByTestId('issue-type')).toHaveTextContent('✨')
  })

  it('renders issue priority', () => {
    renderIssueNode()
    expect(screen.getByTestId('issue-priority')).toHaveTextContent('P1')
  })

  it('navigates to issue detail on click', () => {
    renderIssueNode()
    fireEvent.click(screen.getByTestId('issue-node'))
    expect(mockNavigate).toHaveBeenCalledWith('/issues/issue-123')
  })

  it('renders with different priorities', () => {
    renderIssueNode({ ...defaultData, priority: 'P0' })
    expect(screen.getByTestId('issue-priority')).toHaveTextContent('P0')
  })
})
