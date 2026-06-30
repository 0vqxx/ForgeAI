# BloomIDE — AI-Native Cross-Platform IDE

> A modern, AI-first code editor inspired by Cursor, VS Code, Zed, and Windsurf — powered by NVIDIA NIM.

BloomIDE runs as both a **web application** (for instant access) and a **native desktop app** via Electron. It pairs the Monaco editor (the same engine behind VS Code) with streaming AI assistance from leading models hosted on NVIDIA NIM.

## Features

### Editor
- Monaco editor with multi-tab editing, minimap, syntax highlighting, bracket matching, folding
- Workspace file explorer with create / rename / delete
- Workspace-wide full-text search
- Find / replace, Go-to-definition, Rename symbol
- Command palette (`Ctrl+P` / `Ctrl+Shift+P`)
- Resizable, dockable panels
- Auto-save
- Integrated terminal (real PTY via WebSocket + xterm.js)
- Git source-control panel with AI-generated commit messages

### AI (NVIDIA NIM)
- Streaming chat with markdown + code-block rendering + copy buttons
- Conversation history with sessions
- Ghost-text autocomplete (Tab to accept, Esc to dismiss)
- Inline edit: select code → `Ctrl+K` → describe the change → applied in place
- Right-click context menu: **Explain · Refactor · Generate docs · Generate tests · Fix errors**
- Switchable models: **GLM 4.5 · Kimi K2 · Jamba 1.5 Large · Mistral Medium 3 · Llama 3.3 70B**

### UX
- Three first-class themes: **Dark** (#09090B / #10B981), **Light**, **Vintage** (warm beige + muted greens, serif)
- Instant theme switching
- Configurable font, font size, tab size, word-wrap, terminal shell, AI model, autocomplete
- Settings persist locally

## Project layout

```
/app
├── backend/          FastAPI backend
│   ├── server.py
│   └── routes/{fs,ai,terminal,git}.py
├── frontend/         React + Monaco UI
│   └── src/ide/      All IDE components
├── workspace/        The editable workspace (mapped via WORKSPACE_DIR)
├── electron/         Electron desktop wrapper (build to Win/macOS/Linux)
└── memory/           PRD + agent notes
```

## Running locally

The web stack runs out-of-the-box on port 3000 (frontend) and 8001 (backend, behind `/api`). The Electron build is described in [`electron/README.md`](electron/README.md).

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Command palette | `Ctrl+P` / `Ctrl+Shift+P` |
| New AI chat | `Ctrl+Shift+L` |
| Toggle terminal | `Ctrl+J` |
| Maximize chat | `Ctrl+Alt+E` |
| New folder | `Ctrl+Alt+A` |
| Save | `Ctrl+S` |
| Find / Replace | `Ctrl+F` / `Ctrl+H` |
| Rename symbol | `F2` |
| Go to definition | `F12` |
| Settings | `Ctrl+,` |
| Inline AI edit | `Ctrl+K` (after selecting code) |

## Environment

`backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
NVIDIA_API_KEY=<your NVIDIA NIM key from build.nvidia.com>
WORKSPACE_DIR=/app/workspace
```

`frontend/.env`:
```
REACT_APP_BACKEND_URL=<backend URL>
```
