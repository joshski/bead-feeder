import { describe, expect, it } from 'bun:test'
import type { Edge, Node } from '@xyflow/react'
import { applyDagLayout } from './dagLayout'

function findNodeById(nodes: Node[], id: string): Node {
  const node = nodes.find(n => n.id === id)
  if (!node) throw new Error(`Node with id "${id}" not found`)
  return node
}

describe('applyDagLayout', () => {
  it('returns empty array for empty nodes', () => {
    const result = applyDagLayout([], [])
    expect(result).toEqual([])
  })

  it('positions a single node', () => {
    const nodes: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, data: {} }]
    const result = applyDagLayout(nodes, [])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
    expect(result[0].position.x).toBeDefined()
    expect(result[0].position.y).toBeDefined()
  })

  it('positions independent nodes horizontally in TB layout', () => {
    const nodes: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 0, y: 0 }, data: {} },
      { id: 'c', position: { x: 0, y: 0 }, data: {} },
    ]
    const result = applyDagLayout(nodes, [], { direction: 'TB' })

    expect(result).toHaveLength(3)
    // All nodes should be on the same row (same y)
    const yValues = result.map(n => n.position.y)
    expect(yValues[0]).toBe(yValues[1])
    expect(yValues[1]).toBe(yValues[2])
  })

  it('positions dependent node below parent in TB layout', () => {
    const nodes: Node[] = [
      { id: 'parent', position: { x: 0, y: 0 }, data: {} },
      { id: 'child', position: { x: 0, y: 0 }, data: {} },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'parent', target: 'child' }]
    const result = applyDagLayout(nodes, edges, { direction: 'TB' })

    const parent = findNodeById(result, 'parent')
    const child = findNodeById(result, 'child')

    // Child should be below parent in TB layout
    expect(child.position.y).toBeGreaterThan(parent.position.y)
  })

  it('positions dependent node to the right in LR layout', () => {
    const nodes: Node[] = [
      { id: 'parent', position: { x: 0, y: 0 }, data: {} },
      { id: 'child', position: { x: 0, y: 0 }, data: {} },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'parent', target: 'child' }]
    const result = applyDagLayout(nodes, edges, { direction: 'LR' })

    const parent = findNodeById(result, 'parent')
    const child = findNodeById(result, 'child')

    // Child should be to the right of parent in LR layout
    expect(child.position.x).toBeGreaterThan(parent.position.x)
  })

  it('handles multi-level dependencies', () => {
    const nodes: Node[] = [
      { id: 'root', position: { x: 0, y: 0 }, data: {} },
      { id: 'mid', position: { x: 0, y: 0 }, data: {} },
      { id: 'leaf', position: { x: 0, y: 0 }, data: {} },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'root', target: 'mid' },
      { id: 'e2', source: 'mid', target: 'leaf' },
    ]
    const result = applyDagLayout(nodes, edges, { direction: 'TB' })

    const root = findNodeById(result, 'root')
    const mid = findNodeById(result, 'mid')
    const leaf = findNodeById(result, 'leaf')

    // Should be in order: root -> mid -> leaf
    expect(mid.position.y).toBeGreaterThan(root.position.y)
    expect(leaf.position.y).toBeGreaterThan(mid.position.y)
  })

  it('handles diamond dependencies', () => {
    // A diamond: root -> left, root -> right, left -> bottom, right -> bottom
    const nodes: Node[] = [
      { id: 'root', position: { x: 0, y: 0 }, data: {} },
      { id: 'left', position: { x: 0, y: 0 }, data: {} },
      { id: 'right', position: { x: 0, y: 0 }, data: {} },
      { id: 'bottom', position: { x: 0, y: 0 }, data: {} },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'root', target: 'left' },
      { id: 'e2', source: 'root', target: 'right' },
      { id: 'e3', source: 'left', target: 'bottom' },
      { id: 'e4', source: 'right', target: 'bottom' },
    ]
    const result = applyDagLayout(nodes, edges, { direction: 'TB' })

    const root = findNodeById(result, 'root')
    const left = findNodeById(result, 'left')
    const right = findNodeById(result, 'right')
    const bottom = findNodeById(result, 'bottom')

    // Root should be at the top
    expect(left.position.y).toBeGreaterThan(root.position.y)
    expect(right.position.y).toBeGreaterThan(root.position.y)
    // Left and right should be on the same level
    expect(left.position.y).toBe(right.position.y)
    // Bottom should be below left and right
    expect(bottom.position.y).toBeGreaterThan(left.position.y)
  })

  it('preserves node data', () => {
    const nodes: Node<{ label: string }>[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Node A' } },
    ]
    const result = applyDagLayout(nodes, [])

    expect(result[0].data.label).toBe('Node A')
  })

  it('preserves node type', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'issue', position: { x: 0, y: 0 }, data: {} },
    ]
    const result = applyDagLayout(nodes, [])

    expect(result[0].type).toBe('issue')
  })

  it('respects custom spacing options', () => {
    const nodes: Node[] = [
      { id: 'parent', position: { x: 0, y: 0 }, data: {} },
      { id: 'child', position: { x: 0, y: 0 }, data: {} },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'parent', target: 'child' }]

    // Use larger spacing
    const result = applyDagLayout(nodes, edges, {
      direction: 'TB',
      nodeSpacingY: 200,
      nodeHeight: 100,
    })

    const parent = findNodeById(result, 'parent')
    const child = findNodeById(result, 'child')

    // The vertical distance should be at least the nodeSpacingY + nodeHeight
    const verticalDistance = child.position.y - parent.position.y
    expect(verticalDistance).toBeGreaterThanOrEqual(200)
  })

  it('handles nodes without edges (isolated nodes)', () => {
    const nodes: Node[] = [
      { id: 'connected1', position: { x: 0, y: 0 }, data: {} },
      { id: 'connected2', position: { x: 0, y: 0 }, data: {} },
      { id: 'isolated', position: { x: 0, y: 0 }, data: {} },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'connected1', target: 'connected2' },
    ]
    const result = applyDagLayout(nodes, edges, { direction: 'TB' })

    // All nodes should have positions
    expect(result).toHaveLength(3)
    result.forEach(node => {
      expect(typeof node.position.x).toBe('number')
      expect(typeof node.position.y).toBe('number')
    })

    // Isolated node should be at the top level (same as connected1)
    const connected1 = findNodeById(result, 'connected1')
    const isolated = findNodeById(result, 'isolated')
    expect(isolated.position.y).toBe(connected1.position.y)
  })
})
