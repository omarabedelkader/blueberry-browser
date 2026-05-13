import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export type LLMProvider = "ollama" | "openai" | "anthropic";
export type SearchEngine = "google" | "duckduckgo" | "bing";

export interface AISettings {
  provider: LLMProvider;
  model: string;
  ollamaBaseUrl: string;
  homepage: string;
  searchEngine: SearchEngine;
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
}

const DEFAULTS: Record<LLMProvider, { model: string }> = {
  ollama: { model: "" },
  openai: { model: "gpt-4o-mini" },
  anthropic: { model: "claude-3-5-sonnet-20241022" },
};

const DEFAULT_HOMEPAGE = "https://www.google.com";
const DEFAULT_SEARCH_ENGINE: SearchEngine = "google";
const DEFAULT_SIDEBAR_WIDTH = 400;

export class AISettingsStore {
  private static instance: AISettingsStore | null = null;
  private readonly filePath: string;
  private settings: AISettings;

  private constructor() {
    this.filePath = join(app.getPath("userData"), "ai-settings.json");
    this.settings = this.load();
  }

  static getInstance(): AISettingsStore {
    if (!AISettingsStore.instance) {
      AISettingsStore.instance = new AISettingsStore();
    }
    return AISettingsStore.instance;
  }

  getSettings(): AISettings {
    return { ...this.settings };
  }

  updateSettings(input: Partial<AISettings>): AISettings {
    const nextProvider = input.provider ?? this.settings.provider;
    const hasModelUpdate = typeof input.model === "string";
    const nextModel = hasModelUpdate
      ? input.model.trim()
      : this.settings.model || DEFAULTS[nextProvider].model;

    this.settings = {
      provider: nextProvider,
      model: nextModel,
      ollamaBaseUrl:
        input.ollamaBaseUrl?.trim() ||
        this.settings.ollamaBaseUrl ||
        "http://127.0.0.1:11434/v1",
      homepage: input.homepage?.trim() || this.settings.homepage || DEFAULT_HOMEPAGE,
      searchEngine:
        input.searchEngine ?? this.settings.searchEngine ?? DEFAULT_SEARCH_ENGINE,
      autoRouteToSandbox:
        input.autoRouteToSandbox ?? this.settings.autoRouteToSandbox ?? true,
      sidebarWidth: this.parseSidebarWidth(
        input.sidebarWidth ?? this.settings.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
      ),
    };

    if (input.provider && !input.model) {
      this.settings.model = DEFAULTS[input.provider].model;
    }

    this.persist();
    return this.getSettings();
  }

  private load(): AISettings {
    const fallback = this.buildDefaults();

    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      return {
        provider: this.parseProvider(parsed.provider) ?? fallback.provider,
        model: parsed.model?.trim() || fallback.model,
        ollamaBaseUrl: parsed.ollamaBaseUrl?.trim() || fallback.ollamaBaseUrl,
        homepage: parsed.homepage?.trim() || fallback.homepage,
        searchEngine:
          this.parseSearchEngine(parsed.searchEngine) ?? fallback.searchEngine,
        autoRouteToSandbox:
          typeof parsed.autoRouteToSandbox === "boolean"
            ? parsed.autoRouteToSandbox
            : fallback.autoRouteToSandbox,
        sidebarWidth: this.parseSidebarWidth(parsed.sidebarWidth ?? fallback.sidebarWidth),
      };
    } catch {
      return fallback;
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf8");
  }

  private buildDefaults(): AISettings {
    const provider = this.parseProvider(process.env.LLM_PROVIDER) ?? "ollama";

    return {
      provider,
      model: process.env.LLM_MODEL || DEFAULTS[provider].model,
      ollamaBaseUrl:
        process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434/v1",
      homepage: process.env.BROWSER_HOMEPAGE?.trim() || DEFAULT_HOMEPAGE,
      searchEngine:
        this.parseSearchEngine(process.env.BROWSER_SEARCH_ENGINE) ??
        DEFAULT_SEARCH_ENGINE,
      autoRouteToSandbox: true,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    };
  }

  private parseProvider(value: string | undefined): LLMProvider | null {
    if (value === "openai" || value === "anthropic" || value === "ollama") {
      return value;
    }
    return null;
  }

  private parseSearchEngine(value: string | undefined): SearchEngine | null {
    if (value === "google" || value === "duckduckgo" || value === "bing") {
      return value;
    }
    return null;
  }

  private parseSidebarWidth(value: number): number {
    return Math.max(320, Math.min(720, Math.round(value)));
  }
}
