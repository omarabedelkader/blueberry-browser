import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleDashed,
  Code2,
  Cog,
  FileCode2,
  Globe,
  LoaderCircle,
  Play,
  Plus,
  SquareTerminal,
  Terminal,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@common/components/Button";
import { cn } from "@common/lib/utils";

type WorkspaceTab = "computer-use" | "sandbox";
type ProviderOption = AISettings["provider"];
type SearchEngineOption = AISettings["searchEngine"];

const SETTINGS_SCAFFOLD_HEADER = `Available Blueberry sandbox tools:
- notifyUser(message)
- currentPage()
- listScopedFiles()
- readScopedFile(name)
- writeScopedFile(name, content)
- useMcp(name, input)`;

const SANDBOX_ROUTING_PATTERN =
  /\b(code|script|javascript|typescript|python|csv|xlsx|excel|json|file|files|data|dataset|analy[sz]e|transform|parse|sandbox|table)\b/i;

const statusStyles = {
  idle: "bg-zinc-100 text-zinc-800 dark:bg-zinc-700/50 dark:text-zinc-200",
  planning: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  running: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
  completed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
  failed: "bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200",
  pending: "bg-zinc-100 text-zinc-800 dark:bg-zinc-700/50 dark:text-zinc-200",
} as const;

const lineStyles = {
  stdout: "text-foreground",
  stderr: "text-rose-500 dark:text-rose-300",
  system: "text-sky-600 dark:text-sky-300",
  event: "text-emerald-600 dark:text-emerald-300",
} as const;

const formatTime = (value: number | null | undefined) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
};

const formatDuration = (start: number, end: number | null) => {
  if (!end) {
    return "running";
  }

  const seconds = Math.max(0, Math.round((end - start) / 100) / 10);
  return `${seconds}s`;
};

const StatusPill: React.FC<{ status: keyof typeof statusStyles; label?: string }> = ({
  status,
  label,
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
      statusStyles[status]
    )}
  >
    {label ?? status.replace("_", " ")}
  </span>
);

const SectionTitle: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl bg-secondary text-foreground">
      {icon}
    </div>
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  </div>
);

const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="rounded-3xl border border-dashed border-border bg-card/80 p-6 text-center">
    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
      {icon}
    </div>
    <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
  </div>
);

