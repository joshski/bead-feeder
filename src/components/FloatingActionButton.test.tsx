import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the FAB', () => {
    render(<FloatingActionButton onClick={vi.fn()} />)
    expect(screen.getByTestId('fab-issue-assistant')).toBeInTheDocument()
  })

  it('displays plus icon as SVG', () => {
    render(<FloatingActionButton onClick={vi.fn()} />)
    const button = screen.getByTestId('fab-issue-assistant')
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelector('title')).toHaveTextContent('Plus')
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<FloatingActionButton onClick={onClick} />)
    fireEvent.click(screen.getByTestId('fab-issue-assistant'))
    expect(onClick).toHaveBeenCalled()
  })

  it('has default aria-label', () => {
    render(<FloatingActionButton onClick={vi.fn()} />)
    expect(screen.getByTestId('fab-issue-assistant')).toHaveAttribute(
      'aria-label',
      'Issue Assistant'
    )
  })

  it('accepts custom label', () => {
    render(<FloatingActionButton onClick={vi.fn()} label="Add new item" />)
    expect(screen.getByTestId('fab-issue-assistant')).toHaveAttribute(
      'aria-label',
      'Add new item'
    )
  })
})
