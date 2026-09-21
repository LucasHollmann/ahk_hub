const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  globalShortcut,
  screen,
  desktopCapturer,
  dialog,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { uIOhook, UiohookKey } = require("uiohook-napi");

const isDevelopment = !app.isPackaged;
const CAPTURE_POSITION_KEY = "F8";

Menu.setApplicationMenu(null);

// ==== Command recording (global mouse/keyboard hook) ====

const KEY_NAME_BY_CODE = (() => {
  const map = {};
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (!(code in map)) map[code] = name;
  }
  return map;
})();

// Renders a raw uiohook key name in the same style the app's own key picker uses.
const KEY_NAME_OVERRIDES = {
  Escape: "Esc",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Semicolon: ";",
  Equal: "=",
  Comma: ",",
  Minus: "-",
  Period: ".",
  Slash: "/",
  Backquote: "`",
  BracketLeft: "[",
  Backslash: "\\",
  BracketRight: "]",
  Quote: "'",
};

function keyDisplayName(rawName) {
  return KEY_NAME_OVERRIDES[rawName] ?? rawName;
}

function modifierLabel(rawName) {
  if (rawName === "Ctrl" || rawName === "CtrlRight") return "Ctrl";
  if (rawName === "Alt" || rawName === "AltRight") return "Alt";
  if (rawName === "Shift" || rawName === "ShiftRight") return "Shift";
  if (rawName === "Meta" || rawName === "MetaRight") return "Win";
  return null;
}

const MODIFIER_ORDER = ["Ctrl", "Shift", "Alt", "Win"];
const MOUSE_BUTTON_NAMES = { 1: "Left", 2: "Right", 3: "Middle" };
// How long to hold a completed click before reporting it, to see if a second click
// follows close enough to merge into one double-click event instead of two separate ones.
const DOUBLE_CLICK_WINDOW_MS = 400;
const DOUBLE_CLICK_DISTANCE_PX = 8;

// The native hook is started once (see app.whenReady below) and left running for the
// app's lifetime — starting/stopping it around every pause/resume was flaky on Windows:
// the keyboard hook in particular could take a start/stop cycle to "warm up", so the
// very first recording session would silently miss all keydown/keyup events. Recording
// on/off is instead just whether our own listeners are currently attached.
let isHookStarted = false;
const heldModifiers = new Set();
const modifierUsedInCombo = new Map();
const keyDownTimes = new Map();
let pendingMouseDown = null;
let pendingSingleClick = null;

