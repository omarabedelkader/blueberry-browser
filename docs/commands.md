# Commands

## Local Command Parser

The chat input supports a lightweight local parser before the message is sent to the model.

Current commands are implemented in `src/main/LLMClient.ts`.

## Available Commands

### `/help`

Shows the currently available local commands.

Example:

```text
/help
```

### `@...`

Saves a direct memory entry without sending that content to the model first.

Examples:

```text
@I prefer neutral UI with no bright colors
@Remember that I want DuckDuckGo by default
@My preferred model is gemma4:e2b
```

Behavior:

- if memory is enabled, the content is saved as a memory entry
- if memory is disabled, the app explains that it was not saved

## Planned Extensions

These are good candidates for future commands:

- `/memory`
- `/forget`
- `/clear-memory`
- `/settings`
- `/agent`
- `/search`

## Enter Behavior

The sidebar composer currently behaves like this:

- `Enter` sends the message
- `Shift+Enter` inserts a newline

## Command Parsing Order

Current routing order is:

1. local commands
2. direct search handling
3. browser automation / autonomous agent routing
4. standard conversational chat
