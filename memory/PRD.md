# Forge — Product Requirements Document

> Original ask: "AI-native desktop IDE (BloomIDE) inspired by Cursor + VS Code + Zed + Windsurf, powered by NVIDIA NIM."
> Renamed to **Forge** at user request, with **dark orange (#EA580C)** accent + custom F logo.

## Architecture

- **Frontend** (`/app/frontend`): React + Monaco + xterm + Tailwind + shadcn + Zustand + Sonner.
- **Backend** (`/app/backend`): FastAPI; routes for `fs` (read/write/create/rename/delete/search/upload), `ai` (NVIDIA NIM streaming + complete/edit/explain/refactor/docs/tests/fix/commit-message), `terminal` (event-driven PTY WebSocket using `loop.add_reader`), `git` (status/diff/init/commit).
- **Desktop wrapper** (`/app/electron`): Electron main + preload + electron-builder configs for Win / macOS / Linux. Web app and desktop share the same React UI.
- **Workspace** at `/app/workspace`, exposed to the user as the IDE workspace root.

## Implemented (Feb 2026)

- **UI shell**: Title bar + VS Code-style menu bar (File · Edit · Selection · View · Go · Run · AI · Help), activity bar, resizable panels (`react-resizable-panels`), bottom Terminal/Problems/Output, full-height AI panel on right, status bar with terminal/AI toggles and breadcrumb.
- **Editor**: Monaco with multi-tab, dirty-dot, minimap, ligatures, smooth cursor, bracket-pair coloring, find/replace, rename (F2), Go to Definition (F12), Ctrl+K inline AI edit, right-click AI actions (Explain / Refactor / Docs / Tests / Fix), ghost-text autocomplete (Tab to accept).
- **File explorer**: Flat-iterative tree (avoids babel recursion), create/rename/delete, drag-and-drop file import via `/api/fs/upload` multipart.
- **Search**: Workspace-wide text search via `/api/fs/search`.
- **Git**: status, AI-generated commit messages.
- **Terminal**: real PTY via `pty.fork()` + event-driven `loop.add_reader(fd)` over WebSocket (event-loop safe, doesn't starve HTTP).
- **AI Chat**: streaming SSE markdown chat with code-block copy buttons, conversation history, **Agent mode** that parses `<forge-file path action>` blocks from model output and writes files directly via `/api/fs/write`. Empty-state shows F logo.
- **Models**: GLM 5.1 (default), Kimi K2.6, MiniMax M3, Mistral Medium 3.5 128B, Llama 3.3 70B (fallback) — all served by NVIDIA NIM.
- **Themes**: Dark / Light / Vintage with instant switching.
- **Settings**: model, theme, font, font-size, tab-size, word-wrap, ghost-text, auto-save, terminal shell — persisted via Zustand+localStorage.
- **Shortcuts**: Ctrl+P/Ctrl+Shift+P, Ctrl+J terminal, Ctrl+Shift+L chat, Ctrl+Alt+E maximize chat, Ctrl+Alt+A new folder, Ctrl+S save, Ctrl+K inline edit, Ctrl+, settings.

## Verified flows (iteration_7.json — 100/100)

- Chat → stream → `<forge-file>` parsing → `/api/fs/write` → file appears in workspace (`hello.txt` test).
- Concurrent HTTP + WebSocket terminal (no event-loop starvation).
- File CRUD, multipart upload, search, terminal echo, git status, NVIDIA SSE streaming.

## Backlog / P1 next

- **P1**: Multi-cursor + column selection visible commands (Monaco supports natively — just expose in menu).
- **P1**: Multiple terminal tabs/splits.
- **P1**: Git diff viewer inline (currently only status + AI commit message).
- **P2**: Extension marketplace panel (static, list popular language servers).
- **P2**: Drag-tab-to-reorder.
- **P2**: Zen / distraction-free mode toggle.
- **P2**: Recently-opened files list in File menu.
- **P3**: Bundle FastAPI sidecar inside Electron build for one-click desktop install (PyInstaller).
