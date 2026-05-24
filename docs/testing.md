# Testing Guide

## Start The App

Run:

```bash
npm run dev
```

## Basic Manual Test Checklist

### Welcome Page

1. Open a new tab.
2. Confirm the BlueBerry welcome page appears instead of Google.
3. Confirm the address bar shows `BlueBerry Browser`.

### Search Engine

1. Open Settings.
2. Change the search engine.
3. In the address bar, type a search query.
4. Confirm the correct engine is used.

### Theme

1. Change the theme from Settings.
2. Confirm the top bar, address bar, and settings surfaces update consistently.

### Chat Input

1. Type a prompt in the sidebar.
2. Press `Enter` to send.
3. Press `Shift+Enter` to insert a newline.

### Busy Lock

1. Send a long-running agent task.
2. Confirm the composer locks while the agent is working.
3. Confirm the floating busy badge appears.

### Agent Thinking

1. Ask for a browsing task.
2. Confirm the sidebar shows:
   - thinking output
   - current step
   - live progress

### Direct Search

Try:

```text
search for white sneakers
```

Expected:

1. opens the search engine
2. scans results
3. opens a likely website result

### General Agent Task

Try:

```text
compare two sites selling white sneakers
```

Expected:

- should route into browser agent mode
- should not answer only from the welcome page screenshot

### Memory

1. Open the `Memory` tab in Settings.
2. Confirm you can enable/disable memory.
3. In chat, send:

```text
@I prefer minimal UI
```

4. Confirm the memory entry appears in Settings.
5. Delete it and confirm it disappears.

### Logs

1. Trigger an error intentionally.
2. Inspect the log file in the Electron user data logs folder.
3. Confirm operational and error events are stored.

## Type Checking

Run:

```bash
npm run typecheck
```

This is the main local verification step currently used during development.
