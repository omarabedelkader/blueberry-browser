import { ElectronAPI } from "@electron-toolkit/preload";

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

interface MemoryEntry {
  id: string;
  content: string;
  category: "preference" | "profile" | "workflow" | "instruction";
  createdAt: number;
  updatedAt: number;
}

interface SettingsAPI {
  getAppSettings: () => Promise<AppSettings>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  setSidebarWidth: (width: number) => Promise<number>;
  closeBrowserSettings: () => Promise<void>;
  listOllamaModels: () => Promise<{ ok: boolean; models: string[]; error: string | null }>;
  getMemories: () => Promise<MemoryEntry[]>;
  deleteMemory: (id: string) => Promise<MemoryEntry[]>;
  clearMemories: () => Promise<MemoryEntry[]>;
  onAppSettingsUpdated: (callback: (settings: AppSettings) => void) => void;
  removeAppSettingsUpdatedListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    settingsAPI: SettingsAPI;
  }
}
