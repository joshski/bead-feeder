import type { Tool } from '@anthropic-ai/sdk/resources/messages'

/**
 * LLM tool definitions for graph manipulation.
 * Each tool maps to the corresponding bd CLI command.
 */

export const createIssueTool: Tool = {
  name: 'create_issue',
  description:
    'Create a new issue in the dependency graph. Use this when the user wants to add a new task, bug, or feature to track.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'The title of the issue (required)',
      },
      description: {
        type: 'string',
        description: 'A detailed description of the issue',
      },
      type: {
        type: 'string',
        enum: ['task', 'bug', 'feature'],
        description:
          'The type of issue: task (default), bug (for defects), or feature (for new functionality)',
      },
      priority: {
        type: 'number',
        enum: [0, 1, 2, 3],
        description:
          'Priority level: 0 (P0, highest/critical), 1 (P1, high), 2 (P2, medium/default), 3 (P3, low)',
      },
    },
    required: ['title'],
  },
}

export const addDependencyTool: Tool = {
  name: 'add_dependency',
  description:
    'Add a dependency relationship between two issues. The blocker issue must be completed before the blocked issue can start. Use this to express that one issue depends on another.',
  input_schema: {
    type: 'object' as const,
    properties: {
      blocked_issue_id: {
        type: 'string',
        description:
          'The ID of the issue that is blocked (depends on the other)',
      },
      blocker_issue_id: {
        type: 'string',
        description:
          'The ID of the issue that blocks (must be completed first)',
      },
    },
    required: ['blocked_issue_id', 'blocker_issue_id'],
  },
}

export const removeDependencyTool: Tool = {
  name: 'remove_dependency',
  description:
    'Remove a dependency relationship between two issues. Use this when an issue no longer depends on another.',
  input_schema: {
    type: 'object' as const,
    properties: {
      blocked_issue_id: {
        type: 'string',
        description:
          'The ID of the issue that was blocked (the one that had the dependency)',
      },
      blocker_issue_id: {
        type: 'string',
        description: 'The ID of the issue that was blocking',
      },
    },
    required: ['blocked_issue_id', 'blocker_issue_id'],
  },
}

export const updateIssueTool: Tool = {
  name: 'update_issue',
  description:
    'Update an existing issue. Use this to change the title, description, type, priority, status, or assignee of an issue.',
  input_schema: {
    type: 'object' as const,
    properties: {
      issue_id: {
        type: 'string',
        description: 'The ID of the issue to update (required)',
      },
      title: {
        type: 'string',
        description: 'New title for the issue',
      },
      description: {
        type: 'string',
        description: 'New description for the issue',
      },
      type: {
        type: 'string',
        enum: ['task', 'bug', 'feature'],
        description: 'New type for the issue',
      },
      priority: {
        type: 'number',
        enum: [0, 1, 2, 3],
        description:
          'New priority level: 0 (P0, highest), 1 (P1, high), 2 (P2, medium), 3 (P3, low)',
      },
      status: {
        type: 'string',
        enum: ['open', 'in_progress'],
        description: 'New status for the issue (use close_issue to close)',
      },
      assignee: {
        type: 'string',
        description: 'Person assigned to work on this issue',
      },
    },
    required: ['issue_id'],
  },
}

export const closeIssueTool: Tool = {
  name: 'close_issue',
  description:
    'Close an issue, marking it as completed. Use this when work on an issue is finished.',
  input_schema: {
    type: 'object' as const,
    properties: {
      issue_id: {
        type: 'string',
        description: 'The ID of the issue to close (required)',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for closing the issue',
      },
    },
    required: ['issue_id'],
  },
}

/**
 * All available LLM tools for graph manipulation
 */
export const llmTools: Tool[] = [
  createIssueTool,
  addDependencyTool,
  removeDependencyTool,
  updateIssueTool,
  closeIssueTool,
]
