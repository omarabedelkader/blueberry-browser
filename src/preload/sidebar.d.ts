import { ElectronAPI } from "@electron-toolkit/preload";

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

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface ComputerUseState {
  sessions: Array<{
    id: string;
    goal: string;
    summary: string;
    status: "planning" | "running" | "completed" | "failed";
    createdAt: number;
    currentUrl: string | null;
    screenshot: string | null;
    logs: string[];
    steps: Array<{
      id: string;
      action:
        | "navigate"
        | "click"
        | "type"
        | "extract_text"
        | "wait"
        | "run_script";
      label: string;
      status: "pending" | "running" | "completed" | "failed";
      result?: string;
      url?: string;
      selector?: string;
      text?: string;
      script?: string;
      ms?: number;
    }>;
    generatedScript: {
      goal: string;
      code: string;
      createdAt: number;
    } | null;
  }>;
  activeSessionId: string | null;
  isRunning: boolean;
}

interface SandboxState {
  files: Array<{
    id: string;
    name: string;
    content: string;
    isScoped: boolean;
    createdAt: number;
  }>;
  activeFileId: string | null;
  entryFileId: string | null;
  runs: Array<{
    id: string;
    entryFileId: string | null;
    scopedFileIds: string[];
    status: "idle" | "running" | "completed" | "failed";
    startedAt: number;
    finishedAt: number | null;
    lines: Array<{
      id: string;
      stream: "stdout" | "stderr" | "system" | "event";
      text: string;
    }>;
    notifications: Array<{
      id: string;
      message: string;
      createdAt: number;
    }>;
  }>;
  isRunning: boolean;
}

interface SidebarLayout {
  width: number;
  minWidth: number;
  maxWidth: number;
  isVisible: boolean;
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

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: ChatRequest) => Promise<void>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  removeChatResponseListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;
  getSidebarLayout: () => Promise<SidebarLayout>;
  setSidebarWidth: (width: number) => Promise<number>;
  getAISettings: () => Promise<AISettings>;
  updateAISettings: (settings: Partial<AISettings>) => Promise<AISettings>;
  getAppSettings: () => Promise<AISettings>;
  updateAppSettings: (settings: Partial<AISettings>) => Promise<AISettings>;
  onAISettingsUpdated: (callback: (settings: AISettings) => void) => void;
  removeAISettingsUpdatedListener: () => void;
  onOpenSettings: (callback: () => void) => void;
  removeOpenSettingsListener: () => void;

  // Computer use
  getComputerUseState: () => Promise<ComputerUseState>;
  startComputerUse: (request: { goal: string }) => Promise<ComputerUseState>;
  generateComputerUseScript: (request: {
    goal: string;
  }) => Promise<ComputerUseState>;
  onComputerUseState: (callback: (state: ComputerUseState) => void) => void;
  removeComputerUseStateListener: () => void;

  // Sandbox
  getSandboxState: () => Promise<SandboxState>;
  createSandboxFile: (input: {
    name: string;
    content?: string;
  }) => Promise<SandboxState>;
  updateSandboxFile: (
    fileId: string,
    patch: { name?: string; content?: string; isScoped?: boolean }
  ) => Promise<SandboxState>;
  deleteSandboxFile: (fileId: string) => Promise<SandboxState>;
  setActiveSandboxFile: (fileId: string) => Promise<SandboxState>;
  setSandboxEntryFile: (fileId: string) => Promise<SandboxState>;
  runSandbox: (request?: { entryFileId?: string | null }) => Promise<SandboxState>;
  onSandboxState: (callback: (state: SandboxState) => void) => void;
  removeSandboxStateListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}
