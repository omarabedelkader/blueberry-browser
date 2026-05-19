import { ipcMain, WebContents } from "electron";
import type { Window } from "./Window";
import { AISettingsStore } from "./AISettings";

export class EventManager {
  private static readonly HANDLE_CHANNELS = [
    "create-tab",
    "close-tab",
    "switch-tab",
    "get-tabs",
    "navigate-to",
    "navigate-tab",
    "go-back",
    "go-forward",
    "reload",
    "tab-go-back",
    "tab-go-forward",
    "tab-reload",
    "tab-screenshot",
    "tab-run-js",
    "get-active-tab-info",
    "toggle-sidebar",
    "open-browser-settings",
    "close-browser-settings",
    "sidebar-get-layout",
    "sidebar-set-width",
    "sidebar-chat-message",
    "sidebar-clear-chat",
    "sidebar-get-messages",
    "computer-use-get-state",
    "computer-use-start",
    "computer-use-generate-script",
    "sandbox-get-state",
    "sandbox-create-file",
    "sandbox-update-file",
    "sandbox-delete-file",
    "sandbox-set-active-file",
    "sandbox-set-entry-file",
    "sandbox-run",
    "ai-settings-get",
    "ai-settings-update",
    "ollama-models-list",
    "app-settings-get",
    "app-settings-update",
    "get-page-content",
    "get-page-text",
    "get-current-url",
  ] as const;
  private readonly getMainWindow: () => Window | null;
  private settingsStore: AISettingsStore;

  constructor(getMainWindow: () => Window | null) {
    this.getMainWindow = getMainWindow;
    this.settingsStore = AISettingsStore.getInstance();
    this.removeRegisteredHandlers();
    this.setupEventHandlers();
  }

  private getAvailableMainWindow(): Window | null {
    return this.getMainWindow();
  }

