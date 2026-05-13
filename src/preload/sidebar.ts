import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  context: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface ComputerUseRequest {
  goal: string;
}

interface SandboxFileInput {
  name: string;
  content?: string;
}

interface AISettings {
  provider: "ollama" | "openai" | "anthropic";
  model: string;
  ollamaBaseUrl: string;
  homepage: string;
  searchEngine: "google" | "duckduckgo" | "bing";
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
}

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) =>
    electronAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: () => electronAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  getMessages: () => electronAPI.ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.on("chat-response", (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    electronAPI.ipcRenderer.on("chat-messages-updated", (_, messages) =>
      callback(messages)
    );
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Page content access
  getPageContent: () => electronAPI.ipcRenderer.invoke("get-page-content"),
  getPageText: () => electronAPI.ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: () => electronAPI.ipcRenderer.invoke("get-current-url"),

  // Tab information
  getActiveTabInfo: () => electronAPI.ipcRenderer.invoke("get-active-tab-info"),
  getSidebarLayout: () => electronAPI.ipcRenderer.invoke("sidebar-get-layout"),
  setSidebarWidth: (width: number) =>
    electronAPI.ipcRenderer.invoke("sidebar-set-width", width),
  getAISettings: () => electronAPI.ipcRenderer.invoke("ai-settings-get"),
  updateAISettings: (settings: Partial<AISettings>) =>
    electronAPI.ipcRenderer.invoke("ai-settings-update", settings),
  getAppSettings: () => electronAPI.ipcRenderer.invoke("app-settings-get"),
  updateAppSettings: (settings: Partial<AISettings>) =>
    electronAPI.ipcRenderer.invoke("app-settings-update", settings),
  onAISettingsUpdated: (callback: (settings: AISettings) => void) => {
    electronAPI.ipcRenderer.on("ai-settings-updated", (_, settings) =>
      callback(settings)
    );
  },
  removeAISettingsUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("ai-settings-updated");
  },
  onOpenSettings: (callback: () => void) => {
    electronAPI.ipcRenderer.on("sidebar-open-settings", () => callback());
  },
  removeOpenSettingsListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("sidebar-open-settings");
  },

  // Computer use
  getComputerUseState: () =>
    electronAPI.ipcRenderer.invoke("computer-use-get-state"),
  startComputerUse: (request: ComputerUseRequest) =>
    electronAPI.ipcRenderer.invoke("computer-use-start", request),
  generateComputerUseScript: (request: ComputerUseRequest) =>
    electronAPI.ipcRenderer.invoke("computer-use-generate-script", request),
  onComputerUseState: (callback: (state: unknown) => void) => {
    electronAPI.ipcRenderer.on("computer-use-state", (_, state) =>
      callback(state)
    );
  },
  removeComputerUseStateListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("computer-use-state");
  },

  // Sandbox
  getSandboxState: () => electronAPI.ipcRenderer.invoke("sandbox-get-state"),
  createSandboxFile: (input: SandboxFileInput) =>
    electronAPI.ipcRenderer.invoke("sandbox-create-file", input),
  updateSandboxFile: (
    fileId: string,
    patch: { name?: string; content?: string; isScoped?: boolean }
  ) => electronAPI.ipcRenderer.invoke("sandbox-update-file", fileId, patch),
  deleteSandboxFile: (fileId: string) =>
    electronAPI.ipcRenderer.invoke("sandbox-delete-file", fileId),
  setActiveSandboxFile: (fileId: string) =>
    electronAPI.ipcRenderer.invoke("sandbox-set-active-file", fileId),
  setSandboxEntryFile: (fileId: string) =>
    electronAPI.ipcRenderer.invoke("sandbox-set-entry-file", fileId),
  runSandbox: (request?: { entryFileId?: string | null }) =>
    electronAPI.ipcRenderer.invoke("sandbox-run", request),
  onSandboxState: (callback: (state: unknown) => void) => {
    electronAPI.ipcRenderer.on("sandbox-state", (_, state) => callback(state));
  },
  removeSandboxStateListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("sandbox-state");
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}
