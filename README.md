# Bead Feeder

A visual dependency graph interface for the [Beads](https://github.com/steveyegge/beads) issue tracking system.

> Keep your agent busy!

## What is Bead Feeder?

Bead Feeder transforms flat issue lists into interactive directed acyclic graphs (DAGs), letting you visualize and manage dependencies between tasks. It's designed for AI-agent collaboration, enabling natural language control over project work through an embedded chat interface.

### Features

- **Dependency Graph Visualization** - Interactive DAG canvas with pan, zoom, and drag-to-connect dependency creation
- **AI-Assisted Issue Management** - Create and modify issues through natural language chat (OpenAI GPT-4o)
- **GitHub Integration** - OAuth login to visualize issues from any GitHub repository with a `.beads` directory
- **Real-time Sync** - Auto-commits changes to Git with conflict detection and resolution

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, React Flow, Tailwind CSS, Radix UI

**Backend:** Bun, OpenAI SDK

**Testing:** Vitest, Playwright

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Beads CLI](https://github.com/steveyegge/beads) (`bd` command)
- OpenAI API key (for chat features)
- GitHub OAuth app credentials (for GitHub integration)

### Installation

```bash
bun install
```

### Configuration

Create a `.env` file:

```bash
# Required for AI chat
OPENAI_API_KEY=sk-...

# Required for GitHub integration
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### Running

```bash
bun run dev
```

This starts both the Vite dev server (port 5173) and API server (port 3001).

### Testing

```bash
./check        # Run all quality gates (lint + unit tests + e2e)
bun test       # Unit tests only
```

## Project Structure

```
bead-feeder/
├── src/               # React frontend
│   ├── components/    # UI components (DagCanvas, IssueNode, etc.)
│   ├── pages/         # Route pages (Home, DagView)
│   └── transformers/  # DAG layout and data transformation
├── api/               # Bun backend
│   ├── server.ts      # HTTP endpoints
│   ├── llm-tools.ts   # OpenAI tool definitions
│   └── git-service.ts # Git/Beads CLI integration
└── e2e/               # Playwright tests
```

## License

MIT

