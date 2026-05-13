import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";

export class BrowserSettings {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private isVisible = false;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.updateBounds();
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/settings.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const settingsUrl = new URL(
        "/settings/",
        process.env["ELECTRON_RENDERER_URL"]
      );
      webContentsView.webContents.loadURL(settingsUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/settings.html")
      );
    }

    return webContentsView;
  }

  updateBounds(): void {
    if (!this.isVisible) {
      this.webContentsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }

    const bounds = this.baseWindow.getBounds();
    const insetX = Math.max(32, Math.round(bounds.width * 0.06));
    const insetTop = 104;
    const insetBottom = 32;

    this.webContentsView.setBounds({
      x: insetX,
      y: insetTop,
      width: Math.max(760, bounds.width - insetX * 2),
      height: Math.max(520, bounds.height - insetTop - insetBottom),
    });
  }

  show(): void {
    this.isVisible = true;
    this.updateBounds();
  }

  hide(): void {
    this.isVisible = false;
    this.updateBounds();
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }
}
