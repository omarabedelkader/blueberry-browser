import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { ToolBarButton } from "../components/ToolBarButton";
import { Favicon } from "../components/Favicon";
import { cn } from "@common/lib/utils";

const INTERNAL_WELCOME_URL = "blueberry://welcome";

export const AddressBar: React.FC = () => {
  const { activeTab, navigateToUrl, goBack, goForward, reload, isLoading } =
    useBrowser();
  const [url, setUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchEngine, setSearchEngine] = useState<
    "google" | "duckduckgo" | "bing"
  >("google");
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const loadState = async () => {
      try {
        const [settings, updateState] = await Promise.all([
          window.topBarAPI.getAppSettings(),
          window.topBarAPI.getUpdateState(),
        ]);
        setSearchEngine(settings.searchEngine);
        setHasUpdate(updateState.hasUpdate && !updateState.dismissed);
      } catch (error) {
        console.error("Failed to load top bar state:", error);
      }
    };

    void loadState();
    window.topBarAPI.onAppSettingsUpdated((settings) =>
      setSearchEngine(settings.searchEngine),
    );
    window.topBarAPI.onUpdateStateChanged((state) =>
      setHasUpdate(state.hasUpdate && !state.dismissed),
    );

    return () => {
      window.topBarAPI.removeAppSettingsUpdatedListener();
      window.topBarAPI.removeUpdateStateChangedListener();
    };
  }, []);

  // Update URL when active tab changes
  useEffect(() => {
    if (activeTab && !isEditing) {
      setUrl(activeTab.url || "");
    }
  }, [activeTab, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    let finalUrl = url.trim();

    // Add protocol if missing
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      // Check if it looks like a domain
      if (finalUrl.includes(".") && !finalUrl.includes(" ")) {
        finalUrl = `https://${finalUrl}`;
      } else {
        const encoded = encodeURIComponent(finalUrl);
        if (searchEngine === "duckduckgo") {
          finalUrl = `https://duckduckgo.com/?q=${encoded}`;
        } else if (searchEngine === "bing") {
          finalUrl = `https://www.bing.com/search?q=${encoded}`;
        } else {
          finalUrl = `https://www.google.com/search?q=${encoded}`;
        }
      }
    }

    navigateToUrl(finalUrl);
    setIsEditing(false);
    setIsFocused(false);
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleFocus = () => {
    setIsEditing(true);
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setIsFocused(false);
    // Reset to current tab URL if editing was cancelled
    if (activeTab) {
      setUrl(activeTab.url || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setIsFocused(false);
      if (activeTab) {
        setUrl(activeTab.url || "");
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  const canGoBack = Boolean(activeTab?.canGoBack);
  const canGoForward = Boolean(activeTab?.canGoForward);

  // Extract domain and title for display
  const getDomain = () => {
    if (!activeTab?.url) return "";
    if (activeTab.url === INTERNAL_WELCOME_URL) return "BlueBerry Browser";
    try {
      const urlObj = new URL(activeTab.url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return activeTab.url;
    }
  };

  const getPath = () => {
    if (!activeTab?.url) return "";
    if (activeTab.url === INTERNAL_WELCOME_URL) return "";
    try {
      const urlObj = new URL(activeTab.url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      return "";
    }
  };

  const getFavicon = () => {
    if (!activeTab?.url) return null;
    if (activeTab.url === INTERNAL_WELCOME_URL) return null;
    try {
      const domain = new URL(activeTab.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    // Send IPC event to toggle sidebar
    if (window.topBarAPI) {
      window.topBarAPI.toggleSidebar();
    }
  };

  const openSettings = () => {
    void window.topBarAPI.openBrowserSettings();
  };

  return (
    <>
      {/* Navigation Controls */}
      <div className="flex gap-1.5 app-region-no-drag">
        <ToolBarButton
          Icon={ArrowLeft}
          onClick={goBack}
          active={canGoBack && !isLoading}
        />
        <ToolBarButton
          Icon={ArrowRight}
          onClick={goForward}
          active={canGoForward && !isLoading}
        />
        <ToolBarButton
          onClick={reload}
          active={activeTab !== null && !isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <RefreshCw className="size-4.5" />
          )}
        </ToolBarButton>
      </div>

      {/* Address Bar */}
      {isFocused ? (
        // Expanded State
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 max-w-full">
          <div className="h-8 rounded-md border border-border bg-card px-3 shadow-sm transition-colors">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-full w-full bg-transparent text-[0.8rem] text-foreground outline-none"
              placeholder={
                activeTab ? "Enter URL or search term" : "No active tab"
              }
              disabled={!activeTab}
              spellCheck={false}
              autoFocus
            />
          </div>
        </form>
      ) : (
        // Collapsed State
        <div
          onClick={handleFocus}
          className={cn(
            "flex-1 px-3 h-8 rounded-md border border-border cursor-text group/address-bar",
            "bg-card text-muted-foreground app-region-no-drag shadow-sm",
            "hover:bg-card",
            "transition-colors duration-200",
          )}
        >
          <div className="flex h-full items-center">
            {/* Favicon */}
            <div className="size-4 mr-2">
              <Favicon src={getFavicon()} />
            </div>

            {/* URL Display */}
            <div className="text-[0.8rem] leading-normal truncate flex-1">
              {activeTab ? (
                <>
                  <span className="text-foreground dark:text-foreground">
                    {getDomain()}
                  </span>
                  <span className="group-hover/address-bar:hidden text-muted-foreground/60">
                    {activeTab.title && ` / ${activeTab.title}`}
                  </span>
                  <span className="group-hover/address-bar:inline hidden text-muted-foreground/60">
                    {getPath()}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No active tab</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions Menu */}
      <div className="flex items-center gap-1 app-region-no-drag">
        <div className="relative">
          <ToolBarButton Icon={Settings} onClick={openSettings} />
          {hasUpdate && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500" />
          )}
        </div>
        <ToolBarButton
          Icon={isSidebarOpen ? PanelLeftClose : PanelLeft}
          onClick={toggleSidebar}
          toggled={isSidebarOpen}
        />
      </div>
    </>
  );
};
