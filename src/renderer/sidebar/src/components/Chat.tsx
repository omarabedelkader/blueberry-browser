import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, LoaderCircle, Plus, Send } from "lucide-react";
import { Button } from "@common/components/Button";
import { cn } from "@common/lib/utils";

type SidebarLayout = Awaited<ReturnType<typeof window.sidebarAPI.getSidebarLayout>>;
type TabInfo = Awaited<ReturnType<typeof window.sidebarAPI.getActiveTabInfo>>;
type ChatHistoryMessage = Awaited<ReturnType<typeof window.sidebarAPI.getMessages>>[number];

const extractMessageText = (message: ChatHistoryMessage): string => {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .flatMap((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return [];
      })
      .join("\n")
      .trim();
  }

  return "";
};

const hasScreenshot = (message: ChatHistoryMessage): boolean =>
  Array.isArray(message.content) &&
  message.content.some(
    (part) => typeof part === "object" && part !== null && "type" in part && part.type === "image"
  );

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [tabInfo, setTabInfo] = useState<TabInfo>(null);
  const [layout, setLayout] = useState<SidebarLayout | null>(null);
  const [isSending, setIsSending] = useState(false);
  const dragState = useRef<{
    startMouseX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const [history, activeBrowserTab, sidebarLayout] = await Promise.all([
        window.sidebarAPI.getMessages(),
        window.sidebarAPI.getActiveTabInfo(),
        window.sidebarAPI.getSidebarLayout(),
      ]);

      setMessages(history);
      setTabInfo(activeBrowserTab);
      setLayout(sidebarLayout);
    };

    void load();

    const interval = window.setInterval(() => {
      void window.sidebarAPI.getActiveTabInfo().then(setTabInfo);
    }, 2500);

    window.sidebarAPI.onMessagesUpdated((history) => {
      setMessages(history as ChatHistoryMessage[]);
      setIsSending(false);
    });

    window.sidebarAPI.onChatResponse(() => {
      setIsSending(false);
    });

    return () => {
      window.clearInterval(interval);
      window.sidebarAPI.removeMessagesUpdatedListener();
      window.sidebarAPI.removeChatResponseListener();
    };
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages]);

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

      setLayout((previous) => (previous ? { ...previous, width: nextWidth } : previous));
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

  const suggestion = useMemo(
    () =>
      tabInfo?.title
        ? `Summarize this page and tell me what matters most about "${tabInfo.title}".`
        : "Summarize the current page and explain the main points.",
    [tabInfo?.title]
  );

  const sendMessage = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) {
      return;
    }

    setDraft("");
    setIsSending(true);

    try {
      await window.sidebarAPI.sendChatMessage({
        message: trimmedMessage,
        messageId: crypto.randomUUID(),
      });
    } catch {
      setIsSending(false);
    }
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

      <div className="border-b border-border/80 px-4 py-3">
        <p className="truncate text-xs text-muted-foreground">
          Active tab: <span className="font-medium text-foreground">{tabInfo?.title ?? "Loading..."}</span>
        </p>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((message, index) => {
              const text = extractMessageText(message);
              const isUser = message.role === "user";

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={cn("flex", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[92%] rounded-[24px] px-4 py-3 shadow-sm",
                      isUser
                        ? "bg-foreground text-background"
                        : "border border-border bg-card text-foreground"
                    )}
                  >
                    <p
                      className={cn(
                        "text-[11px] uppercase tracking-[0.18em]",
                        isUser ? "text-background/70" : "text-muted-foreground"
                      )}
                    >
                      {isUser ? "You" : "Agent"}
                    </p>
                    {hasScreenshot(message) && (
                      <p
                        className={cn(
                          "mt-2 text-xs",
                          isUser ? "text-background/80" : "text-muted-foreground"
                        )}
                      >
                        Screenshot included from the current page.
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {text || (isUser ? "Sent page context." : "Thinking...")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-border bg-card/80 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Bot className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">Start a chat</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ask a question about the current website. The agent will include live page
              context and a screenshot automatically.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border/80 px-4 py-4">
        <div className="rounded-[28px] border border-border bg-card p-3 shadow-sm">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void sendMessage(draft);
              }
            }}
            rows={4}
            className="min-h-[112px] w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Ask about the current page..."
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDraft(suggestion)}
              title="Insert page summary prompt"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="icon"
              onClick={() => void sendMessage(draft)}
              disabled={!draft.trim() || isSending}
              title="Send"
            >
              {isSending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
