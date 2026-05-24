import { WebContents } from "electron";
import { streamText, type LanguageModel, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ai-sdk-ollama";
import * as dotenv from "dotenv";
import { join } from "path";
import type { Window } from "./Window";
import { AISettingsStore, type SearchEngine } from "./AISettings";
import { logger } from "./Logger";

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, "../../.env") });

interface ChatRequest {
  message: string;
  messageId: string;
}

interface StreamChunk {
  content: string;
  isComplete: boolean;
}

interface SearchResultCandidate {
  href: string;
  title: string;
}

const MAX_CONTEXT_LENGTH = 4000;
const DEFAULT_TEMPERATURE = 0.7;
const BROWSER_ACTION_PATTERN =
  /\b(open|go to|visit|search|find|click|type|fill|submit|add to cart|add to checkout|checkout|buy|book|order|sign in|log in)\b/i;
const NON_ACTION_PATTERN =
  /\b(explain|summari[sz]e|what is|what does|analy[sz]e|review|describe|tell me|why)\b/i;
const SHOPPING_PATTERN =
  /\b(buy|purchase|order|add to cart|shop for|find.*price|checkout)\b/i;
const DIRECT_SEARCH_PATTERNS = [
  /^\s*search(?:\s+for)?\s+(.+?)\s*$/i,
  /^\s*look\s+up\s+(.+?)\s*$/i,
  /^\s*find\s+(.+?)\s*$/i,
] as const;

export class LLMClient {
  private readonly webContents: WebContents;
  private window: Window | null = null;
  private readonly settingsStore: AISettingsStore;
  private messages: CoreMessage[] = [];

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.settingsStore = AISettingsStore.getInstance();

