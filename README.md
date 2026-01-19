<img src="src/app/public/icon-128.png" alt="Bead Feeder" width="128" height="128">

# Bead Feeder

> Keep your agent busy!

Bead Feeder is a visual interface for feeding work to a continuously running AI agent. It connects to the [Beads](https://github.com/steveyegge/beads) issue tracking system and displays your tasks as an interactive dependency graph. As the project manager, you add and prioritize issues through the UI while your agent works through them one by one.

## Getting Started

1. Create `.env` based on `.env.example`:
   ```bash
   cp .env.example .env
   # Edit .env and fill in your credentials
   ```

2. Install dependencies and run:
   ```bash
   bun install
   bun run dev
   ```
