import { ElectronAPI } from "@electron-toolkit/preload";

interface AppSettings {
  provider: "ollama" | "openai" | "anthropic";
  model: string;
  ollamaBaseUrl: string;
  homepage: string;
  searchEngine: "google" | "duckduckgo" | "bing";
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
}

interface SettingsAPI {
  getAppSettings: () => Promise<AppSettings>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  setSidebarWidth: (width: number) => Promise<number>;
  closeBrowserSettings: () => Promise<void>;
  listOllamaModels: () => Promise<{ ok: boolean; models: string[]; error: string | null }>;
  onAppSettingsUpdated: (callback: (settings: AppSettings) => void) => void;
  removeAppSettingsUpdatedListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    settingsAPI: SettingsAPI;
  }
}
