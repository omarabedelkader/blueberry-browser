import React, { useEffect, useState } from "react";
import { Button } from "@common/components/Button";
import { useDarkMode } from "@common/hooks/useDarkMode";
import {
  Globe,
  LayoutPanelLeft,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";

type AppSettings = Awaited<ReturnType<typeof window.settingsAPI.getAppSettings>>;

export const SettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
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

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const next = await window.settingsAPI.updateAppSettings(patch);
    setSettings(next);
    if (typeof patch.sidebarWidth === "number") {
      await window.settingsAPI.setSidebarWidth(patch.sidebarWidth);
    }
  };

  if (!settings) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,rgba(9,13,20,0.98),rgba(10,15,23,0.98))]">
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Blueberry Browser
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Settings</h1>
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

        <section className="mt-4 rounded-[28px] border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
              <SlidersHorizontal className="size-4 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Notes</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                For Ollama, run `ollama list` on this computer and paste one of those installed model names into the model field above.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
