import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the FAB', () => {
    render(<FloatingActionButton onClick={mock(() => {})} />)
    expect(screen.getByTestId('fab-issue-assistant')).toBeInTheDocument()
  })

  it('displays plus icon as SVG', () => {
    render(<FloatingActionButton onClick={mock(() => {})} />)
    const button = screen.getByTestId('fab-issue-assistant')
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelector('title')).toHaveTextContent('Plus')
  })

  it('calls onClick when clicked', () => {
    const onClick = mock(() => {})
    render(<FloatingActionButton onClick={onClick} />)
    fireEvent.click(screen.getByTestId('fab-issue-assistant'))
    expect(onClick).toHaveBeenCalled()
  })

  it('has default aria-label', () => {
    render(<FloatingActionButton onClick={mock(() => {})} />)
    expect(screen.getByTestId('fab-issue-assistant')).toHaveAttribute(
      'aria-label',
      'Issue Assistant'
    )
  })

  it('accepts custom label', () => {
    render(
      <FloatingActionButton onClick={mock(() => {})} label="Add new item" />
    )
    expect(screen.getByTestId('fab-issue-assistant')).toHaveAttribute(
      'aria-label',
      'Add new item'
    )
  })

  it('is disabled when disabled prop is true', () => {
    render(<FloatingActionButton onClick={mock(() => {})} disabled={true} />)
    const button = screen.getByTestId('fab-issue-assistant')
    expect(button).toBeDisabled()
  })

  it('does not call onClick when disabled', () => {
    const onClick = mock(() => {})
    render(<FloatingActionButton onClick={onClick} disabled={true} />)
    fireEvent.click(screen.getByTestId('fab-issue-assistant'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('has grey background when disabled', () => {
    render(<FloatingActionButton onClick={mock(() => {})} disabled={true} />)
    const button = screen.getByTestId('fab-issue-assistant')
    expect(button.style.backgroundColor).toBe('#9ca3af')
  })

  it('has not-allowed cursor when disabled', () => {
    render(<FloatingActionButton onClick={mock(() => {})} disabled={true} />)
    const button = screen.getByTestId('fab-issue-assistant')
    expect(button.style.cursor).toBe('not-allowed')
  })
})
