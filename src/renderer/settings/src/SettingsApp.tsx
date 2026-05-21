import React, { useEffect, useState } from "react";
import { Button } from "@common/components/Button";
import { useDarkMode } from "@common/hooks/useDarkMode";
import {
  Bot,
  Globe,
  LayoutPanelLeft,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";

type AppSettings = Awaited<ReturnType<typeof window.settingsAPI.getAppSettings>>;
type OllamaModelsResult = Awaited<ReturnType<typeof window.settingsAPI.listOllamaModels>>;

export const SettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaState, setOllamaState] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: false, error: null });
  const { isDarkMode, setDarkMode } = useDarkMode();

  useEffect(() => {
    const load = async () => {
      const next = await window.settingsAPI.getAppSettings();
      setSettings(next);
    };

    void load();
    window.settingsAPI.onAppSettingsUpdated((next) => setSettings(next));

    return () => {
      window.settingsAPI.removeAppSettingsUpdatedListener();
    };
  }, []);

  const loadOllamaModels = async (): Promise<OllamaModelsResult> => {
    setOllamaState({ loading: true, error: null });
    const result = await window.settingsAPI.listOllamaModels();
    setOllamaModels(result.models);
    setOllamaState({
      loading: false,
      error: result.ok ? null : result.error,
    });
    return result;
  };

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const next = await window.settingsAPI.updateAppSettings(patch);
    setSettings(next);
    if (typeof patch.sidebarWidth === "number") {
      await window.settingsAPI.setSidebarWidth(patch.sidebarWidth);
    }
    
    // Load Ollama models if switching to Ollama
    if ((patch.provider ?? next.provider) === "ollama") {
      void loadOllamaModels();
    }
  };

  useEffect(() => {
    if (settings?.provider === "ollama") {
      void loadOllamaModels();
    } else {
      setOllamaModels([]);
      setOllamaState({ loading: false, error: null });
    }
  }, [settings?.provider, settings?.ollamaBaseUrl]);

  if (!settings) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,rgba(9,13,20,0.98),rgba(10,15,23,0.98))]">
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browser-wide preferences live here, not in the AI workspace.
          </p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => void window.settingsAPI.closeBrowserSettings()}
          title="Close settings"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-[28px] border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                <Bot className="size-4 text-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">AI Provider</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Choose your LLM provider and model. Changes apply immediately.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Provider
                </label>
                <select
                  value={settings.provider}
                  onChange={(event) =>
                    void updateSettings({
                      provider: event.target.value as AppSettings["provider"],
                    })
                  }
                  className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>

              {settings.provider === "ollama" ? (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Ollama Base URL
                    </label>
                    <input
                      value={settings.ollamaBaseUrl}
                      onChange={(event) =>
                        setSettings({ ...settings, ollamaBaseUrl: event.target.value })
                      }
                      onBlur={(event) =>
                        void updateSettings({ ollamaBaseUrl: event.target.value })
                      }
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                      placeholder="http://127.0.0.1:11434"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Model
                    </label>
                    <select
                      value={settings.model}
                      onChange={(event) => void updateSettings({ model: event.target.value })}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    >
                      <option value="">
                        {ollamaState.loading
                          ? "Loading Ollama models..."
                          : ollamaState.error
                            ? "Ollama offline"
                            : ollamaModels.length > 0
                              ? "Choose model"
                              : "No models found"}
                      </option>
                      {ollamaModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    {ollamaState.error && (
                      <p className="mt-2 text-xs text-muted-foreground">{ollamaState.error}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Run <code className="rounded bg-secondary px-1 py-0.5">ollama list</code> to
                      see installed models.
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Model
                  </label>
                  <input
                    value={settings.model}
                    onChange={(event) =>
                      setSettings({ ...settings, model: event.target.value })
                    }
                    onBlur={(event) => void updateSettings({ model: event.target.value })}
                    className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    placeholder={
                      settings.provider === "openai"
                        ? "gpt-4o-mini"
                        : "claude-3-5-sonnet-20241022"
                    }
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {settings.provider === "openai"
                      ? "Requires OPENAI_API_KEY in .env file"
                      : "Requires ANTHROPIC_API_KEY in .env file"}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                <Globe className="size-4 text-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">General</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Control default navigation behavior for the browser.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Theme</label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1">
                  <button
                    type="button"
                    onClick={() => setDarkMode(false)}
                    className={
                      isDarkMode
                        ? "rounded-[18px] px-3 py-2 text-sm text-muted-foreground transition-colors"
                        : "rounded-[18px] bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors"
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <Sun className="size-4" />
                      Light
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkMode(true)}
                    className={
                      isDarkMode
                        ? "rounded-[18px] bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors"
                        : "rounded-[18px] px-3 py-2 text-sm text-muted-foreground transition-colors"
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <Moon className="size-4" />
                      Dark
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Homepage / New Tab URL</label>
                <input
                  value={settings.homepage}
                  onChange={(event) => setSettings({ ...settings, homepage: event.target.value })}
                  onBlur={(event) => void updateSettings({ homepage: event.target.value })}
                  className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                <Search className="size-4 text-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Search</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Pick the search engine used when text entered in the address bar is not a URL.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <select
                value={settings.searchEngine}
                onChange={(event) =>
                  void updateSettings({
                    searchEngine: event.target.value as AppSettings["searchEngine"],
                  })
                }
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="google">Google</option>
                <option value="duckduckgo">DuckDuckGo</option>
                <option value="bing">Bing</option>
              </select>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                <LayoutPanelLeft className="size-4 text-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Panels</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Configure panel width and automatic routing behavior.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Sidebar Width</label>
                <input
                  type="range"
                  min={320}
                  max={720}
                  value={settings.sidebarWidth}
                  onChange={(event) => {
                    const width = Number(event.target.value);
                    setSettings({ ...settings, sidebarWidth: width });
                    void updateSettings({ sidebarWidth: width });
                  }}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-muted-foreground">{settings.sidebarWidth}px</p>
              </div>

              <label className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-3 py-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={settings.autoRouteToSandbox}
                  onChange={(event) =>
                    void updateSettings({ autoRouteToSandbox: event.target.checked })
                  }
                />
                Automatically switch to sandbox for code, file, and data tasks
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
