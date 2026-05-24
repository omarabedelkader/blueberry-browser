# BlueBerry Browser Docs

This folder documents the current behavior of the browser, agent, settings, memory system, and release flow.

## Docs Map

- [Agent Guide](./agent.md)
- [Settings And Memory](./settings-and-memory.md)
- [Commands](./commands.md)
- [Testing Guide](./testing.md)
- [Build And Release](./build-and-release.md)

## What This Project Is

BlueBerry Browser is an Electron browser shell with:

- a multi-tab browser UI
- a sidebar AI assistant
- autonomous browser automation
- a local code sandbox
- persistent settings
- optional persistent memory

## Current Default Behavior

- default homepage/new tab: internal BlueBerry welcome page
- default provider: `ollama`
- default Ollama model: `gemma4:e2b`
- default search engine: `duckduckgo`

## Important Safety Boundaries

- payment entry is intentionally blocked
- checkout progression can continue toward cart/checkout, but final payment submission should hand off to the user
- logs are stored separately from memory
- chat transcripts are not stored in the bug log file
