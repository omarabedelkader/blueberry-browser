import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

interface AppSettings {
  provider: "ollama" | "openai" | "anthropic";
  model: string;
  ollamaBaseUrl: string;
  homepage: string;
  searchEngine: "google" | "duckduckgo" | "bing";
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
}

const settingsAPI = {
  getAppSettings: () => electronAPI.ipcRenderer.invoke("app-settings-get"),
  updateAppSettings: (settings: Partial<AppSettings>) =>
    electronAPI.ipcRenderer.invoke("app-settings-update", settings),
  setSidebarWidth: (width: number) =>
    electronAPI.ipcRenderer.invoke("sidebar-set-width", width),
  closeBrowserSettings: () =>
    electronAPI.ipcRenderer.invoke("close-browser-settings"),
  listOllamaModels: () =>
    electronAPI.ipcRenderer.invoke("ollama-models-list"),
  onAppSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    electronAPI.ipcRenderer.on("app-settings-updated", (_, settings) =>
      callback(settings)
    );
  },
  removeAppSettingsUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("app-settings-updated");
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
