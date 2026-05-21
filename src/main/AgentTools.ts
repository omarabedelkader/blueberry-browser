import { tool } from "ai";
import { z } from "zod";
import type { Tab } from "./Tab";
import type { WebContents } from "electron";
import type { AISettingsStore } from "./AISettings";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Payment-related field patterns that should never be filled by the agent
const PAYMENT_FIELD_PATTERNS = /card|cvv|cvc|expiry|security[-_]?code|cc[-_]/i;

export function buildShoppingTools(
  getActiveTab: () => Tab | null,
  webContents: WebContents,
  settingsStore: AISettingsStore
): any {
  const defineTool = (config: Record<string, unknown>) => tool(config as any) as any;

  const activeTab = () => {
    const tab = getActiveTab();
    if (!tab) {
      throw new Error("No active tab available");
    }
    return tab;
  };

  const navigate = defineTool({
    description: "Open a URL in the active tab.",
    inputSchema: z.object({ url: z.string().url() }),
    execute: async ({ url }: { url: string }) => {
      await activeTab().loadURL(url);
      await wait(1500);
      return { url: activeTab().url, title: activeTab().title };
    },
  });

  const webSearch = defineTool({
    description:
      "Search the web via the configured search engine and return top results.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }: { query: string }) => {
      const engine = settingsStore.getSettings().searchEngine;
      const url =
        engine === "duckduckgo"
          ? `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
          : engine === "bing"
            ? `https://www.bing.com/search?q=${encodeURIComponent(query)}`
            : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await activeTab().loadURL(url);
      await wait(2000);
      const results = await extractSearchResults(activeTab());
      return { url: activeTab().url, results };
    },
  });

  const observePage = defineTool({
    description:
      "Return interactive elements (links, buttons, inputs) with stable IDs the agent can act on.",
    inputSchema: z.object({}),
    execute: async () => {
      const elements = await activeTab().runJs(`
        (() => {
          const nodes = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"]');
          return Array.from(nodes).slice(0, 200).map((el, i) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) return null;
            el.setAttribute('data-agent-id', String(i));
            return {
              id: i,
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || null,
              text: (el.innerText || el.value || el.placeholder || el.ariaLabel || '').trim().slice(0, 120),
              type: el.type || null,
              href: el.href || null,
            };
          }).filter(Boolean);
        })()
      `);
      return { url: activeTab().url, title: activeTab().title, elements };
    },
  });

  const readPage = defineTool({
    description: "Return the visible text of the current page (truncated).",
    inputSchema: z.object({}),
    execute: async () => ({
      url: activeTab().url,
      text: (await activeTab().getTabText()).slice(0, 6000),
    }),
  });

  const screenshot = defineTool({
    description:
      "Capture the active tab as an image (only if a vision model is in use).",
    inputSchema: z.object({}),
    execute: async () => (await activeTab().screenshot()).toDataURL(),
  });

  const clickElement = defineTool({
    description:
      "Click the element with the given agent ID returned by observePage.",
    inputSchema: z.object({ id: z.number() }),
    execute: async ({ id }: { id: number }) => {
      await activeTab().runJs(
        `document.querySelector('[data-agent-id="${id}"]')?.click()`
      );
      await wait(800);
      return { ok: true, url: activeTab().url };
    },
  });

  const typeIntoElement = defineTool({
    description:
      "Type text into an input element by agent ID. Optionally press Enter after.",
    inputSchema: z.object({
      id: z.number(),
      text: z.string(),
      submit: z.boolean().optional(),
    }),
    execute: async ({ id, text, submit }: { id: number; text: string; submit?: boolean }) => {
      // Safety check: prevent filling payment fields
      const elementInfo = await activeTab().runJs(`
        (() => {
          const el = document.querySelector('[data-agent-id="${id}"]');
          if (!el) return null;
          return {
            name: el.name || '',
            id: el.id || '',
            autocomplete: el.autocomplete || '',
            type: el.type || '',
          };
        })()
      `);

      if (elementInfo) {
        const fieldIdentifier = `${elementInfo.name} ${elementInfo.id} ${elementInfo.autocomplete}`;
        if (
          PAYMENT_FIELD_PATTERNS.test(fieldIdentifier) ||
          elementInfo.autocomplete?.startsWith("cc-")
        ) {
          throw new Error(
            "Refusing to fill payment field. Use handOffToUser instead."
          );
        }
      }

      await activeTab().runJs(`
        (() => {
          const el = document.querySelector('[data-agent-id="${id}"]');
          if (!el) throw new Error('no element');
          el.focus();
          el.value = ${JSON.stringify(text)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          ${submit ? `el.form?.requestSubmit?.() ?? el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));` : ""}
        })()
      `);
      await wait(1200);
      return { ok: true, url: activeTab().url };
    },
  });

  const waitFor = defineTool({
    description: "Wait for a CSS selector to appear (max 10s).",
    inputSchema: z.object({
      selector: z.string(),
      timeoutMs: z.number().optional(),
    }),
    execute: async ({ selector, timeoutMs = 10000 }: { selector: string; timeoutMs?: number }) =>
      activeTab().runJs(`
        new Promise((resolve, reject) => {
          const start = Date.now();
          const tick = () => {
            if (document.querySelector(${JSON.stringify(selector)})) return resolve(true);
            if (Date.now() - start > ${timeoutMs}) return reject(new Error('timeout'));
            setTimeout(tick, 250);
          };
          tick();
        })
      `),
  });

  const scroll = defineTool({
    description:
      "Scroll the page by a given number of viewport heights (positive = down).",
    inputSchema: z.object({ amount: z.number() }),
    execute: async ({ amount }: { amount: number }) => {
      await activeTab().runJs(
        `window.scrollBy(0, window.innerHeight * ${amount})`
      );
      await wait(400);
      return { ok: true };
    },
  });

  const handOffToUser = defineTool({
    description:
      "Stop automation and prompt the user to take over (e.g., to enter payment info). Use this at checkout, login walls, captchas, or 2FA.",
    inputSchema: z.object({
      reason: z.string(),
      pageSummary: z.string(),
    }),
    execute: async ({ reason, pageSummary }: { reason: string; pageSummary: string }) => {
      webContents.send("agent-handoff", {
        reason,
        pageSummary,
        url: activeTab().url,
        at: Date.now(),
      });
      return { handedOff: true };
    },
  });

  return {
    navigate,
    webSearch,
    observePage,
    readPage,
    screenshot,
    clickElement,
    typeIntoElement,
    waitFor,
    scroll,
    handOffToUser,
  };
}

