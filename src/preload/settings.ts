import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { subscribeToIpcChannel } from "./ipcSubscription";

interface AppSettings {
  provider: "ollama" | "openai" | "anthropic";
  model: string;
  ollamaBaseUrl: string;
  homepage: string;
  searchEngine: "google" | "duckduckgo" | "bing";
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
  memoryEnabled: boolean;
}

interface UpdateState {
  checking: boolean;
  hasUpdate: boolean;
  dismissed: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  releaseName: string | null;
  publishedAt: string | null;
  checkedAt: number | null;
  error: string | null;
}

const settingsAPI = {
  getAppSettings: () => electronAPI.ipcRenderer.invoke("app-settings-get"),
  updateAppSettings: (settings: Partial<AppSettings>) =>
    electronAPI.ipcRenderer.invoke("app-settings-update", settings),
  setSidebarWidth: (width: number) =>
    electronAPI.ipcRenderer.invoke("sidebar-set-width", width),
  closeBrowserSettings: () =>
    electronAPI.ipcRenderer.invoke("close-browser-settings"),
  listOllamaModels: () => electronAPI.ipcRenderer.invoke("ollama-models-list"),
  getMemories: () => electronAPI.ipcRenderer.invoke("memory-get"),
  deleteMemory: (id: string) =>
    electronAPI.ipcRenderer.invoke("memory-delete", id),
  clearMemories: () => electronAPI.ipcRenderer.invoke("memory-clear"),
  getUpdateState: () => electronAPI.ipcRenderer.invoke("update-state-get"),
  checkForUpdates: () => electronAPI.ipcRenderer.invoke("update-check"),
  dismissUpdate: () => electronAPI.ipcRenderer.invoke("update-dismiss"),
  openReleasePage: () =>
    electronAPI.ipcRenderer.invoke("update-open-release-page"),
  onAppSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    return subscribeToIpcChannel(
      electronAPI.ipcRenderer,
      "app-settings-updated",
      callback,
    );
  },
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    return subscribeToIpcChannel(
      electronAPI.ipcRenderer,
      "update-state-changed",
      callback,
    );
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("settingsAPI", settingsAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore
  window.electron = electronAPI;
  // @ts-ignore
  window.settingsAPI = settingsAPI;
}