    this.logInitializationStatus();
  }

  // Set the window reference after construction to avoid circular dependencies
  setWindow(window: Window): void {
    this.window = window;
  }

  private logInitializationStatus(): void {
    const { provider, model } = this.settingsStore.getSettings();
    const initialized = Boolean(this.initializeModel());

    if (initialized) {
      logger.info(
        `✅ LLM Client initialized with ${provider} provider using model: ${model}`
      );
    } else {
      logger.error(
        initialized
          ? `❌ LLM Client initialization failed for ${provider}:${model}.`
          : `❌ LLM Client initialization failed. Check your selected provider settings and API keys.`
      );
    }
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    try {
      // Get screenshot from active tab if available
      let screenshot: string | null = null;
      if (this.window) {
        const activeTab = this.window.activeTab;
        if (activeTab) {
          try {
            const image = await activeTab.screenshot();
            screenshot = image.toDataURL();
          } catch (error) {
            logger.error("Failed to capture screenshot", error);
          }
        }
      }

      // Build user message content with screenshot first, then text
      const userContent: any[] = [];
      
      // Add screenshot as the first part if available
      if (screenshot) {
        userContent.push({
          type: "image",
          image: screenshot,
        });
      }
      
      // Add text content
      userContent.push({
        type: "text",
        text: request.message,
      });

      // Create user message in CoreMessage format
      const userMessage: CoreMessage = {
        role: "user",
        content: userContent.length === 1 ? request.message : userContent,
      };
      
      this.messages.push(userMessage);

      // Send updated messages to renderer
      this.sendMessagesToRenderer();

      if (await this.handleDirectSearchRequest(request)) {
        return;
      }

      if (this.shouldUseBrowserAutomation(request.message)) {
        await this.handleBrowserAutomationRequest(request);
        return;
      }

      const model = this.initializeModel();
      if (!model) {
        this.sendErrorMessage(
          request.messageId,
          "LLM service is not configured. Pick a model in AI panel settings and make sure the provider is reachable."
        );
        return;
      }

      const messages = await this.prepareMessagesWithContext(request);
      await this.streamResponse(messages, request.messageId, model);
    } catch (error) {
      logger.error("Error in LLM request", error);
      this.handleStreamError(error, request.messageId);
    }
  }

  clearMessages(): void {
    this.messages = [];
    this.sendMessagesToRenderer();
  }

  getMessages(): CoreMessage[] {
    return this.messages;
  }

  private shouldUseBrowserAutomation(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) {
      return false;
    }

    return BROWSER_ACTION_PATTERN.test(trimmed) && !NON_ACTION_PATTERN.test(trimmed);
  }

  private shouldUseAgentMode(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) {
      return false;
    }

    return SHOPPING_PATTERN.test(trimmed);
  }

  private async handleDirectSearchRequest(
    request: ChatRequest
  ): Promise<boolean> {
    const query = this.extractDirectSearchQuery(request.message);
    if (!query) {
      return false;
    }

    if (!this.window?.activeTab) {
      this.sendErrorMessage(
        request.messageId,
        "Search is unavailable because there is no active tab."
      );
      return true;
    }

    const searchEngine = this.settingsStore.getSettings().searchEngine;
    const searchUrl = this.buildSearchUrl(query, searchEngine);
    const providerLabel = this.getSearchEngineLabel(searchEngine);

    this.sendThought(`Thinking about the request.\nI should search ${providerLabel} for "${query}".\n`);

    try {
      await this.window.activeTab.loadURL(searchUrl);
    } catch (error) {
      this.sendErrorMessage(
        request.messageId,
        `I tried to search for "${query}", but opening the results page failed: ${this.getErrorMessage(
          error
        )}`
      );
      return true;
    }

    this.sendThought(`Opened ${providerLabel} results.\nNow I am scanning the page for the first likely website result.\n`);
    const firstResult = await this.findFirstSearchResult();
    if (firstResult) {
      try {
        this.sendThought(`I found a promising result: "${firstResult.title}".\nOpening that website now.\n`);
        await this.window.activeTab.loadURL(firstResult.href);
        const response = `I searched ${providerLabel} for "${query}", scanned the results, and opened "${firstResult.title}".`;
        this.appendAssistantMessage(response);
        this.sendStreamChunk(request.messageId, {
          content: response,
          isComplete: true,
        });
        return true;
      } catch (error) {
        const response = `I searched ${providerLabel} for "${query}" and found "${firstResult.title}", but opening it failed. I left the search results page open instead.`;
        this.appendAssistantMessage(response);
        this.sendStreamChunk(request.messageId, {
          content: response,
          isComplete: true,
        });
        return true;
      }
    }

    const response = `I searched ${providerLabel} for "${query}" and opened the results page. I could not confidently pick a website result yet.`;
    this.appendAssistantMessage(response);
    this.sendStreamChunk(request.messageId, {
      content: response,
      isComplete: true,
    });
    return true;
  }

  private extractDirectSearchQuery(message: string): string | null {
    const trimmed = message.trim();
    if (!trimmed) {
      return null;
    }

    for (const pattern of DIRECT_SEARCH_PATTERNS) {
      const match = trimmed.match(pattern);
      const query = match?.[1]?.trim().replace(/[?.!]+$/, "");
      if (!query) {
        continue;
      }

      if (/\b(on|at|in)\s+(this\s+(site|page)|here|amazon|google|bing|duckduckgo|youtube|wikipedia)\b/i.test(query)) {
        return null;
      }

      return query;
    }

    return null;
  }

  private buildSearchUrl(query: string, searchEngine: SearchEngine): string {
    const encodedQuery = encodeURIComponent(query);

    switch (searchEngine) {
      case "duckduckgo":
        return `https://duckduckgo.com/?q=${encodedQuery}`;
      case "bing":
        return `https://www.bing.com/search?q=${encodedQuery}`;
      case "google":
      default:
        return `https://www.google.com/search?q=${encodedQuery}`;
    }
  }

  private getSearchEngineLabel(searchEngine: SearchEngine): string {
    switch (searchEngine) {
      case "duckduckgo":
        return "DuckDuckGo";
      case "bing":
        return "Bing";
      case "google":
      default:
        return "Google";
    }
  }

  private async findFirstSearchResult(): Promise<SearchResultCandidate | null> {
    if (!this.window?.activeTab) {
      return null;
    }

    try {
      const candidate = await this.window.activeTab.runJs(`
        (() => {
          const text = (value) => (value || "").replace(/\\s+/g, " ").trim();
          const hostname = window.location.hostname;

          const selectors = hostname.includes("google.")
            ? ["a h3", "div[jscontroller] a h3"]
            : hostname.includes("bing.com")
              ? ["li.b_algo h2 a", ".b_algo h2 a"]
              : hostname.includes("duckduckgo.com")
                ? ["article[data-testid='result'] h2 a", "[data-testid='result-title-a']"]
                : ["main a", "a"];

          const seen = new Set();
          const blockedHosts = [
            "google.com",
            "www.google.com",
            "bing.com",
            "www.bing.com",
            "duckduckgo.com",
            "www.duckduckgo.com",
          ];

          const getAnchor = (node) => {
            if (!node) return null;
            if (node.tagName === "A") return node;
            return node.closest("a");
          };

          for (const selector of selectors) {
            const nodes = Array.from(document.querySelectorAll(selector));
            for (const node of nodes) {
              const anchor = getAnchor(node);
              if (!anchor) continue;

              const href = anchor.href;
              const title = text(anchor.textContent || node.textContent);
              if (!href || !title) continue;
              if (!/^https?:/i.test(href)) continue;
              if (seen.has(href)) continue;
              seen.add(href);

              let url;
              try {
                url = new URL(href);
              } catch {
                continue;
              }

              if (blockedHosts.includes(url.hostname)) continue;
              if (url.pathname.startsWith("/search")) continue;

              return { href, title };
            }
          }

          return null;
        })();
      `);

      if (
        candidate &&
        typeof candidate === "object" &&
        typeof candidate.href === "string" &&
        typeof candidate.title === "string"
      ) {
        return candidate as SearchResultCandidate;
      }
    } catch (error) {
      logger.error("Failed to inspect search results", error);
    }

    return null;
  }

  private async handleBrowserAutomationRequest(
    request: ChatRequest
  ): Promise<void> {
    if (!this.window) {
      this.sendErrorMessage(
        request.messageId,
        "Browser automation is unavailable because the main window is not ready."
      );
      return;
    }

    // Use agent mode for shopping tasks
    const useAgent = this.shouldUseAgentMode(request.message);
    this.sendThought(
      useAgent
        ? "Thinking through the task.\nThis looks like an end-to-end browsing task, so I am switching into autonomous agent mode.\n"
        : "Thinking through the task.\nI am planning browser actions and will narrate the steps as I go.\n"
    );

    const state = useAgent
      ? await this.window.sidebar.computerUse.startAgentSession({
          goal: request.message.trim(),
        })
      : await this.window.sidebar.computerUse.startSession({
          goal: request.message.trim(),
        });

    const session =
      state.sessions.find((entry) => entry.id === state.activeSessionId) ??
      state.sessions[0] ??
      null;

    if (!session) {
      this.sendErrorMessage(
        request.messageId,
        "I couldn't start the browser task."
      );
      return;
    }

    const completedSteps = session.steps
      .filter((step) => step.status === "completed")
      .map((step) => `- ${step.label}`)
      .slice(0, 5);

    const failedStep = session.steps.find((step) => step.status === "failed");
    const lines = [
      session.status === "completed"
        ? useAgent
          ? "I used the autonomous agent to carry out that task."
          : "I used browser tools to carry out that task."
        : session.status === "failed"
          ? "I started the browser task, but it failed before finishing."
          : "I started the browser task.",
      session.summary,
    ];

    if (completedSteps.length > 0) {
      lines.push("", "Completed steps:", ...completedSteps);
    }

    if (failedStep?.result) {
      lines.push("", `Problem: ${failedStep.result}`);
    }

    if (session.currentUrl) {
      lines.push("", `Current page: ${session.currentUrl}`);
    }

    this.appendAssistantMessage(lines.join("\n"));
    this.sendStreamChunk(request.messageId, {
      content: lines.join("\n"),
      isComplete: true,
    });
  }

  private appendAssistantMessage(content: string): void {
    this.messages.push({
      role: "assistant",
      content,
    });
    this.sendMessagesToRenderer();
  }

  private sendMessagesToRenderer(): void {
    this.webContents.send("chat-messages-updated", this.messages);
  }

  private async prepareMessagesWithContext(_request: ChatRequest): Promise<CoreMessage[]> {
    // Get page context from active tab
    let pageUrl: string | null = null;
    let pageText: string | null = null;
    
    if (this.window) {
      const activeTab = this.window.activeTab;
      if (activeTab) {
        pageUrl = activeTab.url;
        try {
          pageText = await activeTab.getTabText();
        } catch (error) {
          logger.error("Failed to get page text", error);
        }
      }
    }

    // Build system message
    const systemMessage: CoreMessage = {
      role: "system",
      content: this.buildSystemPrompt(pageUrl, pageText),
    };

    // Include all messages in history (system + conversation)
    return [systemMessage, ...this.messages];
  }

  private buildSystemPrompt(url: string | null, pageText: string | null): string {
    const parts: string[] = [
      "You are a helpful AI assistant integrated into a web browser.",
      "You can analyze and discuss web pages with the user.",
      "The user's messages may include screenshots of the current page as the first image.",
    ];

    if (url) {
      parts.push(`\nCurrent page URL: ${url}`);
    }

    if (pageText) {
      const truncatedText = this.truncateText(pageText, MAX_CONTEXT_LENGTH);
      parts.push(`\nPage content (text):\n${truncatedText}`);
    }

    parts.push(
      "\nPlease provide helpful, accurate, and contextual responses about the current webpage.",
      "If the user asks about specific content, refer to the page content and/or screenshot provided."
    );

    return parts.join("\n");
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  private async streamResponse(
    messages: CoreMessage[],
    messageId: string,
    model: LanguageModel
  ): Promise<void> {
    try {
      const result = await streamText({
        model,
        messages,
        temperature: DEFAULT_TEMPERATURE,
        maxRetries: 3,
        abortSignal: undefined, // Could add abort controller for cancellation
      });

      await this.processStream(result.textStream, messageId);
    } catch (error) {
      throw error; // Re-throw to be handled by the caller
    }
  }

  private async processStream(
    textStream: AsyncIterable<string>,
    messageId: string
  ): Promise<void> {
    let accumulatedText = "";

    // Create a placeholder assistant message
    const assistantMessage: CoreMessage = {
      role: "assistant",
      content: "",
    };
    
    // Keep track of the index for updates
    const messageIndex = this.messages.length;
    this.messages.push(assistantMessage);

    for await (const chunk of textStream) {
      accumulatedText += chunk;

      // Update assistant message content
      this.messages[messageIndex] = {
        role: "assistant",
        content: accumulatedText,
      };
      this.sendMessagesToRenderer();

      this.sendStreamChunk(messageId, {
        content: chunk,
        isComplete: false,
      });
    }

    // Final update with complete content
    this.messages[messageIndex] = {
      role: "assistant",
      content: accumulatedText,
    };
    this.sendMessagesToRenderer();

    // Send the final complete signal
    this.sendStreamChunk(messageId, {
      content: accumulatedText,
      isComplete: true,
    });
  }

  private handleStreamError(error: unknown, messageId: string): void {
    logger.error("Error streaming from LLM", error);

    const errorMessage = this.getErrorMessage(error);
    this.sendErrorMessage(messageId, errorMessage);
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return "An unexpected error occurred. Please try again.";
    }

    const message = error.message.toLowerCase();

    if (message.includes("401") || message.includes("unauthorized")) {
      return "Authentication error: Please check your API key in the .env file.";
    }

    if (message.includes("429") || message.includes("rate limit")) {
      return "Rate limit exceeded. Please try again in a few moments.";
    }

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnrefused")
    ) {
      return "Network error: Please check your internet connection.";
    }

    if (message.includes("timeout")) {
      return "Request timeout: The service took too long to respond. Please try again.";
    }

    return "Sorry, I encountered an error while processing your request. Please try again.";
  }

  private sendErrorMessage(messageId: string, errorMessage: string): void {
    this.sendStreamChunk(messageId, {
      content: errorMessage,
      isComplete: true,
    });
  }

  private sendStreamChunk(messageId: string, chunk: StreamChunk): void {
    this.webContents.send("chat-response", {
      messageId,
      content: chunk.content,
      isComplete: chunk.isComplete,
    });
  }

  private sendThought(content: string): void {
    this.webContents.send("chat-response", {
      messageId: "agent-thinking",
      content,
      isComplete: false,
    });
  }

  private initializeModel(): LanguageModel | null {
    const settings = this.settingsStore.getSettings();

    switch (settings.provider) {
      case "anthropic": {
        if (!process.env.ANTHROPIC_API_KEY) {
          return null;
        }
        return anthropic(settings.model);
      }
      case "openai": {
        if (!process.env.OPENAI_API_KEY) {
          return null;
        }
        return createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })(settings.model);
      }
      case "ollama":
        return createOllama({
          baseURL: settings.ollamaBaseUrl,
        })(settings.model);
      default:
        return null;
    }
  }
}