async function extractSearchResults(tab: Tab): Promise<
  Array<{ title: string; url: string }>
> {
  try {
    return await tab.runJs(`
      Array.from(document.querySelectorAll('a h3')).slice(0, 10).map(h => ({
        title: h.innerText,
        url: h.closest('a')?.href,
      })).filter(r => r.url)
    `);
  } catch {
    return [];
  }
}

export const SHOPPING_AGENT_PROMPT = `You are Blueberry, a local browser agent. Your job is to complete shopping tasks end-to-end EXCEPT payment.

Workflow:
1. If you do not already know the right site, use webSearch.
2. Use observePage before any click or type to get fresh element IDs.
3. Use the site's own search box to find the product; verify the item matches the user's request (size, color, model).
4. Add the item to the cart.
5. Go to the cart/checkout page.
6. Call handOffToUser with a clear summary of the cart contents and total.

NEVER attempt to enter payment, card numbers, addresses, or click "Place order".

Rules:
- One tool call per turn. After each tool result, decide the next step.
- Element IDs from observePage become stale after navigation; re-observe.
- If you hit a login wall, captcha, or 2FA, handOffToUser immediately.
- Confirm price and item before adding to cart.
- Be patient: wait for pages to load, scroll if needed to find elements.
- If a step fails, try an alternative approach before giving up.`;
