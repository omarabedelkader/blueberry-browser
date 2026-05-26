import { app, dialog, shell } from "electron";
import { logger } from "./Logger";
import type { Window } from "./Window";

const GITHUB_REMOTE_URL =
  "https://github.com/omarabedelkader/blueberry-browser.git";
const RELEASES_URL =
  "https://github.com/omarabedelkader/blueberry-browser/releases/latest";

export interface UpdateState {
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

type GitHubRelease = {
  html_url?: string;
  name?: string;
  published_at?: string;
  tag_name?: string;
};

type UpdateStateListener = (state: UpdateState) => void;

export class UpdateManager {
  private static instance: UpdateManager | null = null;
  private state: UpdateState = {
    checking: false,
    hasUpdate: false,
    dismissed: false,
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseUrl: null,
    releaseName: null,
    publishedAt: null,
    checkedAt: null,
    error: null,
  };
  private listeners = new Set<UpdateStateListener>();
  private promptShown = false;

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }

    return UpdateManager.instance;
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  onStateChange(listener: UpdateStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dismissUpdate(): UpdateState {
    if (!this.state.hasUpdate) {
      return this.getState();
    }

    this.setState({ dismissed: true });
    return this.getState();
  }

  async checkForUpdates(options?: {
    mainWindow?: Window | null;
    promptUser?: boolean;
  }): Promise<UpdateState> {
    if (this.state.checking) {
      return this.getState();
    }

    this.setState({ checking: true, error: null });

    try {
      const response = await fetch(this.getLatestReleaseApiUrl(), {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": `blueberry-browser/${this.state.currentVersion}`,
        },
      });

      if (response.status === 404) {
        logger.info("No GitHub release found for update check");
        this.setState({
          checking: false,
          hasUpdate: false,
          dismissed: false,
          latestVersion: null,
          releaseUrl: RELEASES_URL,
          releaseName: null,
          publishedAt: null,
          checkedAt: Date.now(),
          error: "No published GitHub release found yet.",
        });
        return this.getState();
      }

      if (!response.ok) {
        throw new Error(`GitHub update check failed with ${response.status}`);
      }

      const release = (await response.json()) as GitHubRelease;
      const latestVersion = this.normalizeVersion(release.tag_name);
      const hasUpdate =
        latestVersion !== null &&
        this.compareVersions(latestVersion, this.state.currentVersion) > 0;

      this.setState({
        checking: false,
        hasUpdate,
        dismissed: hasUpdate ? this.state.dismissed : false,
        latestVersion,
        releaseUrl: release.html_url || RELEASES_URL,
        releaseName: release.name || release.tag_name || null,
        publishedAt: release.published_at || null,
        checkedAt: Date.now(),
        error: null,
      });

      if (hasUpdate && options?.promptUser) {
        await this.maybePromptForUpdate(options.mainWindow ?? null);
      }
    } catch (error) {
      logger.warn("Update check failed", {
        error:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error",
      });
      this.setState({
        checking: false,
        checkedAt: Date.now(),
        error: "Could not check GitHub releases right now.",
      });
    }

    return this.getState();
  }

  async openReleasePage(): Promise<void> {
    await shell.openExternal(this.state.releaseUrl || RELEASES_URL);
  }

  private async maybePromptForUpdate(mainWindow: Window | null): Promise<void> {
    if (
      !this.state.hasUpdate ||
      this.state.dismissed ||
      this.promptShown ||
      !mainWindow
    ) {
      return;
    }

    this.promptShown = true;

    const { response } = await dialog.showMessageBox(mainWindow.baseWindow, {
      type: "info",
      buttons: ["Update Now", "Later", "Open Settings"],
      defaultId: 0,
      cancelId: 1,
      title: "Update Available",
      message: `Blueberry Browser ${this.state.latestVersion} is available.`,
      detail: `You are currently on version ${this.state.currentVersion}.`,
      noLink: true,
    });

    if (response === 0) {
      await this.openReleasePage();
      this.dismissUpdate();
      return;
    }

    if (response === 2) {
      mainWindow.browserSettings.show();
    }

    this.dismissUpdate();
  }

  private setState(patch: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };

    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  private getLatestReleaseApiUrl(): string {
    const repoPath = this.extractRepoPath(GITHUB_REMOTE_URL);
    return `https://api.github.com/repos/${repoPath}/releases/latest`;
  }

  private extractRepoPath(remoteUrl: string): string {
    const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (!match) {
      throw new Error("Invalid GitHub remote URL");
    }

    return match[1];
  }

  private normalizeVersion(version: string | undefined): string | null {
    if (!version) {
      return null;
    }

    return version.trim().replace(/^v/i, "");
  }

  private compareVersions(a: string, b: string): number {
    const aParts = this.parseVersion(a);
    const bParts = this.parseVersion(b);
    const length = Math.max(aParts.length, bParts.length);

    for (let index = 0; index < length; index += 1) {
      const aPart = aParts[index] ?? 0;
      const bPart = bParts[index] ?? 0;

      if (aPart > bPart) {
        return 1;
      }

      if (aPart < bPart) {
        return -1;
      }
    }

    return 0;
  }

  private parseVersion(version: string): number[] {
    return version
      .split("-")[0]
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part));
  }
}
