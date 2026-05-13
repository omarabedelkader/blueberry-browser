import { WebContents } from "electron";
import { generateText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import * as dotenv from "dotenv";
import { join } from "path";
import type { Tab } from "./Tab";
import { AISettingsStore } from "./AISettings";

dotenv.config({ path: join(__dirname, "../../.env") });

type StepStatus = "pending" | "running" | "completed" | "failed";
type SessionStatus = "planning" | "running" | "completed" | "failed";
type ActionType =
  | "navigate"
  | "click"
  | "type"
  | "extract_text"
  | "wait"
  | "run_script";

interface ComputerUseRequest {
  goal: string;
}

interface ScriptGenerationRequest {
  goal: string;
}

interface PlannedStep {
  action: ActionType;
  label: string;
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
  ms?: number;
}

interface ComputerUseStep extends PlannedStep {
  id: string;
  status: StepStatus;
  result?: string;
  startedAt?: number;
  completedAt?: number;
}

interface GeneratedScript {
  goal: string;
  code: string;
  createdAt: number;
}

interface ComputerUseSession {
  id: string;
  goal: string;
  summary: string;
  status: SessionStatus;
  createdAt: number;
  currentUrl: string | null;
  screenshot: string | null;
  logs: string[];
  steps: ComputerUseStep[];
  generatedScript: GeneratedScript | null;
}

interface ComputerUseState {
  sessions: ComputerUseSession[];
  activeSessionId: string | null;
  isRunning: boolean;
}

const COMPUTER_USE_PROMPT = `You are Blueberry's "computer use" planner.
Return strict JSON only with this shape:
{
  "summary": "short summary",
  "steps": [
    {
      "action": "navigate|click|type|extract_text|wait|run_script",
      "label": "what the step does",
      "url": "https://...",
      "selector": "css selector",
      "text": "text to type",
      "script": "javascript for run_script",
      "ms": 500
    }
  ]
}

Rules:
- Use at most 6 steps.
- Only include fields relevant to the chosen action.
- Prefer stable CSS selectors.
- If the task is unclear, gather context first with extract_text.
- Use run_script only when it is meaningfully better than click/type.
- Blueberry also has a local sandbox for code, file, spreadsheet, and data tasks.
- Available sandbox tools are: notifyUser, currentPage, listScopedFiles, readScopedFile, writeScopedFile, useMcp.
- If the user request is mainly code/file/data work, make that explicit in the summary and keep browser steps minimal.
- Never wrap the JSON in markdown fences.`;

const SCRIPT_PROMPT = `You are generating a browser automation snippet for Blueberry Browser.
Return only JavaScript. No markdown fences.
The code will run inside the current webpage with access to the DOM.
Use async patterns when needed and add concise comments only where they help.
Favor robust selectors and readable structure.`;

export class ComputerUseManager {
  private readonly webContents: WebContents;
  private readonly getActiveTab: () => Tab | null;
  private readonly settingsStore: AISettingsStore;
  private readonly state: ComputerUseState = {
    sessions: [],
    activeSessionId: null,
    isRunning: false,
  };
  private sessionCounter = 0;

  constructor(webContents: WebContents, getActiveTab: () => Tab | null) {
    this.webContents = webContents;
    this.getActiveTab = getActiveTab;
    this.settingsStore = AISettingsStore.getInstance();
  }

  getState(): ComputerUseState {
    return this.state;
  }

  async startSession(request: ComputerUseRequest): Promise<ComputerUseState> {
    const session: ComputerUseSession = {
      id: `session-${++this.sessionCounter}`,
      goal: request.goal.trim(),
      summary: "Planning automation run",
      status: "planning",
      createdAt: Date.now(),
      currentUrl: this.getActiveTab()?.url ?? null,
      screenshot: await this.captureActiveTabScreenshot(),
      logs: ["Inspecting the active page and drafting a plan."],
      steps: [],
      generatedScript: null,
    };

    this.state.sessions = [session, ...this.state.sessions].slice(0, 6);
    this.state.activeSessionId = session.id;
    this.state.isRunning = true;
    this.emitState();

    try {
      const plan = await this.buildPlan(request.goal);
      session.summary = plan.summary;
      session.steps = plan.steps.map((step, index) => ({
        ...step,
        id: `${session.id}-step-${index + 1}`,
        status: "pending",
      }));
      session.status = "running";
      session.logs.push(`Plan ready: ${session.steps.length} steps.`);
      this.emitState();

      for (const step of session.steps) {
        step.status = "running";
        step.startedAt = Date.now();
        session.logs.push(`Running: ${step.label}`);
        this.emitState();

        try {
          const result = await this.executeStep(step);
          step.status = "completed";
          step.result = result;
          step.completedAt = Date.now();
          session.currentUrl = this.getActiveTab()?.url ?? null;
          session.screenshot = await this.captureActiveTabScreenshot();
          session.logs.push(result);
          this.emitState();
        } catch (error) {
          step.status = "failed";
          step.result = this.getErrorMessage(error);
          step.completedAt = Date.now();
          session.status = "failed";
          session.logs.push(`Failed: ${step.result}`);
          this.state.isRunning = false;
          this.emitState();
          return this.state;
        }
      }

      session.status = "completed";
      session.logs.push("Automation run completed.");
      this.state.isRunning = false;
      this.emitState();
      return this.state;
    } catch (error) {
      session.status = "failed";
      session.logs.push(`Planning failed: ${this.getErrorMessage(error)}`);
      this.state.isRunning = false;
      this.emitState();
      return this.state;
    }
  }

  async generateScript(
    request: ScriptGenerationRequest
  ): Promise<ComputerUseState> {
    const activeSession = this.getActiveSession();

    if (!activeSession) {
      await this.startSession({ goal: request.goal });
    }

    const session = this.getActiveSession();
    if (!session) {
      return this.state;
    }

    session.logs.push("Generating a browser-side snippet for the current site.");
    this.emitState();

    try {
      const code = await this.buildScript(request.goal);
      session.generatedScript = {
        goal: request.goal,
        code,
        createdAt: Date.now(),
      };
      session.logs.push("Snippet ready.");
    } catch (error) {
      session.logs.push(`Snippet generation failed: ${this.getErrorMessage(error)}`);
    }

    this.emitState();
    return this.state;
  }

  private getActiveSession(): ComputerUseSession | null {
    if (!this.state.activeSessionId) {
      return null;
    }

    return (
      this.state.sessions.find(
        (session) => session.id === this.state.activeSessionId
      ) ?? null
    );
  }

  private initializeModel(): LanguageModel | null {
    const settings = this.settingsStore.getSettings();

    switch (settings.provider) {
      case "anthropic":
        if (!process.env.ANTHROPIC_API_KEY) {
          return null;
        }
        return anthropic(settings.model);
      case "openai":
        if (!process.env.OPENAI_API_KEY) {
          return null;
        }
        return createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })(settings.model);
      case "ollama":
        return createOpenAI({
          apiKey: "ollama",
          baseURL: settings.ollamaBaseUrl,
        })(settings.model);
      default:
        return null;
    }
  }

  private async buildPlan(goal: string): Promise<{
    summary: string;
    steps: PlannedStep[];
  }> {
    const snapshot = await this.getPageSnapshot();
    const model = this.initializeModel();

    if (!model) {
      return this.buildFallbackPlan(goal, snapshot.url);
    }

    const prompt = [
      COMPUTER_USE_PROMPT,
      `Goal: ${goal}`,
      `Current URL: ${snapshot.url ?? "unknown"}`,
      `Current Title: ${snapshot.title ?? "unknown"}`,
      `Page text preview:\n${snapshot.textPreview || "No text extracted."}`,
    ].join("\n\n");

    const result = await generateText({
      model,
      system:
        "Produce valid JSON only. Do not include explanations before or after the JSON.",
      prompt,
      temperature: 0.2,
      maxRetries: 2,
    });

    const parsed = this.parseJson<{ summary?: string; steps?: PlannedStep[] }>(
      result.text
    );

    if (!parsed.steps?.length) {
      return this.buildFallbackPlan(goal, snapshot.url);
    }

    return {
      summary: parsed.summary || "Live automation plan",
      steps: parsed.steps.slice(0, 6).map((step) => this.normalizeStep(step)),
    };
  }

  private async buildScript(goal: string): Promise<string> {
    const snapshot = await this.getPageSnapshot();
    const model = this.initializeModel();

    if (!model) {
      return `// No LLM configured. Start with this scaffold.
async function runBlueberryTask() {
  const root = document.body;
  console.log("Current page:", location.href);
  console.log("Body text preview:", root?.innerText?.slice(0, 500));
}

runBlueberryTask();`;
    }

    const result = await generateText({
      model,
      system: SCRIPT_PROMPT,
      prompt: [
        `User goal: ${goal}`,
        `Current URL: ${snapshot.url ?? "unknown"}`,
        `Current Title: ${snapshot.title ?? "unknown"}`,
        `Page text preview:\n${snapshot.textPreview || "No text extracted."}`,
      ].join("\n\n"),
      temperature: 0.2,
      maxRetries: 2,
    });

    return result.text.trim();
  }

  private buildFallbackPlan(goal: string, url: string | null): {
    summary: string;
    steps: PlannedStep[];
  } {
    const detectedUrl = goal.match(/https?:\/\/\S+/)?.[0];
    const steps: PlannedStep[] = [];

    if (detectedUrl && detectedUrl !== url) {
      steps.push({
        action: "navigate",
        label: `Open ${detectedUrl}`,
        url: detectedUrl,
      });
    }

    steps.push({
      action: "extract_text",
      label: "Capture current page text",
    });

    return {
      summary: "Fallback run: collect page context and keep the operator informed.",
      steps,
    };
  }

  private normalizeStep(step: PlannedStep): PlannedStep {
    return {
      action: step.action,
      label: step.label || `Run ${step.action}`,
      url: step.url,
      selector: step.selector,
      text: step.text,
      script: step.script,
      ms: step.ms,
    };
  }

  private async executeStep(step: PlannedStep): Promise<string> {
    const tab = this.getActiveTab();
    if (!tab) {
      throw new Error("No active tab available.");
    }

    switch (step.action) {
      case "navigate":
        if (!step.url) {
          throw new Error("Navigate step is missing a URL.");
        }
        await tab.loadURL(step.url);
        return `Opened ${step.url}`;
      case "click":
        if (!step.selector) {
          throw new Error("Click step is missing a selector.");
        }
        await this.runTabScript(tab, this.buildClickScript(step.selector));
        return `Clicked ${step.selector}`;
      case "type":
        if (!step.selector) {
          throw new Error("Type step is missing a selector.");
        }
        await this.runTabScript(
          tab,
          this.buildTypeScript(step.selector, step.text ?? "")
        );
        return `Typed into ${step.selector}`;
      case "extract_text": {
        const text = await tab.getTabText();
        return `Extracted page text preview:\n${text.slice(0, 700)}`;
      }
      case "wait":
        await new Promise((resolve) => setTimeout(resolve, step.ms ?? 1000));
        return `Waited ${step.ms ?? 1000}ms`;
      case "run_script":
        if (!step.script) {
          throw new Error("Script step is missing code.");
        }
        return this.stringifyExecutionResult(await tab.runJs(step.script));
      default:
        throw new Error(`Unsupported action: ${String(step.action)}`);
    }
  }

  private async getPageSnapshot(): Promise<{
    url: string | null;
    title: string | null;
    textPreview: string;
  }> {
    const tab = this.getActiveTab();
    if (!tab) {
      return { url: null, title: null, textPreview: "" };
    }

    try {
      const text = await tab.getTabText();
      return {
        url: tab.url,
        title: tab.title,
        textPreview: text.slice(0, 2500),
      };
    } catch {
      return {
        url: tab.url,
        title: tab.title,
        textPreview: "",
      };
    }
  }

  private async captureActiveTabScreenshot(): Promise<string | null> {
    const tab = this.getActiveTab();
    if (!tab) {
      return null;
    }

    try {
      return (await tab.screenshot()).toDataURL();
    } catch {
      return null;
    }
  }

  private async runTabScript(tab: Tab, code: string): Promise<unknown> {
    return tab.runJs(code);
  }

  private buildClickScript(selector: string): string {
    return `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Element not found for selector: ${selector}");
      }
      element.scrollIntoView({ block: "center", behavior: "instant" });
      if (element instanceof HTMLElement) {
        element.click();
      } else {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
      return true;
    })()`;
  }

  private buildTypeScript(selector: string, text: string): string {
    return `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Element not found for selector: ${selector}");
      }
      const value = ${JSON.stringify(text)};
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      if (element instanceof HTMLElement && element.isContentEditable) {
        element.focus();
        element.innerText = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      throw new Error("Element is not an input, textarea, or contenteditable node.");
    })()`;
  }

  private stringifyExecutionResult(result: unknown): string {
    if (typeof result === "string") {
      return result;
    }

    if (result === undefined) {
      return "Script executed.";
    }

    return JSON.stringify(result, null, 2);
  }

  private parseJson<T>(value: string): T {
    const cleaned = value
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "")
      .trim();

    return JSON.parse(cleaned) as T;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown error";
  }

  private emitState(): void {
    this.webContents.send("computer-use-state", this.state);
  }
}