  private requireMainWindow(): Window {
    const mainWindow = this.getAvailableMainWindow();
    if (!mainWindow) {
      throw new Error("Main window is not available.");
    }
    return mainWindow;
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Computer use and sandbox events
    this.handleFeatureWorkspaceEvents();

    // AI settings
    this.handleAISettingsEvents();

    // Page content events
    this.handlePageContentEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // Debug events
    this.handleDebugEvents();
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.requireMainWindow().createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.requireMainWindow().closeTab(id);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.requireMainWindow().switchActiveTab(id);
    });

    // Get tabs
    ipcMain.handle("get-tabs", () => {
      const mainWindow = this.getAvailableMainWindow();
      if (!mainWindow) {
        return [];
      }
      const activeTabId = mainWindow.activeTab?.id;
      return mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: activeTabId === tab.id,
      }));
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab) {
        mainWindow.activeTab.loadURL(url);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.requireMainWindow().getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab) {
        mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab) {
        mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab) {
        mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.requireMainWindow().getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.requireMainWindow().getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.requireMainWindow().getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.requireMainWindow().getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.requireMainWindow().getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const mainWindow = this.getAvailableMainWindow();
      const activeTab = mainWindow?.activeTab ?? null;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.navigationHistory.canGoBack(),
          canGoForward: activeTab.webContents.navigationHistory.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      const mainWindow = this.requireMainWindow();
      mainWindow.sidebar.toggle();
      mainWindow.updateAllBounds();
      return true;
    });

    ipcMain.handle("open-browser-settings", () => {
      const mainWindow = this.requireMainWindow();
      mainWindow.browserSettings.show();
      mainWindow.browserSettings.send("browser-settings-opened");
      return true;
    });

    ipcMain.handle("close-browser-settings", () => {
      const mainWindow = this.requireMainWindow();
      mainWindow.browserSettings.hide();
      return true;
    });

    ipcMain.handle("sidebar-get-layout", () => {
      return this.requireMainWindow().getSidebarState();
    });

    ipcMain.handle("sidebar-set-width", (_, width: number) => {
      return this.requireMainWindow().setSidebarWidth(width);
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      // The LLMClient now handles getting the screenshot and context directly
      await this.requireMainWindow().sidebar.client.sendChatMessage(request);
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.requireMainWindow().sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.requireMainWindow().sidebar.client.getMessages();
    });
  }

  private handleFeatureWorkspaceEvents(): void {
    ipcMain.handle("computer-use-get-state", () => {
      const mainWindow = this.getAvailableMainWindow();
      return (
        mainWindow?.sidebar.computerUse.getState() ?? {
          sessions: [],
          activeSessionId: null,
          isRunning: false,
        }
      );
    });

    ipcMain.handle("computer-use-start", async (_, request) => {
      return this.requireMainWindow().sidebar.computerUse.startSession(request);
    });

    ipcMain.handle("computer-use-generate-script", async (_, request) => {
      return this.requireMainWindow().sidebar.computerUse.generateScript(request);
    });

    ipcMain.handle("sandbox-get-state", () => {
      const mainWindow = this.getAvailableMainWindow();
      return (
        mainWindow?.sidebar.sandbox.getState() ?? {
          files: [],
          activeFileId: null,
          entryFileId: null,
          runs: [],
          isRunning: false,
        }
      );
    });

    ipcMain.handle("sandbox-create-file", (_, input) => {
      return this.requireMainWindow().sidebar.sandbox.createFile(input);
    });

    ipcMain.handle("sandbox-update-file", (_, fileId: string, patch) => {
      return this.requireMainWindow().sidebar.sandbox.updateFile(fileId, patch);
    });

    ipcMain.handle("sandbox-delete-file", (_, fileId: string) => {
      return this.requireMainWindow().sidebar.sandbox.deleteFile(fileId);
    });

    ipcMain.handle("sandbox-set-active-file", (_, fileId: string) => {
      return this.requireMainWindow().sidebar.sandbox.setActiveFile(fileId);
    });

    ipcMain.handle("sandbox-set-entry-file", (_, fileId: string) => {
      return this.requireMainWindow().sidebar.sandbox.setEntryFile(fileId);
    });

    ipcMain.handle("sandbox-run", async (_, request) => {
      return this.requireMainWindow().sidebar.sandbox.run(request);
    });
  }

  private handleAISettingsEvents(): void {
    ipcMain.handle("ai-settings-get", () => {
      return this.settingsStore.getSettings();
    });

    ipcMain.handle("ai-settings-update", (_, settings) => {
      const updated = this.settingsStore.updateSettings(settings);
      this.requireMainWindow().sidebar.view.webContents.send(
        "ai-settings-updated",
        updated
      );
      return updated;
    });

    ipcMain.handle("app-settings-get", () => {
      return this.settingsStore.getSettings();
    });

    ipcMain.handle("app-settings-update", (_, settings) => {
      const updated = this.settingsStore.updateSettings(settings);
      const mainWindow = this.requireMainWindow();
      mainWindow.sidebar.view.webContents.send("ai-settings-updated", updated);
      mainWindow.topBar.view.webContents.send("app-settings-updated", updated);
      mainWindow.browserSettings.send("app-settings-updated", updated);
      return updated;
    });

    ipcMain.handle("ollama-models-list", async () => {
      const settings = this.settingsStore.getSettings();
      const baseUrl = (settings.ollamaBaseUrl || "http://127.0.0.1:11434/v1").trim();

      const normalizedBaseUrl = baseUrl.endsWith("/v1")
        ? baseUrl.slice(0, -3)
        : baseUrl.replace(/\/+$/, "");

      try {
        const response = await fetch(`${normalizedBaseUrl}/api/tags`);
        if (!response.ok) {
          return {
            ok: false,
            models: [],
            error: `Ollama responded with ${response.status}.`,
          };
        }

        const data = (await response.json()) as {
          models?: Array<{ name?: string; model?: string }>;
        };

        const models = (data.models ?? [])
          .map((entry) => entry.name || entry.model || "")
          .filter((name) => name.length > 0);

        return { ok: true, models, error: null };
      } catch {
        return {
          ok: false,
          models: [],
          error: "Ollama is offline. Try to launch Ollama.",
        };
      }
    });
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      const mainWindow = this.getAvailableMainWindow();
      if (mainWindow?.activeTab) {
        try {
          return await mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      const mainWindow = this.getAvailableMainWindow();
      if (mainWindow?.activeTab) {
        try {
          return await mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      const mainWindow = this.getAvailableMainWindow();
      if (mainWindow?.activeTab) {
        return mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleDebugEvents(): void {
    // Ping test
    ipcMain.on("ping", () => console.log("pong"));
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    const mainWindow = this.getMainWindow();
    if (!mainWindow) {
      return;
    }

    // Send to topbar
    if (mainWindow.topBar.view.webContents !== sender) {
      mainWindow.topBar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode
      );
    }

    // Send to sidebar
    if (mainWindow.sidebar.view.webContents !== sender) {
      mainWindow.sidebar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode
      );
    }

    // Send to standalone settings window if it exists
    mainWindow.browserSettings.send("dark-mode-updated", isDarkMode);

    // Send to all tabs
    mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  // Clean up event listeners
  public cleanup(): void {
    ipcMain.removeAllListeners("dark-mode-changed");
    ipcMain.removeAllListeners("ping");
  }

  private removeRegisteredHandlers(): void {
    for (const channel of EventManager.HANDLE_CHANNELS) {
      ipcMain.removeHandler(channel);
    }
  }
}
