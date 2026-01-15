import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IssueDetailModal from './IssueDetailModal'
import type { IssueNodeData } from './IssueNode'

const mockIssue: IssueNodeData = {
  issueId: 'test-issue-123',
  title: 'Test Issue Title',
  status: 'open',
  type: 'task',
  priority: 'P2',
}

describe('IssueDetailModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render when issue is null', () => {
    render(<IssueDetailModal issue={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('issue-detail-modal')).not.toBeInTheDocument()
  })

  it('renders when issue is provided', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-modal')).toBeInTheDocument()
  })

  it('displays issue title', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-title')).toHaveTextContent(
      'Test Issue Title'
    )
  })

  it('displays issue ID', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-id')).toHaveTextContent(
      'test-issue-123'
    )
  })

  it('displays issue status', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-status')).toHaveTextContent('Open')
  })

  it('displays issue type with icon', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-type')).toHaveTextContent('☐ Task')
  })

  it('displays issue priority', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-priority')).toHaveTextContent(
      'P2 - Medium'
    )
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<IssueDetailModal issue={mockIssue} onClose={onClose} />)
    // shadcn/ui Dialog X button has data-slot="dialog-close"
    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    // The X button is the one without data-testid (the first Close button)
    const xButton = closeButtons.find(btn => !btn.hasAttribute('data-testid'))
    if (xButton) {
      fireEvent.click(xButton)
    }
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Close button at bottom is clicked', () => {
    const onClose = vi.fn()
    render(<IssueDetailModal issue={mockIssue} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('close-button'))
    expect(onClose).toHaveBeenCalled()
  })

  it('displays in_progress status correctly', () => {
    const inProgressIssue: IssueNodeData = {
      ...mockIssue,
      status: 'in_progress',
    }
    render(<IssueDetailModal issue={inProgressIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-status')).toHaveTextContent(
      'In Progress'
    )
  })

  it('displays bug type with icon', () => {
    const bugIssue: IssueNodeData = {
      ...mockIssue,
      type: 'bug',
    }
    render(<IssueDetailModal issue={bugIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-type')).toHaveTextContent('🐛 Bug')
  })

  it('displays feature type with icon', () => {
    const featureIssue: IssueNodeData = {
      ...mockIssue,
      type: 'feature',
    }
    render(<IssueDetailModal issue={featureIssue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-type')).toHaveTextContent(
      '✨ Feature'
    )
  })

  it('displays P0 priority correctly', () => {
    const p0Issue: IssueNodeData = {
      ...mockIssue,
      priority: 'P0',
    }
    render(<IssueDetailModal issue={p0Issue} onClose={vi.fn()} />)
    expect(screen.getByTestId('issue-detail-priority')).toHaveTextContent(
      'P0 - Critical'
    )
  })
})
