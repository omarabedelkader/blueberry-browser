import { app, BrowserWindow } from "electron";
import { electronApp } from "@electron-toolkit/utils";
import { Window } from "./Window";
import { AppMenu } from "./Menu";
import { EventManager } from "./EventManager";

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;

const createWindow = (): Window => {
  const window = new Window();
  menu = new AppMenu(window);
  return window;
};

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.blueberry.browser");
  eventManager = new EventManager(() => mainWindow);

  mainWindow = createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Clean up references
  if (mainWindow) {
    mainWindow = null;
  }
  if (menu) {
    menu = null;
  }

  if (process.platform !== "darwin") {
    if (eventManager) {
      eventManager.cleanup();
      eventManager = null;
    }
    app.quit();
  }
});