const SettingsPanel: React.FC<{
  settings: AISettings | null;
  onChange: (patch: Partial<AISettings>) => Promise<void>;
}> = ({ settings, onChange }) => {
  const [draftModel, setDraftModel] = useState(settings?.model ?? "");
  const [draftBaseUrl, setDraftBaseUrl] = useState(settings?.ollamaBaseUrl ?? "");

  useEffect(() => {
    setDraftModel(settings?.model ?? "");
    setDraftBaseUrl(settings?.ollamaBaseUrl ?? "");
  }, [settings?.model, settings?.ollamaBaseUrl]);

  const provider = settings?.provider ?? "ollama";

  return (
    <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
      <SectionTitle
        icon={<Cog className="size-4" />}
        title="Browser Settings"
        description="Manage AI provider/model selection and browser behavior from one settings panel."
      />

      <div className="mt-4 space-y-3">
        <div className="rounded-[22px] bg-secondary/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AI
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Provider
              </label>
              <select
                value={provider}
                onChange={(event) =>
                  void onChange({ provider: event.target.value as ProviderOption })
                }
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="ollama">Ollama (local)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Model
              </label>
              <input
                value={draftModel}
                onChange={(event) => setDraftModel(event.target.value)}
                onBlur={() => void onChange({ model: draftModel })}
                placeholder={
                  provider === "ollama"
                    ? "Paste a model name from `ollama list`"
                    : provider === "openai"
                      ? "gpt-4o-mini"
                      : "claude-3-5-sonnet-20241022"
                }
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>

            {provider === "ollama" && (
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Ollama Base URL
                </label>
                <input
                  value={draftBaseUrl}
                  onChange={(event) => setDraftBaseUrl(event.target.value)}
                  onBlur={() => void onChange({ ollamaBaseUrl: draftBaseUrl })}
                  placeholder="http://127.0.0.1:11434/v1"
                  className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
              </div>
            )}

            <p className="text-xs leading-5 text-muted-foreground">
              Run `ollama list` on this computer, then paste one of those installed
              model names here. Blueberry should not guess which Ollama model you have
              locally.
            </p>
          </div>
        </div>

        <div className="rounded-[22px] bg-secondary/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Browser
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Homepage / New Tab URL
              </label>
              <input
                defaultValue={settings?.homepage ?? ""}
                onBlur={(event) => void onChange({ homepage: event.target.value })}
                placeholder="https://www.google.com"
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Search Engine
              </label>
              <select
                value={settings?.searchEngine ?? "google"}
                onChange={(event) =>
                  void onChange({
                    searchEngine: event.target.value as SearchEngineOption,
                  })
                }
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="google">Google</option>
                <option value="duckduckgo">DuckDuckGo</option>
                <option value="bing">Bing</option>
              </select>
            </div>

            <label className="inline-flex items-center gap-2 rounded-2xl bg-background px-3 py-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={settings?.autoRouteToSandbox ?? true}
                onChange={(event) =>
                  void onChange({ autoRouteToSandbox: event.target.checked })
                }
              />
              Automatically switch to sandbox for code, file, and data tasks
            </label>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Browser Panel Width
              </label>
              <input
                type="range"
                min={320}
                max={720}
                value={settings?.sidebarWidth ?? 400}
                onChange={(event) =>
                  void onChange({ sidebarWidth: Number(event.target.value) })
                }
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {settings?.sidebarWidth ?? 400}px
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ComputerUsePanel: React.FC<{
  state: ComputerUseState | null;
}> = ({ state }) => {
  const [goal, setGoal] = useState(
    "Inspect the current page, explain the workflow, and extract the most relevant information."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeSession =
    state?.sessions.find((session) => session.id === state.activeSessionId) ??
    state?.sessions[0] ??
    null;

  const startRun = async () => {
    if (!goal.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await window.sidebarAPI.startComputerUse({ goal: goal.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateScript = async () => {
    if (!goal.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await window.sidebarAPI.generateComputerUseScript({ goal: goal.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
        <SectionTitle
          icon={<Bot className="size-4" />}
          title="Gemini Computer Use"
          description="Run a browser-side operator that plans actions, executes them on the active tab, and streams every observation back into Blueberry."
        />

        <div className="mt-4 rounded-[24px] bg-secondary/70 p-3">
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={5}
            className="min-h-[120px] w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Describe what the operator should do on the current website..."
          />
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={startRun} disabled={isSubmitting || !!state?.isRunning}>
              {state?.isRunning ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Run Agent
            </Button>
            <Button
              variant="secondary"
              onClick={generateScript}
              disabled={isSubmitting}
            >
              <WandSparkles className="size-4" />
              Generate Script
            </Button>
          </div>
        </div>
      </div>

      {activeSession ? (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Live Session
                </p>
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  {activeSession.goal}
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {activeSession.summary}
                </p>
              </div>
              <StatusPill status={activeSession.status} />
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-border bg-secondary/50">
              {activeSession.screenshot ? (
                <img
                  src={activeSession.screenshot}
                  alt="Active tab preview"
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-xs text-muted-foreground">
                  No page preview yet
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="size-3.5" />
              <span className="truncate">{activeSession.currentUrl ?? "No active URL"}</span>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Execution Timeline</h3>
              <span className="text-xs text-muted-foreground">
                {formatTime(activeSession.createdAt)}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {activeSession.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-[22px] border border-border bg-secondary/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {step.status === "completed" ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : step.status === "failed" ? (
                        <XCircle className="size-4 text-rose-500" />
                      ) : step.status === "running" ? (
                        <LoaderCircle className="size-4 animate-spin text-sky-500" />
                      ) : (
                        <CircleDashed className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Step {index + 1} · {step.action.replace("_", " ")}
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {step.label}
                          </p>
                        </div>
                        <StatusPill status={step.status} />
                      </div>
                      {step.result && (
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                          {step.result}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Operator Feed</h3>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-[22px] bg-secondary/50 p-3">
              {activeSession.logs.map((log, index) => (
                <p key={`${log}-${index}`} className="text-xs leading-5 text-muted-foreground">
                  {log}
                </p>
              ))}
            </div>
          </div>

          {activeSession.generatedScript && (
            <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Generated Site Script</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeSession.generatedScript.goal}
                  </p>
                </div>
                <StatusPill status="completed" label="ready" />
              </div>

              <pre className="mt-3 overflow-x-auto rounded-[22px] bg-[#111318] p-4 text-xs leading-6 text-zinc-100">
                <code>{activeSession.generatedScript.code}</code>
              </pre>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Bot className="size-5" />}
          title="No operator session yet"
          description="Run the active tab through Blueberry's computer-use pipeline to get a real-time action plan, step execution, and a browser script draft."
        />
      )}
    </div>
  );
};

const TaskRouterPanel: React.FC<{
  settings: AISettings | null;
  sandboxState: SandboxState | null;
  onSwitchTab: (tab: WorkspaceTab) => void;
}> = ({ settings, sandboxState, onSwitchTab }) => {
  const [task, setTask] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const ensureSandboxTaskFile = async (goal: string) => {
    const escapedGoal = goal.replace(/"/g, '\\"');
    const template = `import {
  notifyUser,
  currentPage,
  listScopedFiles,
  readScopedFile,
  writeScopedFile,
  useMcp
} from "blueberry";

/*
Task:
${goal}

${SETTINGS_SCAFFOLD_HEADER}
*/

const page = await currentPage();
await notifyUser("Sandbox prepared for task: ${escapedGoal}");

console.log("Current page:", page.url);
console.log("Page title:", page.title);
console.log("Scoped files:", await listScopedFiles());

// Implement the requested task here.
`;

    let targetFileId = sandboxState?.entryFileId ?? sandboxState?.activeFileId ?? null;
    if (!targetFileId) {
      const nextState = await window.sidebarAPI.createSandboxFile({
        name: "task-runner.mjs",
        content: template,
      });
      targetFileId = nextState.entryFileId ?? nextState.activeFileId;
    } else {
      await window.sidebarAPI.updateSandboxFile(targetFileId, {
        content: template,
        isScoped: true,
      });
    }

    if (targetFileId) {
      await window.sidebarAPI.setActiveSandboxFile(targetFileId);
      await window.sidebarAPI.setSandboxEntryFile(targetFileId);
    }
  };

  const runAuto = async () => {
    if (!task.trim() || isRunning) {
      return;
    }

    setIsRunning(true);
    try {
      const trimmedTask = task.trim();
      const shouldUseSandbox =
        (settings?.autoRouteToSandbox ?? true) &&
        SANDBOX_ROUTING_PATTERN.test(trimmedTask);

      if (shouldUseSandbox) {
        onSwitchTab("sandbox");
        await ensureSandboxTaskFile(trimmedTask);
      } else {
        onSwitchTab("computer-use");
        await window.sidebarAPI.startComputerUse({ goal: trimmedTask });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const sendToSandbox = async () => {
    if (!task.trim() || isRunning) {
      return;
    }

    setIsRunning(true);
    try {
      onSwitchTab("sandbox");
      await ensureSandboxTaskFile(task.trim());
    } finally {
      setIsRunning(false);
    }
  };

  const runBrowserAgent = async () => {
    if (!task.trim() || isRunning) {
      return;
    }

    setIsRunning(true);
    try {
      onSwitchTab("computer-use");
      await window.sidebarAPI.startComputerUse({ goal: task.trim() });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mb-4 rounded-[28px] border border-border bg-card p-4 shadow-sm">
      <SectionTitle
        icon={<Bot className="size-4" />}
        title="Agent Task Router"
        description="Describe the job once. Blueberry can keep it in browser mode or switch automatically into the sandbox for code, file, and data work."
      />

      <div className="mt-4 rounded-[24px] bg-secondary/60 p-3">
        <textarea
          value={task}
          onChange={(event) => setTask(event.target.value)}
          rows={4}
          className="min-h-[100px] w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Analyze files, write code, scrape a workflow, or automate the current site..."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={runAuto} disabled={isRunning || !task.trim()}>
            {isRunning ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Auto Route
          </Button>
          <Button
            variant="secondary"
            onClick={runBrowserAgent}
            disabled={isRunning || !task.trim()}
          >
            <Bot className="size-4" />
            Browser Agent
          </Button>
          <Button
            variant="secondary"
            onClick={sendToSandbox}
            disabled={isRunning || !task.trim()}
          >
            <SquareTerminal className="size-4" />
            Sandbox
          </Button>
        </div>
      </div>
    </div>
  );
};

const SandboxPanel: React.FC<{
  state: SandboxState | null;
}> = ({ state }) => {
  const [editorValue, setEditorValue] = useState("");
  const [draftFileName, setDraftFileName] = useState("");
  const syncTimer = useRef<number | null>(null);

  const activeFile =
    state?.files.find((file) => file.id === state.activeFileId) ?? state?.files[0] ?? null;
  const latestRun = state?.runs[0] ?? null;

  useEffect(() => {
    setEditorValue(activeFile?.content ?? "");
    setDraftFileName(activeFile?.name ?? "");
  }, [activeFile?.id, activeFile?.content, activeFile?.name]);

  useEffect(() => {
    if (!activeFile) {
      return;
    }

    if (editorValue === activeFile.content) {
      return;
    }

    if (syncTimer.current) {
      window.clearTimeout(syncTimer.current);
    }

    syncTimer.current = window.setTimeout(() => {
      window.sidebarAPI.updateSandboxFile(activeFile.id, { content: editorValue });
    }, 180);

    return () => {
      if (syncTimer.current) {
        window.clearTimeout(syncTimer.current);
      }
    };
  }, [activeFile, editorValue]);

  const createFile = async () => {
    const nextIndex = (state?.files.length ?? 0) + 1;
    await window.sidebarAPI.createSandboxFile({
      name: `snippet-${nextIndex}.mjs`,
      content: `console.log("Sandbox file ${nextIndex}");\n`,
    });
  };

  const runSandbox = async () => {
    await window.sidebarAPI.runSandbox({
      entryFileId: state?.entryFileId ?? activeFile?.id ?? null,
    });
  };

  const renameFile = async (value: string) => {
    setDraftFileName(value);
    if (!activeFile) {
      return;
    }
    await window.sidebarAPI.updateSandboxFile(activeFile.id, { name: value });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
        <SectionTitle
          icon={<SquareTerminal className="size-4" />}
          title="Code Execution Sandbox"
          description='Run local JavaScript in an isolated workspace scoped only to the files you choose. The built-in `blueberry` package exposes helpers like `notifyUser()`, `useMcp()`, and `currentPage()`.'
        />

        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" onClick={createFile}>
            <Plus className="size-4" />
            New File
          </Button>
          <Button onClick={runSandbox} disabled={!state || state.isRunning}>
            {state?.isRunning ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Run Scoped Code
          </Button>
        </div>
      </div>

      <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Scoped Files</h3>
          <span className="text-xs text-muted-foreground">
            {state?.files.filter((file) => file.isScoped).length ?? 0} in scope
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {state?.files.map((file) => {
            const isActive = file.id === state.activeFileId;
            const isEntry = file.id === state.entryFileId;

            return (
              <button
                key={file.id}
                onClick={() => window.sidebarAPI.setActiveSandboxFile(file.id)}
                className={cn(
                  "flex w-full items-start justify-between rounded-[20px] border px-3 py-3 text-left transition-colors",
                  isActive
                    ? "border-foreground/20 bg-secondary"
                    : "border-border bg-background hover:bg-secondary/60"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="size-4 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {file.isScoped ? "Scoped into the run" : "Excluded from the next run"}
                  </p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-2">
                  {isEntry && <StatusPill status="completed" label="entry" />}
                  <StatusPill status={file.isScoped ? "running" : "pending"} label={file.isScoped ? "scoped" : "excluded"} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeFile ? (
        <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Editor</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Entry files execute with Node and can import from `blueberry`.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => window.sidebarAPI.deleteSandboxFile(activeFile.id)}
              disabled={(state?.files.length ?? 0) <= 1}
              title="Delete file"
            >
              <XCircle className="size-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={draftFileName}
              onChange={(event) => void renameFile(event.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            />

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <label className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
                <input
                  type="checkbox"
                  checked={activeFile.isScoped}
                  onChange={(event) =>
                    void window.sidebarAPI.updateSandboxFile(activeFile.id, {
                      isScoped: event.target.checked,
                    })
                  }
                />
                Include in scope
              </label>
              <label className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
                <input
                  type="radio"
                  name="entry-file"
                  checked={state?.entryFileId === activeFile.id}
                  onChange={() => void window.sidebarAPI.setSandboxEntryFile(activeFile.id)}
                />
                Run as entry
              </label>
            </div>

            <textarea
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
              spellCheck={false}
              className="min-h-[260px] w-full resize-y rounded-[24px] border border-border bg-[#111318] p-4 font-mono text-xs leading-6 text-zinc-100 outline-none"
            />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Code2 className="size-5" />}
          title="No sandbox file selected"
          description="Create a file, scope it into the run, and execute it locally with Blueberry's helper package."
        />
      )}

      <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Latest Run</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Streamed output, notifications, and runtime events.
            </p>
          </div>
          {latestRun ? (
            <StatusPill status={latestRun.status} label={latestRun.status} />
          ) : (
            <StatusPill status="idle" label="idle" />
          )}
        </div>

        {latestRun ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[22px] bg-secondary/50 p-3 text-xs text-muted-foreground">
              Started {formatTime(latestRun.startedAt)}
              {latestRun.finishedAt && (
                <span> · {formatDuration(latestRun.startedAt, latestRun.finishedAt)}</span>
              )}
            </div>

            {latestRun.notifications.length > 0 && (
              <div className="space-y-2">
                {latestRun.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-200"
                  >
                    {notification.message}
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[24px] bg-[#111318] p-4">
              <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
                <Terminal className="size-4" />
                <span>Sandbox output</span>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto font-mono text-xs leading-6">
                {latestRun.lines.map((line) => (
                  <p key={line.id} className={lineStyles[line.stream]}>
                    {line.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={<SquareTerminal className="size-5" />}
              title="No sandbox run yet"
              description="Execute a scoped entry file to create an isolated workspace and stream runtime output back into Blueberry."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const Chat: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("computer-use");
  const [computerUseState, setComputerUseState] = useState<ComputerUseState | null>(null);
  const [sandboxState, setSandboxState] = useState<SandboxState | null>(null);
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [layout, setLayout] = useState<SidebarLayout | null>(null);
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const dragState = useRef<{
    startMouseX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [computerUse, sandbox, activeBrowserTab, sidebarLayout, settings] = await Promise.all([
        window.sidebarAPI.getComputerUseState(),
        window.sidebarAPI.getSandboxState(),
        window.sidebarAPI.getActiveTabInfo(),
        window.sidebarAPI.getSidebarLayout(),
        window.sidebarAPI.getAISettings(),
      ]);

      setComputerUseState(computerUse);
      setSandboxState(sandbox);
      setTabInfo(activeBrowserTab);
      setLayout(sidebarLayout);
      setAISettings(settings);
    };

    void load();

    const interval = window.setInterval(() => {
      void window.sidebarAPI.getActiveTabInfo().then(setTabInfo);
    }, 2500);

    window.sidebarAPI.onComputerUseState((state) => setComputerUseState(state));
    window.sidebarAPI.onSandboxState((state) => setSandboxState(state));
    window.sidebarAPI.onAISettingsUpdated((settings) => setAISettings(settings));

    return () => {
      window.clearInterval(interval);
      window.sidebarAPI.removeComputerUseStateListener();
      window.sidebarAPI.removeSandboxStateListener();
      window.sidebarAPI.removeAISettingsUpdatedListener();
    };
  }, []);

  const updateAISettings = async (patch: Partial<AISettings>) => {
    const next = await window.sidebarAPI.updateAppSettings(patch);
    setAISettings(next);
    if (typeof patch.sidebarWidth === "number") {
      await window.sidebarAPI.setSidebarWidth(patch.sidebarWidth);
    }
    setLayout((previous) =>
      previous && typeof patch.sidebarWidth === "number"
        ? { ...previous, width: patch.sidebarWidth }
        : previous
    );
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const currentDrag = dragState.current;
      if (!currentDrag) {
        return;
      }

      const rawWidth = currentDrag.startWidth + (currentDrag.startMouseX - event.clientX);
      const nextWidth = Math.max(
        currentDrag.minWidth,
        Math.min(currentDrag.maxWidth, Math.round(rawWidth))
      );

      setLayout((previous) =>
        previous
          ? {
              ...previous,
              width: nextWidth,
            }
          : previous
      );

      void window.sidebarAPI.setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!layout) {
      return;
    }

    dragState.current = {
      startMouseX: event.clientX,
      startWidth: layout.width,
      minWidth: layout.minWidth,
      maxWidth: layout.maxWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="relative flex h-full flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,rgba(9,13,20,0.98),rgba(10,15,23,0.98))]">
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 z-20 h-full w-2 cursor-col-resize bg-transparent"
        title="Resize AI panel"
      >
        <div className="ml-[1px] h-full w-px bg-border/70" />
      </div>

      <div className="border-b border-border/80 px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Blueberry Labs
            </p>
            <h1 className="mt-2 text-lg font-semibold text-foreground">
              Browser Workspace
            </h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Browser controls, automation, and scoped code execution in one place.
            </p>
          </div>
          <div className="max-w-[180px] rounded-[22px] border border-border bg-card/90 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Active Tab
            </p>
            <p className="mt-1 truncate text-xs font-medium text-foreground">
              {tabInfo?.title ?? "Loading..."}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {tabInfo?.url ?? "No tab selected"}
            </p>
            {layout && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Panel {layout.width}px
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-[24px] bg-secondary/60 p-1">
          <button
            onClick={() => setActiveTab("computer-use")}
            className={cn(
              "rounded-[18px] px-3 py-3 text-sm font-medium transition-colors",
              activeTab === "computer-use"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            Gemini Computer Use
          </button>
          <button
            onClick={() => setActiveTab("sandbox")}
            className={cn(
              "rounded-[18px] px-3 py-3 text-sm font-medium transition-colors",
              activeTab === "sandbox"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            Code Sandbox
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <TaskRouterPanel
          settings={aiSettings}
          sandboxState={sandboxState}
          onSwitchTab={setActiveTab}
        />
        {activeTab === "computer-use" ? (
          <ComputerUsePanel state={computerUseState} />
        ) : (
          <SandboxPanel state={sandboxState} />
        )}
      </div>

    </div>
  );
};
