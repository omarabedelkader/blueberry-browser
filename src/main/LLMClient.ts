import { WebContents } from "electron";
import { streamText, type LanguageModel, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ai-sdk-ollama";
import * as dotenv from "dotenv";
import { join } from "path";
import type { Window } from "./Window";
import { AISettingsStore } from "./AISettings";

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

const MAX_CONTEXT_LENGTH = 4000;
const DEFAULT_TEMPERATURE = 0.7;
const BROWSER_ACTION_PATTERN =
  /\b(open|go to|visit|search|find|click|type|fill|submit|add to cart|add to checkout|checkout|buy|book|order|sign in|log in)\b/i;
const NON_ACTION_PATTERN =
  /\b(explain|summari[sz]e|what is|what does|analy[sz]e|review|describe|tell me|why)\b/i;
const SHOPPING_PATTERN =
  /\b(buy|purchase|order|add to cart|shop for|find.*price|checkout)\b/i;

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
      console.log(
        `✅ LLM Client initialized with ${provider} provider using model: ${model}`
      );
    } else {
      console.error(
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
            console.error("Failed to capture screenshot:", error);
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
      console.error("Error in LLM request:", error);
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
          console.error("Failed to get page text:", error);
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
    console.error("Error streaming from LLM:", error);

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
