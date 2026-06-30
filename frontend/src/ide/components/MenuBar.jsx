/** VS Code-style top menu bar with dropdown menus. */
import { useEffect, useRef, useState } from "react";

const MENUS = (cmd) => ({
  File: [
    { label: "Open Folder…", shortcut: "Ctrl+Shift+O", run: () => { if (window.forge?.isElectron) window.forge.openFolder(); else alert("Open Folder works in the Electron desktop build."); } },
    { label: "New File", shortcut: "Ctrl+N", run: () => cmd.run("new-file") },
    { label: "New Folder", shortcut: "Ctrl+Alt+A", run: () => cmd.run("new-folder") },
    { kind: "sep" },
    { label: "Save", shortcut: "Ctrl+S", run: () => cmd.run("save") },
    { label: "Auto Save", run: () => cmd.run("toggle-autosave"), check: cmd.state.autoSave },
    { kind: "sep" },
    { label: "Settings", shortcut: "Ctrl+,", run: () => cmd.run("settings") },
  ],
  Edit: [
    { label: "Undo", shortcut: "Ctrl+Z", run: () => cmd.run("editor", "undo") },
    { label: "Redo", shortcut: "Ctrl+Shift+Z", run: () => cmd.run("editor", "redo") },
    { kind: "sep" },
    { label: "Find", shortcut: "Ctrl+F", run: () => cmd.run("find") },
    { label: "Replace", shortcut: "Ctrl+H", run: () => cmd.run("replace") },
  ],
  Selection: [
    { label: "Select All", shortcut: "Ctrl+A", run: () => cmd.run("editor", "selectAll") },
    { label: "Expand Selection", shortcut: "Shift+Alt+→", run: () => cmd.run("editor", "editor.action.smartSelect.expand") },
    { label: "Add Cursor Above", shortcut: "Ctrl+Alt+↑", run: () => cmd.run("editor", "editor.action.insertCursorAbove") },
    { label: "Add Cursor Below", shortcut: "Ctrl+Alt+↓", run: () => cmd.run("editor", "editor.action.insertCursorBelow") },
    { label: "Column Selection Mode", run: () => cmd.run("editor", "editor.action.toggleColumnSelection") },
  ],
  View: [
    { label: "Command Palette", shortcut: "Ctrl+Shift+P", run: () => cmd.run("cmd-palette") },
    { kind: "sep" },
    { label: "Toggle Terminal", shortcut: "Ctrl+J", run: () => cmd.run("toggle-terminal") },
    { label: "Toggle AI Chat", shortcut: "Ctrl+Shift+L", run: () => cmd.run("toggle-chat") },
    { label: "Toggle Explorer", shortcut: "Ctrl+B", run: () => cmd.run("toggle-explorer") },
    { kind: "sep" },
    { label: "Theme: Dark", run: () => cmd.run("theme", "dark"), check: cmd.state.theme === "dark" },
    { label: "Theme: Light", run: () => cmd.run("theme", "light"), check: cmd.state.theme === "light" },
    { label: "Theme: Vintage", run: () => cmd.run("theme", "vintage"), check: cmd.state.theme === "vintage" },
  ],
  Go: [
    { label: "Go to File…", shortcut: "Ctrl+P", run: () => cmd.run("cmd-palette") },
    { label: "Go to Definition", shortcut: "F12", run: () => cmd.run("editor", "editor.action.revealDefinition") },
    { label: "Go to Line/Column", shortcut: "Ctrl+G", run: () => cmd.run("editor", "editor.action.gotoLine") },
    { label: "Rename Symbol", shortcut: "F2", run: () => cmd.run("editor", "editor.action.rename") },
    { label: "Find All References", shortcut: "Shift+F12", run: () => cmd.run("editor", "editor.action.goToReferences") },
  ],
  Run: [
    { label: "Run in Terminal", run: () => cmd.run("run-in-terminal") },
    { label: "Open Terminal", shortcut: "Ctrl+J", run: () => cmd.run("toggle-terminal") },
  ],
  AI: [
    { label: "New Chat", shortcut: "Ctrl+Shift+L", run: () => cmd.run("new-chat") },
    { label: "Maximize Chat", shortcut: "Ctrl+Alt+E", run: () => cmd.run("max-chat") },
    { label: "Inline Edit", shortcut: "Ctrl+K", run: () => cmd.run("editor-trigger", "bloom.inline-edit") },
    { kind: "sep" },
    { label: "Explain Selection", run: () => cmd.run("editor-trigger", "bloom.explain") },
    { label: "Refactor Selection", run: () => cmd.run("editor-trigger", "bloom.refactor") },
    { label: "Generate Tests", run: () => cmd.run("editor-trigger", "bloom.tests") },
    { label: "Fix Errors", run: () => cmd.run("editor-trigger", "bloom.fix") },
  ],
  Help: [
    { label: "Keyboard Shortcuts", run: () => cmd.run("shortcuts") },
    { label: "About Forge", run: () => alert("Forge — AI-native IDE\nv1.0.0\nNVIDIA NIM powered.") },
  ],
});

export default function MenuBar({ cmd }) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  const menus = MENUS(cmd);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 0, height: "100%" }} data-testid="menu-bar">
      {Object.keys(menus).map((name) => {
        const items = menus[name];
        const isOpen = open === name;
        return (
          <div key={name} style={{ position: "relative", height: "100%" }}>
            <button
              data-testid={`menu-${name.toLowerCase()}`}
              onMouseDown={(e) => { e.preventDefault(); setOpen((o) => o === name ? null : name); }}
              onMouseEnter={() => { if (open !== null) setOpen(name); }}
              style={{
                height: "100%", padding: "0 10px", fontSize: 12, color: "var(--fg)",
                background: isOpen ? "var(--bg-elev)" : "transparent",
                border: 0, cursor: "pointer", letterSpacing: "0.01em",
              }}
            >
              {name}
            </button>
            {isOpen && (
              <div
                style={{
                  position: "absolute", top: "100%", left: 0, minWidth: 240,
                  background: "var(--bg-elev)", border: "1px solid var(--border-strong)",
                  borderRadius: 8, padding: 4, boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                  zIndex: 100, marginTop: 2,
                }}
              >
                {items.map((it, i) => it.kind === "sep" ? (
                  <div key={i} style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                ) : (
                  <button
                    key={i}
                    onClick={() => { setOpen(null); it.run(); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "6px 10px", fontSize: 12, color: "var(--fg)",
                      background: "transparent", border: 0, borderRadius: 6, cursor: "pointer",
                      textAlign: "left", gap: 12,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 12, color: "var(--accent)" }}>{it.check ? "✓" : ""}</span>
                      {it.label}
                    </span>
                    {it.shortcut && <span style={{ color: "var(--fg-dim)", fontSize: 11 }}>{it.shortcut}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
