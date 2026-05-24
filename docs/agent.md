# Agent Guide

## Overview

The sidebar assistant can operate in two broad modes:

- standard chat mode
- browser agent / automation mode

The routing happens in the main process inside `src/main/LLMClient.ts`.

## Standard Chat Mode

Standard chat is used when the request is mainly explanatory or conversational and does not require browser actions.

Examples:

- `summarize this page`
- `what is this site about?`
- `explain what I am looking at`

In this mode the assistant gets:

- the active page URL
- extracted page text
- a screenshot when available
- remembered user context when memory is enabled

## Browser Agent Mode

Browser agent mode is used for multi-step browsing tasks, including:

- searching the web
- browsing across sites
- comparing products or information
- finding pages
- filling non-sensitive fields
- progressing through multi-step website flows
- shopping tasks up to cart / checkout handoff

Examples:

- `search for white sneakers`
- `compare two sites selling white sneakers`
- `find the shipping policy on this site`
- `research three sites and tell me the cheapest one`

## Direct Search Behavior

Simple search prompts can be handled through a fast path before full automation.

Examples:

- `search white sneakers`
- `look up running shoes`
- `find black boots`

Current behavior:

1. open the configured search engine
2. scan the results page
3. open a likely website result
4. fall back to leaving the results page open if scanning is not confident enough

## Autonomous Agent Tools

The higher-level toolset is defined in `src/main/AgentTools.ts`.

### Core Tools

- `navigate`
- `webSearch`
- `observePage`
- `readPage`
- `screenshot`
- `clickElement`
- `typeIntoElement`
- `waitFor`
- `scroll`

### Higher-Level Browser Tools

- `scanCommercePage`
  Returns structured page information such as likely search boxes, products, cart actions, totals, and blockers.

- `searchCurrentSite`
  Uses the current website’s search box when one is found.

- `openSearchResult`
  Opens one of the current search results by index.

- `openProductCandidate`
  Finds likely product links and opens the best candidate.

- `clickBestMatch`
  Clicks the best visible match for intents such as `search`, `product`, `add_to_cart`, `view_cart`, `checkout`, and `continue`.

- `advanceCheckout`
  Moves toward cart or checkout using likely visible actions.

- `extractCartSummary`
  Extracts item and total information before handoff.

- `detectBlockers`
  Detects login walls, captcha prompts, verification, payment fields, and other blockers.

- `handOffToUser`
  Stops the agent and hands control to the user when a sensitive step is reached.

## Thinking And Live Status

While the agent is working, the sidebar UI shows:

- a live thinking panel
- a floating busy badge
- current step text
- recent automation logs

This is rendered in `src/renderer/sidebar/src/components/Chat.tsx`.

## Memory In Agent Responses

When memory is enabled, the agent receives remembered user context in its system prompt.

This memory is:

- distilled
- user-controllable
- persistent across sessions

It is not a raw chat transcript replay.

## Safety Rules

The current implementation intentionally avoids:

- entering card details
- entering sensitive payment fields
- placing the final order

At checkout, the correct behavior is to prepare context and then hand off.

## Limits

This is still a browser agent running on heuristics plus a model, so it can fail on:

- site-specific DOM changes
- anti-bot walls
- login walls
- unexpected navigation
- poor search result structure

The right next upgrades would be:

- site-specific adapters
- better screenshot + DOM combined reasoning
- stronger retry policies
- persistent per-task browser memory
