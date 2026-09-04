const { app, BrowserWindow, Menu, ipcMain, globalShortcut, screen, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

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

ipcMain.handle("save-script", async (event, content, targetPath) => {
  let filePath = targetPath;

  if (!filePath) {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath: chosenPath } = await dialog.showSaveDialog(window, {
      title: "Salvar script AHK",
      defaultPath: "novo script.ahk",
      filters: [{ name: "AutoHotkey Script", extensions: ["ahk"] }],
    });

    if (canceled || !chosenPath) {
      return { status: "canceled" };
    }
    filePath = chosenPath;
  }

  try {
    await fs.writeFile(filePath, content, "utf-8");
    return { status: "saved", path: filePath };
  } catch (error) {
    return { status: "error", error: error.message };
  }
});

ipcMain.handle("load-script", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    title: "Carregar script AHK",
    filters: [{ name: "AutoHotkey Script", extensions: ["ahk"] }],
    properties: ["openFile"],
  });

  if (canceled || filePaths.length === 0) {
    return { status: "canceled" };
  }

  const filePath = filePaths[0];
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { status: "loaded", path: filePath, content };
  } catch (error) {
    return { status: "error", error: error.message };
  }
});

ipcMain.handle("run-script", async (_event, filePath) => {
  try {
    const openError = await shell.openPath(filePath);
    if (openError) return { status: "error", error: openError };
    return { status: "ok" };
  } catch (error) {
    return { status: "error", error: error.message };
  }
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