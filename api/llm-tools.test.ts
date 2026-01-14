import { describe, expect, it } from 'vitest'
import {
  addDependencyTool,
  closeIssueTool,
  createIssueTool,
  llmTools,
  removeDependencyTool,
  updateIssueTool,
} from './llm-tools'

describe('LLM Tools', () => {
  describe('createIssueTool', () => {
    it('has the correct name', () => {
      expect(createIssueTool.name).toBe('create_issue')
    })

    it('has a description', () => {
      expect(createIssueTool.description).toBeTruthy()
      expect(createIssueTool.description).toContain('Create')
    })

    it('requires title', () => {
      expect(createIssueTool.input_schema.required).toContain('title')
    })

    it('defines title, description, type, and priority properties', () => {
      const props = createIssueTool.input_schema.properties as Record<
        string,
        unknown
      >
      expect(props.title).toBeDefined()
      expect(props.description).toBeDefined()
      expect(props.type).toBeDefined()
      expect(props.priority).toBeDefined()
    })

    it('restricts type to task, bug, or feature', () => {
      const props = createIssueTool.input_schema.properties as Record<
        string,
        { enum?: string[] }
      >
      expect(props.type.enum).toEqual(['task', 'bug', 'feature'])
    })

    it('restricts priority to 0, 1, 2, or 3', () => {
      const props = createIssueTool.input_schema.properties as Record<
        string,
        { enum?: number[] }
      >
      expect(props.priority.enum).toEqual([0, 1, 2, 3])
    })
  })

  describe('addDependencyTool', () => {
    it('has the correct name', () => {
      expect(addDependencyTool.name).toBe('add_dependency')
    })

    it('has a description mentioning dependency', () => {
      expect(addDependencyTool.description).toContain('dependency')
    })

    it('requires blocked_issue_id and blocker_issue_id', () => {
      expect(addDependencyTool.input_schema.required).toContain(
        'blocked_issue_id'
      )
      expect(addDependencyTool.input_schema.required).toContain(
        'blocker_issue_id'
      )
    })

    it('defines blocked_issue_id and blocker_issue_id properties', () => {
      const props = addDependencyTool.input_schema.properties as Record<
        string,
        unknown
      >
      expect(props.blocked_issue_id).toBeDefined()
      expect(props.blocker_issue_id).toBeDefined()
    })
  })

  describe('removeDependencyTool', () => {
    it('has the correct name', () => {
      expect(removeDependencyTool.name).toBe('remove_dependency')
    })

    it('has a description mentioning remove dependency', () => {
      expect(removeDependencyTool.description).toContain('Remove')
      expect(removeDependencyTool.description).toContain('dependency')
    })

    it('requires blocked_issue_id and blocker_issue_id', () => {
      expect(removeDependencyTool.input_schema.required).toContain(
        'blocked_issue_id'
      )
      expect(removeDependencyTool.input_schema.required).toContain(
        'blocker_issue_id'
      )
    })
  })

  describe('updateIssueTool', () => {
    it('has the correct name', () => {
      expect(updateIssueTool.name).toBe('update_issue')
    })

    it('has a description mentioning update', () => {
      expect(updateIssueTool.description).toContain('Update')
    })

    it('requires issue_id', () => {
      expect(updateIssueTool.input_schema.required).toContain('issue_id')
    })

    it('defines issue_id and optional update fields', () => {
      const props = updateIssueTool.input_schema.properties as Record<
        string,
        unknown
      >
      expect(props.issue_id).toBeDefined()
      expect(props.title).toBeDefined()
      expect(props.description).toBeDefined()
      expect(props.type).toBeDefined()
      expect(props.priority).toBeDefined()
      expect(props.status).toBeDefined()
      expect(props.assignee).toBeDefined()
    })

    it('restricts status to open or in_progress', () => {
      const props = updateIssueTool.input_schema.properties as Record<
        string,
        { enum?: string[] }
      >
      expect(props.status.enum).toEqual(['open', 'in_progress'])
    })
  })

  describe('closeIssueTool', () => {
    it('has the correct name', () => {
      expect(closeIssueTool.name).toBe('close_issue')
    })

    it('has a description mentioning close', () => {
      expect(closeIssueTool.description).toContain('Close')
    })

    it('requires issue_id', () => {
      expect(closeIssueTool.input_schema.required).toContain('issue_id')
    })

    it('defines issue_id and optional reason', () => {
      const props = closeIssueTool.input_schema.properties as Record<
        string,
        unknown
      >
      expect(props.issue_id).toBeDefined()
      expect(props.reason).toBeDefined()
    })
  })

  describe('llmTools array', () => {
    it('exports all 5 tools', () => {
      expect(llmTools).toHaveLength(5)
    })

    it('contains all tool definitions', () => {
      const names = llmTools.map(t => t.name)
      expect(names).toContain('create_issue')
      expect(names).toContain('add_dependency')
      expect(names).toContain('remove_dependency')
      expect(names).toContain('update_issue')
      expect(names).toContain('close_issue')
    })

    it('all tools have valid input_schema type', () => {
      for (const tool of llmTools) {
        expect(tool.input_schema.type).toBe('object')
      }
    })

    it('all tools have required array', () => {
      for (const tool of llmTools) {
        expect(Array.isArray(tool.input_schema.required)).toBe(true)
      }
    })
  })
})
