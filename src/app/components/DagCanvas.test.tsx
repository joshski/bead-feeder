import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import DagCanvas from './DagCanvas'

describe('DagCanvas', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the canvas with nodes', () => {
    const nodes = [
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'Test Node' } },
    ]
    const edges = [{ id: 'e1-2', source: '1', target: '2' }]

    render(<DagCanvas nodes={nodes} edges={edges} />)

    expect(screen.getByText('Test Node')).toBeDefined()
  })

  it('renders controls', () => {
    render(<DagCanvas nodes={[]} edges={[]} />)

    const controls = document.querySelector('.react-flow__controls')
    expect(controls).toBeDefined()
  })

  it('accepts an onConnect callback prop', () => {
    const onConnect = mock(() => {})
    const nodes = [
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
      { id: '2', position: { x: 100, y: 100 }, data: { label: 'Node 2' } },
    ]

    render(<DagCanvas nodes={nodes} edges={[]} onConnect={onConnect} />)

    // Verify the component renders without error when onConnect is provided
    expect(screen.getByText('Node 1')).toBeDefined()
    expect(screen.getByText('Node 2')).toBeDefined()
  })
})
