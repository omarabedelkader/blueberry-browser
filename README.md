# Blueberry Browser

> **⚠️ Disclaimer:** I'm not proud of this codebase! It was built in 3 hours. If you have some time left over in the challenge, feel free to refactor and clean things up!

https://github.com/user-attachments/assets/bbf939e2-d87c-4c77-ab7d-828259f6d28d

---

## Overview

You are the **CTO of Blueberry Browser**, a Strawberry competitor. Your mission is to add a feature to Blueberry that makes it superior & more promising than Strawberry.

But your time is limited—Strawberry is about to raise a two billion dollar Series A round from X-Separator, B17Å and Sequoiadendron giganteum Capital.

## 🎯 Task

Your job is to **clone this repo** and add a unique feature. Some ideas are listed below.

It doesn't need to work 100% reliably, or even be completely done. It just has to:

- Show that you are creative and can iterate on novel ideas fast
- Demonstrate good system thinking and code practices  
- Prove you are a capable full stack and/or LLM dev

Once you're done, we'll book a call where you'll get to present your work!

If it's cracked, we might just have to acquire Blueberry Browser to stay alive 👀👀👀

### ⏰ Time

**1-2 weeks** is ideal for this challenge. This allows you to work over weekends and during evenings in your own time.

### 📋 Rules

You are allowed to vibe code, but make sure you understand everything so we can ask technical questions.

## 💡 Feature Ideas

### **Browsing History Compiler**
Track the things that the user is doing inside the browser and figure out from a series of browser states what the user is doing, and perhaps how valuable, repetitive tasks can be re-run by an AI agent.

*Tab state series → Prompt for web agent how to reproduce the work*

### **Coding Agent**
Sidebar coding agent that can create a script that can run on the open tabs.

Maybe useful for filling forms or changing the page's style so it can extract data but present it in a nicer format.

### **Tab Completion Model**
Predict next action or what to type, like Cursor's tab completion model.

### **Your Own Idea**
Feel free to implement your own idea!

> Wanted to try transformers.js for a while? This is your chance! 

> Have an old cool web agent framework you built? Let's see if you can merge it into the browser!

> Think you can add a completely new innovation to the browser concept with some insane, over-engineered React? Lfg!

Make sure you can realistically showcase a simple version of it in the timeframe. You can double check with us first if uncertain! :)

## 💬 Tips

Feel free to write to us with questions or send updates during the process—it's a good way to get a feel for working together.

It can also be a good way for us to give feedback if things are heading in the right or wrong direction.

---

## 🚀 Project Setup

### Install
```bash
$ pnpm install
```

### Development
```bash
$ pnpm dev
```

**Add an OpenAI API key to `.env`** in the root folder.

Strawberry will reimburse LLM costs, so go crazy! *(Please not more than a few hundred dollars though!)*

---

## What I Implemented

Blueberry now includes two new product surfaces inside the sidebar.

### 1. Gemini Computer Use Workspace

I turned the sidebar into a real-time operator console for browser automation:

- A dedicated `Gemini Computer Use` mode with a task prompt, live status, and page preview
- Multi-step planning for browser actions such as `navigate`, `click`, `type`, `extract_text`, `wait`, and `run_script`
- Step-by-step execution timeline that shows what the agent planned, what is currently running, and the result of each step
- Live operator feed with textual logs as the run progresses
- Screenshot snapshots from the active tab after execution steps
- A `Generate Script` action that drafts browser-side JavaScript for the current site and displays it directly in the UI

Implementation notes:

- Main-process orchestration lives in `src/main/ComputerUseManager.ts`
- The renderer subscribes to live session updates over IPC and renders the timeline in the sidebar workspace
- If no LLM key is configured, the system falls back to a lightweight context-gathering plan instead of failing completely

### 2. Code Execution Sandbox

I added a local, scoped code runner inspired by Code Interpreter:

- A dedicated `Code Sandbox` mode in the sidebar
- Multiple editable sandbox files, each of which can be included or excluded from the next run
- A selectable entry file for execution
- Isolated execution in a temporary local workspace
- Streamed stdout/stderr/system output back into the sidebar in real time
- Runtime notifications rendered in the UI when sandbox code calls helper APIs

The sandbox also creates a small local `blueberry` package at runtime with helpers including:

- `notifyUser(message)`
- `useMcp(name, input)` (currently a stubbed bridge that reports MCP is not wired yet)
- `currentPage()`
- `listScopedFiles()`
- `readScopedFile(name)`
- `writeScopedFile(name, content)`

Implementation notes:

- Main-process execution and workspace materialization live in `src/main/SandboxManager.ts`
- The sandbox is intentionally scoped to only the files selected in the sidebar
- The runtime also injects current-page context so scripts can inspect the active tab while running locally

### Sidebar UX Changes

To support both features, the sidebar UI was redesigned into an `Agent Workspace`:

- Top-level switcher between `Gemini Computer Use` and `Code Sandbox`
- A dedicated settings button in the top browser bar
- Built-in browser settings for switching provider, model, and browser behavior at runtime
- A unified task router that can automatically switch into the sandbox for code, file, and data tasks
- Active-tab header showing the current page title and URL
- Adjustable AI panel width via drag-resize on the left edge of the sidebar
- More explicit stateful UI for runs, outputs, notifications, and generated automation code

### Local Model Support

The AI panel now supports local models through Ollama and defaults to that flow:

- Default provider: `ollama`
- Default model: empty until the user provides their installed Ollama model
- Default endpoint: `http://127.0.0.1:11434/v1`

Users can change:

- Provider: `ollama`, `openai`, or `anthropic`
- Model name
- Ollama base URL
- Homepage / default new-tab URL
- Search engine
- Automatic sandbox routing behavior
- AI panel width

These settings are managed from the sidebar UI and persisted locally in the app's user data folder, so they are not tied to a hard-coded `.env` model selection anymore.

For Ollama specifically, the intended flow is:

1. Run `ollama list` on the user's computer
2. Open the AI panel settings button in Blueberry
3. Paste one of the installed model names into the model field

Key renderer entrypoints:

- `src/renderer/sidebar/src/components/Chat.tsx`
- `src/preload/sidebar.ts`
- `src/main/EventManager.ts`

## Verification

I attempted to run TypeScript verification, but the workspace currently does not have dependencies installed, so `tsc` is unavailable until `npm install` completes successfully.
