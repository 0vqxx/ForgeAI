/**
 * BloomIDE — Electron main process.
 *
 * In dev: loads http://localhost:3000 (React dev server).
 * In prod: loads the built React bundle from frontend/build/index.html.
 *
 * The IDE talks to a local FastAPI backend (default http://localhost:8001).
 * Configure REACT_APP_BACKEND_URL in frontend/.env to point at your backend.
 */
const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");

const isDev = !!process.env.ELECTRON_START_URL;
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    frame: process.platform === "darwin",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

const template = [
  ...(process.platform === "darwin"
    ? [{ label: app.getName(), submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] }]
    : []),
  {
    label: "File",
    submenu: [
      { label: "New File", accelerator: "CmdOrCtrl+N", click: () => win?.webContents.send("menu", "new-file") },
      { label: "Open Folder…", accelerator: "CmdOrCtrl+Alt+A", click: () => win?.webContents.send("menu", "open-folder") },
      { type: "separator" },
      { label: "Save", accelerator: "CmdOrCtrl+S", click: () => win?.webContents.send("menu", "save") },
      { type: "separator" },
      { role: process.platform === "darwin" ? "close" : "quit" },
    ],
  },
  { role: "editMenu" },
  {
    label: "View",
    submenu: [
      { label: "Toggle Terminal", accelerator: "CmdOrCtrl+J", click: () => win?.webContents.send("menu", "toggle-terminal") },
      { label: "Command Palette", accelerator: "CmdOrCtrl+Shift+P", click: () => win?.webContents.send("menu", "cmd-palette") },
      { type: "separator" },
      { role: "reload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
  {
    label: "AI",
    submenu: [
      { label: "New AI Chat", accelerator: "CmdOrCtrl+Shift+L", click: () => win?.webContents.send("menu", "new-chat") },
      { label: "Maximize Chat", accelerator: "CmdOrCtrl+Alt+E", click: () => win?.webContents.send("menu", "max-chat") },
    ],
  },
  {
    role: "help",
    submenu: [
      { label: "BloomIDE Website", click: () => shell.openExternal("https://bloomide.dev") },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("app:version", () => app.getVersion());
