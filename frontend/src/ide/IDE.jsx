/** Main IDE shell - layout, keyboard shortcuts, tab management. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Toaster, toast } from "sonner";
import {
  FolderTree, Search, GitBranch, Sparkles, Settings as SettingsIcon, Terminal as TerminalIcon,
  AlertTriangle, MessageSquare, FileWarning, Activity,
} from "lucide-react";
import MenuBar from "./components/MenuBar";
import FileExplorer from "./components/FileExplorer";
import SearchPanel from "./components/SearchPanel";
import GitPanel from "./components/GitPanel";
import EditorArea from "./components/EditorArea";
import ChatPanel from "./components/ChatPanel";
import TerminalView from "./components/TerminalView";
import CommandPalette from "./components/CommandPalette";
import SettingsDialog from "./components/SettingsDialog";
import { fsApi, detectLanguage } from "./lib/api";
import { useSettings } from "./lib/store";

const SIDE_VIEWS = [
  { id: "explorer", icon: FolderTree, label: "Explorer (Ctrl+B)" },
  { id: "search", icon: Search, label: "Search (Ctrl+F)" },
  { id: "git", icon: GitBranch, label: "Source Control" },
  { id: "ai", icon: Sparkles, label: "AI (Ctrl+Shift+L)" },
];

export default function IDE() {
  const settings = useSettings();
  const [sideView, setSideView] = useState("explorer");
  const [bottomTab, setBottomTab] = useState("terminal");
  const [showBottom, setShowBottom] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [chatMax, setChatMax] = useState(false);

  const [openFiles, setOpenFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [allFiles, setAllFiles] = useState([]);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const editorApi = useRef(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  // Load all file paths for command palette (recursive)
  const refreshFileList = useCallback(async () => {
    const all = [];
    async function walk(p) {
      try {
        const data = await fsApi.tree(p);
        for (const e of data.entries) {
          if (e.is_dir) await walk(e.path);
          else all.push({ path: e.path, name: e.name });
        }
      } catch { /* ignore */ }
    }
    await walk("");
    setAllFiles(all);
  }, []);
  useEffect(() => { refreshFileList(); }, [refreshFileList]);

  const openFile = useCallback(async (node) => {
    const path = node.path || node;
    const existing = openFiles.findIndex((f) => f.path === path);
    if (existing >= 0) {
      setActiveIndex(existing);
      if (node.line) {
        const next = [...openFiles];
        next[existing] = { ...next[existing], line: node.line };
        setOpenFiles(next);
      }
      return;
    }
    try {
      const data = await fsApi.read(path);
      const name = path.split("/").pop();
      const f = {
        path,
        name,
        content: data.content,
        language: detectLanguage(name),
        dirty: false,
        line: node.line,
      };
      setOpenFiles((prev) => [...prev, f]);
      setActiveIndex(openFiles.length);
    } catch (err) {
      toast.error("Failed to open file");
    }
  }, [openFiles]);

  const closeFile = (i) => {
    const file = openFiles[i];
    if (file?.dirty && !window.confirm(`Discard unsaved changes in ${file.name}?`)) return;
    const next = openFiles.filter((_, idx) => idx !== i);
    setOpenFiles(next);
    setActiveIndex((cur) => {
      if (cur === i) return Math.min(i, next.length - 1);
      if (cur > i) return cur - 1;
      return cur;
    });
  };

  const updateContent = (i, content) => {
    setOpenFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, content, dirty: true } : f));
  };

  const saveActive = useCallback(async () => {
    const f = openFiles[activeIndex];
    if (!f) return;
    try {
      await fsApi.write(f.path, f.content);
      setOpenFiles((prev) => prev.map((x, i) => i === activeIndex ? { ...x, dirty: false } : x));
      toast.success(`Saved ${f.name}`, { duration: 1200 });
      refreshFileList();
    } catch { toast.error("Save failed"); }
  }, [openFiles, activeIndex, refreshFileList]);

  // Auto save
  useEffect(() => {
    if (!settings.autoSave) return;
    const f = openFiles[activeIndex];
    if (!f?.dirty) return;
    const t = setTimeout(() => { saveActive(); }, 800);
    return () => clearTimeout(t);
  }, [openFiles, activeIndex, settings.autoSave, saveActive]);

  // Global shortcuts
  useEffect(() => {
    const handler = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (meta && e.shiftKey && k === "p") { e.preventDefault(); setCmdOpen(true); }
      else if (meta && k === "p" && !e.shiftKey) { e.preventDefault(); setCmdOpen(true); }
      else if (meta && e.shiftKey && k === "l") { e.preventDefault(); setSideView("ai"); setShowChat(true); }
      else if (meta && k === "j") { e.preventDefault(); setShowBottom((v) => !v); }
      else if (meta && k === "b") { e.preventDefault(); setSideView((v) => v === "explorer" ? null : "explorer"); }
      else if (meta && k === "," ) { e.preventDefault(); setSettingsOpen(true); }
      else if (meta && e.altKey && k === "e") { e.preventDefault(); setChatMax((v) => !v); }
      else if (meta && e.altKey && k === "a") { e.preventDefault(); openFile.toString(); document.querySelector('[data-testid="new-folder-btn"]')?.click(); }
      else if (meta && k === "s") { e.preventDefault(); saveActive(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveActive, openFile]);

  const commands = [
    { label: "Settings", shortcut: "Ctrl+,", run: () => setSettingsOpen(true) },
    { label: "Toggle Terminal", shortcut: "Ctrl+J", run: () => setShowBottom((v) => !v) },
    { label: "Toggle AI Chat", shortcut: "Ctrl+Shift+L", run: () => { setShowChat((v) => !v); setSideView("ai"); } },
    { label: "Maximize Chat", shortcut: "Ctrl+Alt+E", run: () => setChatMax((v) => !v) },
    { label: "New File", run: () => document.querySelector('[data-testid="new-file-btn"]')?.click() },
    { label: "New Folder", shortcut: "Ctrl+Alt+A", run: () => document.querySelector('[data-testid="new-folder-btn"]')?.click() },
    { label: "Save File", shortcut: "Ctrl+S", run: saveActive },
    { label: "Find in File", shortcut: "Ctrl+F", run: () => editorApi.current?.openFind() },
    { label: "Replace in File", shortcut: "Ctrl+H", run: () => editorApi.current?.openReplace() },
    { label: "Go to Definition", shortcut: "F12", run: () => editorApi.current?.goToDefinition() },
    { label: "Rename Symbol", shortcut: "F2", run: () => editorApi.current?.rename() },
    { label: "Theme: Dark", run: () => settings.set({ theme: "dark" }) },
    { label: "Theme: Light", run: () => settings.set({ theme: "light" }) },
    { label: "Theme: Vintage", run: () => settings.set({ theme: "vintage" }) },
  ];

  const ctxFile = openFiles[activeIndex];
  const getChatContext = () => ctxFile ? { path: ctxFile.path, code: ctxFile.content, language: ctxFile.language } : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      {/* Title bar with menu */}
      <div className="bl-titlebar" data-testid="title-bar" style={{ height: 38, gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 8, borderRight: "1px solid var(--border)", height: "100%" }}>
          <img
            src="https://customer-assets.emergentagent.com/job_bloom-dev/artifacts/9wzw7jmx_ChatGPT%20Image%20Jun%2029%2C%202026%2C%2010_35_48%20PM.png"
            alt="Forge"
            style={{ width: 22, height: 22, borderRadius: 5, objectFit: "cover", filter: "drop-shadow(0 0 6px rgba(234,88,12,0.35))" }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.02em" }}>Forge</span>
        </div>
        <MenuBar
          cmd={{
            state: { autoSave: settings.autoSave, theme: settings.theme },
            run: (action, arg) => {
              const editor = editorApi.current?.getEditor();
              switch (action) {
                case "new-file": document.querySelector('[data-testid="new-file-btn"]')?.click(); break;
                case "new-folder": document.querySelector('[data-testid="new-folder-btn"]')?.click(); break;
                case "save": saveActive(); break;
                case "toggle-autosave": settings.set({ autoSave: !settings.autoSave }); break;
                case "settings": setSettingsOpen(true); break;
                case "find": editorApi.current?.openFind(); break;
                case "replace": editorApi.current?.openReplace(); break;
                case "cmd-palette": setCmdOpen(true); break;
                case "toggle-terminal": setShowBottom((v) => !v); break;
                case "toggle-chat": setShowChat((v) => !v); break;
                case "toggle-explorer": setSideView((v) => v === "explorer" ? null : "explorer"); break;
                case "theme": settings.set({ theme: arg }); break;
                case "new-chat": document.querySelector('[data-testid="new-chat-btn"]')?.click(); setShowChat(true); break;
                case "max-chat": setChatMax((v) => !v); break;
                case "editor": editor?.trigger("menu", arg, null); break;
                case "editor-trigger": editor?.getAction(arg)?.run(); break;
                case "shortcuts": alert("Forge Shortcuts:\n\nCtrl+P  Command palette\nCtrl+Shift+L  Toggle AI chat\nCtrl+J  Toggle terminal\nCtrl+K  Inline AI edit\nCtrl+S  Save\nCtrl+F  Find\nCtrl+H  Replace\nF2  Rename symbol\nF12  Go to definition\nCtrl+,  Settings"); break;
                default: break;
              }
            },
          }}
        />
        <div style={{ flex: 1 }} />
        <button className="bl-btn ghost" onClick={() => setCmdOpen(true)} data-testid="cmd-palette-btn" style={{ fontSize: 12, gap: 8 }}>
          <Search size={12} /> Search files or commands  <span className="bl-kbd">Ctrl+P</span>
        </button>
        <div style={{ flex: 1 }} />
        <button className="bl-btn ghost" onClick={() => setSettingsOpen(true)} title="Settings" data-testid="settings-btn">
          <SettingsIcon size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Activity bar */}
        <div className="bl-activity">
          {SIDE_VIEWS.map((v) => {
            const Icon = v.icon;
            const active = sideView === v.id;
            return (
              <button
                key={v.id}
                title={v.label}
                className={active ? "active" : ""}
                onClick={() => setSideView(active ? null : v.id)}
                data-testid={`activity-${v.id}`}
              >
                <Icon size={18} />
              </button>
            );
          })}
          <button title="Toggle Terminal (Ctrl+J)" className={showBottom ? "active" : ""} onClick={() => setShowBottom((v) => !v)} data-testid="activity-terminal">
            <TerminalIcon size={18} />
          </button>
          <button title="Toggle AI Chat (Ctrl+Shift+L)" className={showChat ? "active" : ""} onClick={() => setShowChat((v) => !v)} data-testid="activity-chat-toggle">
            <Sparkles size={18} />
          </button>
          <div style={{ flex: 1 }} />
          <button title="Settings (Ctrl+,)" onClick={() => setSettingsOpen(true)}><SettingsIcon size={18} /></button>
        </div>

        {/* Main panel group */}
        <PanelGroup direction="horizontal" style={{ flex: 1 }}>
          {sideView && (
            <>
              <Panel defaultSize={18} minSize={12} maxSize={40}>
                {sideView === "explorer" && <FileExplorer onOpenFile={openFile} />}
                {sideView === "search" && <SearchPanel onOpenFile={openFile} />}
                {sideView === "git" && <GitPanel />}
                {sideView === "ai" && (
                  <div className="bl-side">
                    <div className="bl-side-header">AI Sessions</div>
                    <div style={{ padding: 12, fontSize: 12, color: "var(--fg-muted)" }}>
                      The full AI chat opens on the right panel. Use <span className="bl-kbd">Ctrl+Shift+L</span> to focus.
                    </div>
                  </div>
                )}
              </Panel>
              <PanelResizeHandle style={{ width: 3 }} />
            </>
          )}

          <Panel minSize={30}>
            <PanelGroup direction="horizontal">
              <Panel minSize={20}>
                <PanelGroup direction="vertical">
                  <Panel minSize={20}>
                    <EditorArea
                      openFiles={openFiles}
                      activeIndex={activeIndex}
                      setActiveIndex={setActiveIndex}
                      closeFile={closeFile}
                      updateFileContent={updateContent}
                      saveFile={saveActive}
                      registerEditorApi={(api) => (editorApi.current = api)}
                    />
                  </Panel>
                  {showBottom && (
                    <>
                      <PanelResizeHandle style={{ height: 3 }} />
                      <Panel defaultSize={28} minSize={10} maxSize={60}>
                        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--panel)" }}>
                          <div className="bl-bottom-tabs" data-testid="bottom-tabs">
                            <button
                              className={`bl-bottom-tab ${bottomTab === "terminal" ? "active" : ""}`}
                              onClick={() => setBottomTab("terminal")}
                              data-testid="tab-terminal"
                            >
                              <TerminalIcon size={11} /> Terminal
                            </button>
                            <button
                              className={`bl-bottom-tab ${bottomTab === "problems" ? "active" : ""}`}
                              onClick={() => setBottomTab("problems")}
                              data-testid="tab-problems"
                            >
                              <AlertTriangle size={11} /> Problems
                            </button>
                            <button
                              className={`bl-bottom-tab ${bottomTab === "output" ? "active" : ""}`}
                              onClick={() => setBottomTab("output")}
                              data-testid="tab-output"
                            >
                              <FileWarning size={11} /> Output
                            </button>
                            <div style={{ flex: 1 }} />
                            <button className="bl-btn ghost" onClick={() => setShowBottom(false)} title="Hide" style={{ padding: 4, height: 22, width: 22 }}>
                              ×
                            </button>
                          </div>
                          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
                            <div style={{ display: bottomTab === "terminal" ? "flex" : "none", flex: 1 }}>
                              <TerminalView visible={bottomTab === "terminal"} />
                            </div>
                            {bottomTab === "problems" && (
                              <div style={{ padding: 20, color: "var(--fg-muted)", fontSize: 13 }}>
                                <AlertTriangle size={14} style={{ marginRight: 6 }} /> No problems detected. Use <span className="bl-kbd">Right-click → Fix errors</span> for AI-powered fixes.
                              </div>
                            )}
                            {bottomTab === "output" && (
                              <div style={{ padding: 20, color: "var(--fg-muted)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                                Forge output stream. Run commands in the integrated Terminal.
                              </div>
                            )}
                          </div>
                        </div>
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </Panel>
              {showChat && (
                <>
                  <PanelResizeHandle style={{ width: 3 }} />
                  <Panel defaultSize={chatMax ? 55 : 28} minSize={20} maxSize={70}>
                    <ChatPanel getContext={getChatContext} onFilesChanged={refreshFileList} />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Status bar */}
      <div className="bl-status" data-testid="status-bar">
        <span className="item accent"><Activity size={11} /> Forge</span>
        {ctxFile && (
          <>
            <span className="item">{ctxFile.path}</span>
            <span className="item">{ctxFile.language}</span>
            <span className="item">{ctxFile.dirty ? "● Unsaved" : "Saved"}</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="item" onClick={() => setShowBottom((v) => !v)} title="Toggle terminal (Ctrl+J)" data-testid="status-terminal-toggle" style={{ background: "transparent", border: 0, cursor: "pointer", color: showBottom ? "var(--accent)" : "var(--fg-muted)" }}>
          <TerminalIcon size={11} /> Terminal
        </button>
        <button className="item" onClick={() => setShowChat((v) => !v)} title="Toggle AI Chat (Ctrl+Shift+L)" data-testid="status-chat-toggle" style={{ background: "transparent", border: 0, cursor: "pointer", color: showChat ? "var(--accent)" : "var(--fg-muted)" }}>
          <Sparkles size={11} /> AI
        </button>
        <span className="item"><MessageSquare size={11} /> {settings.model.split("/").pop()}</span>
        <span className="item">UTF-8</span>
        <span className="item">{settings.theme}</span>
      </div>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        commands={commands}
        onPickFile={(p) => openFile({ path: p, name: p.split("/").pop(), is_dir: false })}
        fileList={allFiles}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toaster position="bottom-right" theme={settings.theme === "light" ? "light" : "dark"} />
    </div>
  );
}
