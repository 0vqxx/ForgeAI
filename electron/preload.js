const { contextBridge, ipcRenderer } = require("electron");

// Parse the #forge:port=...&workspace=... fragment so the renderer can route
// REACT_APP_BACKEND_URL at the sidecar.
function parseForgeFragment() {
  try {
    const frag = window.location.hash || "";
    const m = frag.match(/forge:port=(\d+)&workspace=([^&]+)/);
    if (m) return { port: Number(m[1]), workspace: decodeURIComponent(m[2]) };
  } catch {}
  return { port: 8001, workspace: "" };
}

const initial = parseForgeFragment();

contextBridge.exposeInMainWorld("forge", {
  isElectron: true,
  backendUrl: () => `http://127.0.0.1:${initial.port}`,
  workspace: () => initial.workspace,
  openFolder: () => ipcRenderer.invoke("forge:openFolder"),
  state: () => ipcRenderer.invoke("forge:state"),
  onMenu: (cb) => ipcRenderer.on("menu", (_e, action) => cb(action)),
});
