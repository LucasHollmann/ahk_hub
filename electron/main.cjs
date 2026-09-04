const { app, BrowserWindow, Menu, ipcMain, globalShortcut, screen } = require("electron");
const path = require("node:path");

const isDevelopment = !app.isPackaged;
const CAPTURE_POSITION_KEY = "F8";

Menu.setApplicationMenu(null);

function stopCapturePosition() {
  if (globalShortcut.isRegistered(CAPTURE_POSITION_KEY)) {
    globalShortcut.unregister(CAPTURE_POSITION_KEY);
  }
}

ipcMain.on("capture-position:start", (event) => {
  stopCapturePosition();
  globalShortcut.register(CAPTURE_POSITION_KEY, async () => {
    stopCapturePosition();
    const point = screen.getCursorScreenPoint();

    let window = null;
    try {
      const { activeWindow } = await import("get-windows");
      const active = await activeWindow();
      if (active) {
        window = {
          title: active.title,
          owner: active.owner?.name ?? null,
          bounds: active.bounds,
          relative: {
            x: point.x - active.bounds.x,
            y: point.y - active.bounds.y,
          },
        };
      }
    } catch {
      // window detection unavailable on this platform; global position still works
    }

    event.sender.send("capture-position:result", { point, window });
  });
});

ipcMain.on("capture-position:cancel", () => {
  stopCapturePosition();
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#101416",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDevelopment) {
    window.loadURL("http://localhost:3010");
    window.webContents.openDevTools();
  } else {
    window.loadFile(path.join(__dirname, "..", "out", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});