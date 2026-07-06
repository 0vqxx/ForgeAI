# BloomIDE — Electron Desktop Build

BloomIDE ships as both a **web app** (used in this preview) and a **native desktop app** powered by Electron.

The web frontend + FastAPI backend already work standalone — this directory contains the **Electron wrapper** to package BloomIDE as a true cross-platform desktop application for Windows, macOS, and Linux.

## Architecture

```
┌──────────────────────────────────────────┐
│  Electron main process (main.js)         │
│  – Native window, menus, system shell    │
│  – Loads the React bundle                │
└──────────────────┬───────────────────────┘
                   │ IPC (preload.js)
┌──────────────────▼───────────────────────┐
│  React renderer (frontend/build/)        │
│  – Monaco editor, xterm, AI chat UI      │
└──────────────────┬───────────────────────┘
                   │ HTTP + WebSocket
┌──────────────────▼───────────────────────┐
│  FastAPI backend (backend/server.py)     │
│  – Filesystem, AI (NVIDIA NIM), PTY      │
└──────────────────────────────────────────┘
```

## Prerequisites

- Node.js ≥ 20
- Yarn
- Python ≥ 3.10 (for the backend)
- An `NVIDIA_API_KEY` in `backend/.env`

## Development (hot reload)

```bash
# 1. Start backend
cd ../backend && uvicorn server:app --reload --port 8001

# 2. Install electron deps
cd ../electron && yarn install

# 3. Run desktop app + frontend dev server together
yarn dev
```

## Production build

```bash
# Build the React frontend
cd ../frontend && yarn build

# Package the desktop app
cd ../electron
yarn build              # current platform
yarn build:win          # Windows installer
yarn build:mac          # macOS .dmg
yarn build:linux        # Linux AppImage + .deb
```

Build artifacts land in `electron/dist/`.

## Backend bundling

For a single distributable, package the FastAPI backend using `pyinstaller` (or run it as a sidecar from `main.js` via `child_process.spawn`). A minimal sidecar pattern:

```js
const { spawn } = require("child_process");
spawn("python", ["../backend/server.py"], { stdio: "inherit" });
```

## Notes

- Update `frontend/.env`'s `REACT_APP_BACKEND_URL` to `http://localhost:8001` for desktop builds.
- The AI integration uses NVIDIA NIM's OpenAI-compatible endpoint and works identically in desktop and web modes.
- Custom title-bar / traffic lights are enabled on macOS via `titleBarStyle: "hiddenInset"`.
