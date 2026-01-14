import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DagCanvas from './DagCanvas'

describe('DagCanvas', () => {
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

  it('renders minimap', () => {
    render(<DagCanvas nodes={[]} edges={[]} />)

    const minimap = document.querySelector('.react-flow__minimap')
    expect(minimap).toBeDefined()
  })
})
