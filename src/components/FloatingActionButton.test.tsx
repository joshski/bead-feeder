import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the FAB', () => {
    render(<FloatingActionButton onClick={vi.fn()} />)
    expect(screen.getByTestId('fab-create-issue')).toBeInTheDocument()
  })

  it('displays plus icon', () => {
    render(<FloatingActionButton onClick={vi.fn()} />)
    expect(screen.getByTestId('fab-create-issue')).toHaveTextContent('+')
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<FloatingActionButton onClick={onClick} />)
    fireEvent.click(screen.getByTestId('fab-create-issue'))
    expect(onClick).toHaveBeenCalled()
  })

  it('has default aria-label', () => {
    render(<FloatingActionButton onClick={vi.fn()} />)
    expect(screen.getByTestId('fab-create-issue')).toHaveAttribute(
      'aria-label',
      'Create Issue'
    )
  })

  it('accepts custom label', () => {
    render(<FloatingActionButton onClick={vi.fn()} label="Add new item" />)
    expect(screen.getByTestId('fab-create-issue')).toHaveAttribute(
      'aria-label',
      'Add new item'
    )
  })
})
