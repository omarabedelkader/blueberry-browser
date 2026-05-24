# Settings And Memory

## Settings Overview

The Settings window is a dedicated native window with tabbed sections.

Current settings sections:

- `General`
- `AI`
- `Workspace`
- `Memory`

Settings are persisted through `src/main/AISettings.ts`.

## General

General settings include:

- theme
- homepage / new tab URL
- search engine

Current default homepage is the internal BlueBerry welcome page.

## AI

AI settings include:

- provider
- model
- Ollama base URL

Current defaults:

- provider: `ollama`
- model: `gemma4:e2b`

The user can change the model at runtime and the app should use the new selection immediately.

## Workspace

Workspace settings include:

- sidebar width
- automatic sandbox routing

## Memory

Memory is a persistent feature that stores distilled user preferences and instructions.

It is not the same thing as:

- bug logs
- full chat logs
- raw message history

### Memory Controls

The user can:

- enable memory
- disable memory
- review stored memory entries
- delete a single memory entry
- clear all stored memory

### Memory Storage

Memory is stored through `src/main/MemoryStore.ts`.

Each entry contains:

- `id`
- `content`
- `category`
- `createdAt`
- `updatedAt`

### Memory Categories

Current categories:

- `preference`
- `profile`
- `workflow`
- `instruction`

### How Memory Is Captured

Some memories are distilled automatically from user phrasing such as:

- `remember that ...`
- `my name is ...`
- `I want ...`
- `I do not want ...`
- `prefer ...`
- `always ...`

The user can also save memory explicitly through the local command parser.

## Logging vs Memory

These are separate systems.

### Memory

- used to improve future responses
- user-facing
- editable
- persistent

### Logs

- used for debugging and runtime issues
- stored in a log file
- should not contain the user’s raw discussions as memory

## Theme Control

Theme changes should happen through Settings, not through a browser toolbar theme toggle.