function ensureHookStarted() {
  if (isHookStarted) return;
  isHookStarted = true;
  uIOhook.start();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function resolveWindowInfo(point) {
  try {
    const { activeWindow } = await import("get-windows");
    const active = await activeWindow();
    if (!active || !active.bounds) return null;
    return {
      title: active.title,
      owner: active.owner?.name ?? null,
      bounds: active.bounds,
      relative: { x: point.x - active.bounds.x, y: point.y - active.bounds.y },
    };
  } catch {
    // window detection unavailable on this platform; global position still works
    return null;
  }
}

function stopRecording() {
  uIOhook.removeAllListeners("keydown");
  uIOhook.removeAllListeners("keyup");
  uIOhook.removeAllListeners("mousedown");
  uIOhook.removeAllListeners("mouseup");
  heldModifiers.clear();
  modifierUsedInCombo.clear();
  keyDownTimes.clear();
  pendingMouseDown = null;
  if (pendingSingleClick) {
    clearTimeout(pendingSingleClick.timer);
    pendingSingleClick = null;
  }
}

ipcMain.on("record:start", (event) => {
  stopRecording();
  ensureHookStarted();

  // Ignores input while the AHK Hub window itself is focused, so clicking
  // "Parar gravação" (or typing anywhere in the app) doesn't get recorded as a step.
  function isOwnWindowFocused() {
    const win = BrowserWindow.fromWebContents(event.sender);
    return Boolean(win && win.isFocused());
  }

  uIOhook.on("keydown", (e) => {
    if (isOwnWindowFocused()) return;
    const rawName = KEY_NAME_BY_CODE[e.keycode];
    if (!rawName) return;

    const modLabel = modifierLabel(rawName);
    if (modLabel) {
      if (!heldModifiers.has(modLabel)) {
        heldModifiers.add(modLabel);
        modifierUsedInCombo.set(modLabel, false);
        keyDownTimes.set(e.keycode, Date.now());
      }
      return;
    }

    if (keyDownTimes.has(e.keycode)) return; // OS auto-repeat while held
    keyDownTimes.set(e.keycode, Date.now());
    for (const mod of heldModifiers) modifierUsedInCombo.set(mod, true);
  });

  uIOhook.on("keyup", (e) => {
    if (isOwnWindowFocused()) return;
    const rawName = KEY_NAME_BY_CODE[e.keycode];
    if (!rawName) return;

    const downTime = keyDownTimes.get(e.keycode);
    keyDownTimes.delete(e.keycode);
    const heldMs = downTime ? Date.now() - downTime : 0;

    const modLabel = modifierLabel(rawName);
    if (modLabel) {
      const usedInCombo = modifierUsedInCombo.get(modLabel);
      heldModifiers.delete(modLabel);
      modifierUsedInCombo.delete(modLabel);
      if (!usedInCombo) {
        event.sender.send("record:event", { kind: "key", combo: modLabel, heldMs });
      }
      return;
    }

    const mods = MODIFIER_ORDER.filter((m) => heldModifiers.has(m));
    const combo = [...mods, keyDisplayName(rawName)].join("+");
    event.sender.send("record:event", { kind: "key", combo, heldMs });
  });

  uIOhook.on("mousedown", (e) => {
    if (isOwnWindowFocused()) return;
    pendingMouseDown = {
      x: e.x,
      y: e.y,
      time: Date.now(),
      button: MOUSE_BUTTON_NAMES[e.button] ?? "Left",
    };
  });

  uIOhook.on("mouseup", async (e) => {
    if (isOwnWindowFocused()) return;
    const down = pendingMouseDown;
    pendingMouseDown = null;
    if (!down) return;

    const point = { x: e.x, y: e.y };
    const downPoint = { x: down.x, y: down.y };
    const heldMs = Date.now() - down.time;
    const button = MOUSE_BUTTON_NAMES[e.button] ?? down.button;
    const window = await resolveWindowInfo(point);

    const base = { kind: "click", point, downPoint, window, button, heldMs };

    if (
      pendingSingleClick &&
      pendingSingleClick.button === button &&
      distance(pendingSingleClick.point, point) <= DOUBLE_CLICK_DISTANCE_PX &&
      Date.now() - pendingSingleClick.sentAt <= DOUBLE_CLICK_WINDOW_MS
    ) {
      clearTimeout(pendingSingleClick.timer);
      pendingSingleClick = null;
      event.sender.send("record:event", { ...base, doubleClick: true });
      return;
    }

    if (pendingSingleClick) clearTimeout(pendingSingleClick.timer);
    const timer = setTimeout(() => {
      pendingSingleClick = null;
      event.sender.send("record:event", { ...base, doubleClick: false });
    }, DOUBLE_CLICK_WINDOW_MS);

    pendingSingleClick = { point, button, sentAt: Date.now(), timer };
  });
});

ipcMain.on("record:stop", () => {
  stopRecording();
});

function stopCapturePosition() {
  if (globalShortcut.isRegistered(CAPTURE_POSITION_KEY)) {
    globalShortcut.unregister(CAPTURE_POSITION_KEY);
  }
}

// Reads the screen pixel under `point` as "0xRRGGBB" — the same notation AutoHotkey's
// PixelGetColor returns, so the captured value can be compared against it directly.
// Electron has no pixel-level screen API, so this grabs the containing display as an
// image and samples it; only done when the caller asks for a color.
async function pixelColorAt(point) {
  try {
    const display = screen.getDisplayNearestPoint(point);
    const { bounds, scaleFactor } = display;
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(bounds.width * scaleFactor),
        height: Math.round(bounds.height * scaleFactor),
      },
    });

    const source =
      sources.find((s) => String(s.display_id) === String(display.id)) ?? sources[0];
    const image = source?.thumbnail;
    if (!image || image.isEmpty()) return null;

    const size = image.getSize();
    const clamp = (value, max) => Math.min(Math.max(value, 0), max - 1);
    const x = clamp(Math.round((point.x - bounds.x) * (size.width / bounds.width)), size.width);
    const y = clamp(Math.round((point.y - bounds.y) * (size.height / bounds.height)), size.height);

    // toBitmap() is BGRA, one pixel here.
    const [b, g, r] = image.crop({ x, y, width: 1, height: 1 }).toBitmap();
    const hex = (channel) => channel.toString(16).padStart(2, "0").toUpperCase();
    return `0x${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    // screen capture unavailable or denied; the position alone is still useful
    return null;
  }
}

// ==== Reading the control under the cursor ====

// AutoHotkey itself resolves this, rather than Win32 calls from here: the ClassNN it reports
// is by definition the one ControlSend will accept, and reimplementing how AHK numbers
// same-class siblings would risk producing a name that silently targets the wrong control.
const CONTROL_PROBE_SCRIPT = [
  "#Requires AutoHotkey v2.0",
  "#SingleInstance Off",
  "MouseGetPos &x, &y, &win, &control",
  'FileAppend control, "*"',
  "ExitApp",
].join("\r\n");

const CONTROL_PROBE_TIMEOUT_MS = 4000;

let ahkExecutablePromise = null;
let controlProbePathPromise = null;

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

// The app launches scripts through the .ahk file association, so it never needed the
// interpreter's path before — this looks it up in the usual install locations, then in the
// key the installer writes.
function findAutoHotkey() {
  if (!ahkExecutablePromise) {
    ahkExecutablePromise = (async () => {
      const programFiles = process.env.ProgramFiles || "C:\\Program Files";
      const localAppData = process.env.LOCALAPPDATA || "";
      const found = await firstExistingPath([
        path.join(programFiles, "AutoHotkey", "v2", "AutoHotkey.exe"),
        path.join(programFiles, "AutoHotkey", "AutoHotkey.exe"),
        localAppData && path.join(localAppData, "Programs", "AutoHotkey", "v2", "AutoHotkey.exe"),
      ]);
      if (found) return found;

      const installDir = await new Promise((resolve) => {
        execFile(
          "reg",
          ["query", "HKLM\\SOFTWARE\\AutoHotkey", "/v", "InstallDir"],
          { windowsHide: true },
          (error, stdout) => {
            const match = !error && /InstallDir\s+REG_SZ\s+(.+)/i.exec(stdout);
            resolve(match ? match[1].trim() : null);
          }
        );
      });
      if (!installDir) return null;

      return firstExistingPath([
        path.join(installDir, "v2", "AutoHotkey.exe"),
        path.join(installDir, "AutoHotkey.exe"),
      ]);
    })();
  }
  return ahkExecutablePromise;
}

function controlProbePath() {
  if (!controlProbePathPromise) {
    controlProbePathPromise = (async () => {
      const file = path.join(app.getPath("temp"), "ahk-hub-control-probe.ahk");
      await fs.writeFile(file, CONTROL_PROBE_SCRIPT, "utf-8");
      return file;
    })();
  }
  return controlProbePathPromise;
}

/**
 * ClassNN of the control under the cursor, as Window Spy would report it, or null when
 * AutoHotkey isn't installed where we can find it or the point isn't over a control.
 * Reads the cursor position when the probe runs, a moment after F8 — the same "hover and
 * press" gesture Window Spy uses, so holding still is already what the user is doing.
 */
async function controlUnderCursor() {
  const executable = await findAutoHotkey();
  if (!executable) return null;

  try {
    const script = await controlProbePath();
    const stdout = await new Promise((resolve, reject) => {
      execFile(
        executable,
        // Without /ErrorStdOut a failing probe pops up AutoHotkey's error dialog over
        // whatever the user is pointing at.
        ["/ErrorStdOut", script],
        { timeout: CONTROL_PROBE_TIMEOUT_MS, windowsHide: true },
        (error, out) => (error ? reject(error) : resolve(out))
      );
    });
    const control = String(stdout).trim();
    return control || null;
  } catch {
    // probe failed or timed out; the capture still reports the position
    return null;
  }
}

ipcMain.on("capture-position:start", (event, options) => {
  stopCapturePosition();
  globalShortcut.register(CAPTURE_POSITION_KEY, async () => {
    stopCapturePosition();
    const point = screen.getCursorScreenPoint();
    const color = options?.withColor ? await pixelColorAt(point) : null;
    const control = options?.withControl ? await controlUnderCursor() : null;

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

    event.sender.send("capture-position:result", { point, window, color, control });
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
    // Only used while running unpackaged; a packaged build takes its icon from the exe,
    // which electron-builder stamps from the same file (see "build.win.icon").
    icon: path.join(__dirname, "icon.ico"),
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
  // Started here (idle, no listeners attached) rather than on the first recording
  // session — the underlying native hook, on Windows in particular, can take a
  // start/stop cycle to fully warm up, which made the very first recording silently
  // miss keyboard events if we only started it on demand.
  ensureHookStarted();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopRecording();
  if (isHookStarted) uIOhook.stop();
});