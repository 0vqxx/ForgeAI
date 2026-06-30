/**
 * Forge — Electron main process with sidecar FastAPI backend + native "Open Folder…".
 *
 * The backend is spawned as a child process on app start. The renderer (React UI)
 * talks to http://127.0.0.1:<port>/api just like in the web preview, but now the
 * backend reads/writes the REAL folder the user picked.
 */
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");

const isDev = !!process.env.ELECTRON_START_URL;
let win;
let backendProc;
let backendPort = 8001;
let workspaceDir = app.getPath("documents") + path.sep + "ForgeWorkspace";

function freePort() {
  return new Promise((res) => {
    const s = net.createServer().listen(0, () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
}

async function startBackend() {
  if (backendProc) { try { backendProc.kill(); } catch {} }
  backendPort = await freePort();
  if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

  const pythonBin = process.env.FORGE_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const backendDir = isDev
    ? path.join(__dirname, "..", "backend")
    : path.join(process.resourcesPath, "backend");

  backendProc = spawn(
    pythonBin,
    ["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", String(backendPort)],
    {
      cwd: backendDir,
      env: { ...process.env, WORKSPACE_DIR: workspaceDir, MONGO_URL: "mongodb://localhost:27017", DB_NAME: "forge" },
      stdio: "inherit",
    },
  );
  backendProc.on("exit", (code) => console.log("[forge backend] exited", code));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: "#09090b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  const url = isDev
    ? process.env.ELECTRON_START_URL
    : `file://${path.join(__dirname, "..", "frontend", "build", "index.html")}`;
  // Inject backend port + workspace path via query string so the renderer's
  // REACT_APP_BACKEND_URL points at our sidecar.
  win.loadURL(`${url}#forge:port=${backendPort}&workspace=${encodeURIComponent(workspaceDir)}`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

async function openFolder() {
  const r = await dialog.showOpenDialog(win, {
    title: "Open Folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (r.canceled || !r.filePaths[0]) return;
  workspaceDir = r.filePaths[0];
  await startBackend();
  win.reload();
}

const template = [
  ...(process.platform === "darwin" ? [{ label: app.getName(), submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] }] : []),
  { label: "File", submenu: [
    { label: "Open Folder…", accelerator: "CmdOrCtrl+Shift+O", click: openFolder },
    { type: "separator" },
    { label: "New File", accelerator: "CmdOrCtrl+N", click: () => win?.webContents.send("menu", "new-file") },
    { label: "Save", accelerator: "CmdOrCtrl+S", click: () => win?.webContents.send("menu", "save") },
    { type: "separator" },
    { role: process.platform === "darwin" ? "close" : "quit" },
  ]},
  { role: "editMenu" },
  { label: "View", submenu: [
    { label: "Toggle Terminal", accelerator: "CmdOrCtrl+J", click: () => win?.webContents.send("menu", "toggle-terminal") },
    { label: "Command Palette", accelerator: "CmdOrCtrl+Shift+P", click: () => win?.webContents.send("menu", "cmd-palette") },
    { role: "reload" }, { role: "toggleDevTools" }, { role: "togglefullscreen" },
  ]},
  { label: "AI", submenu: [
    { label: "New AI Chat", accelerator: "CmdOrCtrl+Shift+L", click: () => win?.webContents.send("menu", "new-chat") },
    { label: "Maximize Chat", accelerator: "CmdOrCtrl+Alt+E", click: () => win?.webContents.send("menu", "max-chat") },
  ]},
];

app.whenReady().then(async () => {
  await startBackend();
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => {
  if (backendProc) try { backendProc.kill(); } catch {}
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("forge:openFolder", openFolder);
ipcMain.handle("forge:state", () => ({ port: backendPort, workspace: workspaceDir }));
