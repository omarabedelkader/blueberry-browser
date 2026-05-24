import { tool } from "ai";
import { z } from "zod";
import type { Tab } from "./Tab";
import type { WebContents } from "electron";
import type { AISettingsStore } from "./AISettings";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Payment-related field patterns that should never be filled by the agent
const PAYMENT_FIELD_PATTERNS = /card|cvv|cvc|expiry|security[-_]?code|cc[-_]/i;
const CHECKOUT_BLOCKER_PATTERNS =
  /captcha|robot|verify|verification|2fa|two-factor|sign in|log in|login|password/i;

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

  const scanCommercePage = defineTool({
    description:
      "Return a structured scan of the current page with likely search inputs, products, cart actions, checkout actions, totals, and blockers.",
    inputSchema: z.object({}),
    execute: async () => {
      const summary = await activeTab().runJs(`
        (() => {
          const text = (value) => (value || '').replace(/\\s+/g, ' ').trim();
          const isVisible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 8 && rect.height > 8 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const matches = (value, pattern) => pattern.test(text(value).toLowerCase());
          const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]'))
            .filter((el) => isVisible(el))
            .map((el) => ({
              text: text(el.innerText || el.value || el.getAttribute('aria-label') || ''),
              href: el.href || null,
              tag: el.tagName.toLowerCase(),
            }));
          const inputs = Array.from(document.querySelectorAll('input, textarea'))
            .filter((el) => isVisible(el))
            .map((el) => ({
              type: el.type || '',
              name: el.name || '',
              id: el.id || '',
              placeholder: text(el.placeholder || ''),
              autocomplete: el.autocomplete || '',
            }));
          const productCandidates = Array.from(document.querySelectorAll('a[href], article, [data-testid], [class]'))
            .filter((el) => isVisible(el))
            .map((el) => {
              const titleEl = el.querySelector?.('h1, h2, h3, [data-testid*="title"], [class*="title"], [class*="name"]');
              const priceEl = el.querySelector?.('[class*="price"], [data-testid*="price"], [aria-label*="price"], [data-price]');
              const title = text(titleEl?.textContent || el.textContent).slice(0, 140);
              const price = text(priceEl?.textContent || '').slice(0, 60);
              const href = el instanceof HTMLAnchorElement ? el.href : el.querySelector?.('a[href]')?.href || null;
              return { title, price, href };
            })
            .filter((entry) => entry.title.length > 12)
            .filter((entry) => /(shoe|sneaker|product|size|price|buy|cart|men|women|kids|black|white|running|sale)/i.test(entry.title + ' ' + entry.price))
            .slice(0, 12);
          const pageText = text(document.body.innerText).slice(0, 4000);
          const blockerText = pageText.match(/.{0,40}(captcha|robot|verify|verification|2fa|two-factor|sign in|log in|login|password).{0,60}/gi) || [];
          const totals = pageText.match(/(subtotal|total|order total)[^\\n]{0,80}/gi) || [];

          return {
            url: window.location.href,
            title: document.title,
            searchInputs: inputs.filter((entry) =>
              /(search|query|q)/i.test([entry.name, entry.id, entry.placeholder, entry.autocomplete].join(' '))
            ).slice(0, 6),
            primaryActions: buttons
              .filter((entry) => entry.text.length > 0)
              .filter((entry) => /(add to cart|buy now|checkout|view cart|cart|continue|next|proceed|search)/i.test(entry.text))
              .slice(0, 12),
            productCandidates,
            blockers: blockerText.slice(0, 6),
            totals: totals.slice(0, 6),
          };
        })()
      `);
      return summary;
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

  const clickBestMatch = defineTool({
    description:
      "Find the best visible interactive element whose text matches the requested intent and click it.",
    inputSchema: z.object({
      intent: z.enum([
        "search",
        "product",
        "add_to_cart",
        "view_cart",
        "checkout",
        "continue",
      ]),
      query: z.string().optional(),
    }),
    execute: async ({
      intent,
      query,
    }: {
      intent:
        | "search"
        | "product"
        | "add_to_cart"
        | "view_cart"
        | "checkout"
        | "continue";
      query?: string;
    }) => {
      const result = await activeTab().runJs(`
        (() => {
          const intent = ${JSON.stringify(intent)};
          const query = (${JSON.stringify(query ?? "")} || "").toLowerCase();
          const patterns = {
            search: /search|find/i,
            product: /(shoe|sneaker|product|item|shop|buy|size|${(query ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})/i,
            add_to_cart: /add to cart|add to bag|add to basket/i,
            view_cart: /view cart|cart|bag|basket/i,
            checkout: /checkout|check out|proceed to checkout|continue to checkout/i,
            continue: /continue|next|proceed/i,
          };
          const nodes = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'));
          const scored = nodes.map((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 8 || rect.height < 8) return null;
            const rawText = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
            if (!rawText) return null;
            const text = rawText.toLowerCase();
            if (!patterns[intent].test(rawText)) return null;
            let score = 0;
            if (patterns[intent].test(rawText)) score += 6;
            if (query && text.includes(query)) score += 10;
            if (el.tagName === 'BUTTON') score += 2;
            if (intent === 'checkout' && /cart/.test(text)) score -= 3;
            return { el, text: rawText, score };
          }).filter(Boolean).sort((a, b) => b.score - a.score);
          const target = scored[0]?.el;
          if (!target) throw new Error('No matching interactive element found.');
          target.scrollIntoView({ block: 'center', behavior: 'instant' });
          target.click();
          return {
            text: scored[0].text,
            href: target.href || null,
          };
        })()
      `);
      await wait(1200);
      return { ok: true, clicked: result, url: activeTab().url };
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

  const searchCurrentSite = defineTool({
    description:
      "Find the current site's search input, type a query, and submit it.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }: { query: string }) => {
      const result = await activeTab().runJs(`
        (() => {
          const query = ${JSON.stringify(query)};
          const candidates = Array.from(document.querySelectorAll('input, textarea')).filter((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 40 || rect.height < 20) return false;
            const text = [el.name || '', el.id || '', el.placeholder || '', el.autocomplete || '', el.getAttribute('aria-label') || ''].join(' ').toLowerCase();
            return /(search|query|find|q)/.test(text);
          });
          const input = candidates[0];
          if (!input) throw new Error('No site search input found.');
          input.focus();
          input.value = query;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          const form = input.form;
          if (form?.requestSubmit) {
            form.requestSubmit();
          } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
          }
          return {
            placeholder: input.placeholder || null,
            name: input.name || null,
          };
        })()
      `);
      await wait(1800);
      return { ok: true, url: activeTab().url, input: result };
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

  const openSearchResult = defineTool({
    description:
      "Open one of the current search results by index from the active search-results page.",
    inputSchema: z.object({ index: z.number().int().min(0).max(9).default(0) }),
    execute: async ({ index }: { index: number }) => {
      const results = await extractSearchResults(activeTab());
      const target = results[index];
      if (!target?.url) {
        throw new Error("Requested search result index is unavailable.");
      }
      await activeTab().loadURL(target.url);
      await wait(1500);
      return { opened: target };
    },
  });

  const openProductCandidate = defineTool({
    description:
      "Scan the current page for likely product links and open the best match, optionally biased by a query.",
    inputSchema: z.object({
      query: z.string().optional(),
      index: z.number().int().min(0).max(9).optional(),
    }),
    execute: async ({
      query,
      index,
    }: {
      query?: string;
      index?: number;
    }) => {
      const result = await activeTab().runJs(`
        (() => {
          const query = (${JSON.stringify(query ?? "")} || "").toLowerCase();
          const items = Array.from(document.querySelectorAll('a[href]')).map((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 24 || rect.height < 16) return null;
            const title = (el.textContent || '').replace(/\\s+/g, ' ').trim();
            if (title.length < 6) return null;
            if (/sign in|log in|wishlist|privacy|terms|support|help|cart/.test(title.toLowerCase())) return null;
            let score = /(shoe|sneaker|product|buy|shop|size|price|men|women|kids|running|white|black)/i.test(title) ? 6 : 0;
            if (query && title.toLowerCase().includes(query)) score += 12;
            if (el.querySelector('img')) score += 2;
            return { href: el.href, title, score };
          }).filter(Boolean).sort((a, b) => b.score - a.score);
          const chosen = items[${index ?? 0}] || items[0];
          if (!chosen?.href) throw new Error('No likely product candidate found.');
          return chosen;
        })()
      `);
      await activeTab().loadURL(result.href);
      await wait(1500);
      return { opened: result, url: activeTab().url };
    },
  });

  const extractCartSummary = defineTool({
    description:
      "Extract a lightweight summary of cart items, subtotal/total text, and whether checkout blockers are visible.",
    inputSchema: z.object({}),
    execute: async () =>
      activeTab().runJs(`
        (() => {
          const text = (value) => (value || '').replace(/\\s+/g, ' ').trim();
          const bodyText = text(document.body.innerText);
          const itemNodes = Array.from(document.querySelectorAll('main li, main article, [data-testid*="cart"], [class*="cart-item"], [class*="line-item"]'));
          const items = itemNodes.map((el) => {
            const label = text(el.querySelector?.('h1, h2, h3, h4, [class*="title"], [class*="name"]')?.textContent || el.textContent).slice(0, 160);
            const price = text(el.querySelector?.('[class*="price"], [data-testid*="price"]')?.textContent || '').slice(0, 60);
            return { label, price };
          }).filter((item) => item.label.length > 4).slice(0, 8);
          const totals = bodyText.match(/(subtotal|total|order total)[^\\n]{0,100}/gi) || [];
          const blockers = bodyText.match(/.{0,40}(captcha|robot|verify|verification|2fa|two-factor|sign in|log in|login|password).{0,60}/gi) || [];
          return {
            url: window.location.href,
            title: document.title,
            items,
            totals: totals.slice(0, 6),
            blockers: blockers.slice(0, 6),
          };
        })()
      `),
  });

  const advanceCheckout = defineTool({
    description:
      "Advance toward cart or checkout by clicking the most likely visible cart/checkout action.",
    inputSchema: z.object({
      target: z.enum(["cart", "checkout"]).default("checkout"),
    }),
    execute: async ({ target }: { target: "cart" | "checkout" }) => {
      const result = await activeTab().runJs(`
        (() => {
          const target = ${JSON.stringify(target)};
          const patterns =
            target === 'cart'
              ? [/view cart/i, /cart|bag|basket/i]
              : [/checkout|check out|proceed to checkout|continue to checkout/i, /continue|next|proceed/i];
          const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]'));
          const candidates = nodes.map((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 8 || rect.height < 8) return null;
            const label = (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
            if (!label) return null;
            let score = 0;
            for (const [idx, pattern] of patterns.entries()) {
              if (pattern.test(label)) score += idx === 0 ? 10 : 4;
            }
            if (!score) return null;
            if (/paypal|apple pay|google pay/.test(label.toLowerCase())) score -= 8;
            return { el, label, score };
          }).filter(Boolean).sort((a, b) => b.score - a.score);
          const chosen = candidates[0];
          if (!chosen?.el) throw new Error('No likely cart or checkout action found.');
          chosen.el.scrollIntoView({ block: 'center', behavior: 'instant' });
          chosen.el.click();
          return { label: chosen.label };
        })()
      `);
      await wait(1800);
      return { ok: true, action: result, url: activeTab().url };
    },
  });

  const detectBlockers = defineTool({
    description:
      "Detect login walls, captcha prompts, verification requests, or payment fields on the current page.",
    inputSchema: z.object({}),
    execute: async () => {
      const result = await activeTab().runJs(`
        (() => {
          const bodyText = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
          const inputs = Array.from(document.querySelectorAll('input, textarea')).map((el) =>
            [el.name || '', el.id || '', el.autocomplete || '', el.placeholder || '', el.type || ''].join(' ')
          );
          return {
            hasBlockingPrompt: ${CHECKOUT_BLOCKER_PATTERNS}.test(bodyText),
            hasPaymentFields: inputs.some((entry) => ${PAYMENT_FIELD_PATTERNS}.test(entry)),
            evidence: (bodyText.match(/.{0,40}(captcha|robot|verify|verification|2fa|two-factor|sign in|log in|login|password|card|cvv|cvc|expiry).{0,60}/gi) || []).slice(0, 8),
          };
        })()
      `);
      return result;
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
    scanCommercePage,
    readPage,
    screenshot,
    clickElement,
    clickBestMatch,
    typeIntoElement,
    searchCurrentSite,
    waitFor,
    scroll,
    openSearchResult,
    openProductCandidate,
    extractCartSummary,
    advanceCheckout,
    detectBlockers,
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

export const SHOPPING_AGENT_PROMPT = `You are Blueberry, a local browser agent. Your job is to help the user complete multi-step browsing tasks end-to-end while staying safe around sensitive actions.

You are not limited to shopping. You can research pages, compare options, navigate websites, find information, open the right result, progress through forms, move toward checkout, and explain what you found through your browser actions.

If the user asks a conversational question that requires looking through websites, use the browser tools to inspect pages and gather the answer. If the user asks for a shopping task, continue until the cart or checkout stage and then hand off before payment.

Workflow:
1. If you do not already know the right site, use webSearch.
2. Use scanCommercePage immediately after navigation to understand the page and spot blockers.
3. Prefer higher-level tools first: searchCurrentSite, openSearchResult, openProductCandidate, clickBestMatch, advanceCheckout, extractCartSummary.
4. Use observePage before low-level clickElement or typeIntoElement actions to get fresh element IDs.
5. Use the site's own search box to find the product; verify the item matches the user's request (size, color, model).
6. Add the item to the cart.
7. Go to the cart/checkout page.
8. Call handOffToUser with a clear summary of the cart contents and total.

NEVER attempt to enter payment, card numbers, full addresses, OTP codes, or click "Place order".

Rules:
- One tool call per turn. After each tool result, decide the next step.
- Always check detectBlockers or scanCommercePage when the page changes significantly.
- Element IDs from observePage become stale after navigation; re-observe.
- If you hit a login wall, captcha, or 2FA, handOffToUser immediately.
- Prefer advancing to checkout and stopping before final payment submission.
- When the task is informational, keep browsing until you have enough evidence to answer well.
- Confirm price and item before adding to cart.
- Be patient: wait for pages to load, scroll if needed to find elements.
- If a step fails, try an alternative approach before giving up.`;
