/** Command palette - Ctrl+P / Ctrl+Shift+P. Combines file open + commands. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Command as CmdIcon } from "lucide-react";

export default function CommandPalette({ open, onClose, commands, onPickFile, fileList }) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const fileMode = query.startsWith(">") ? false : true;

  useEffect(() => {
    if (open) {
      setQuery("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.replace(/^>/, "").toLowerCase().trim();
    if (fileMode) {
      return (fileList || []).filter((f) => f.path.toLowerCase().includes(q)).slice(0, 40)
        .map((f) => ({ kind: "file", label: f.path, hint: "Open" }));
    }
    return commands.filter((c) => c.label.toLowerCase().includes(q))
      .map((c) => ({ kind: "cmd", label: c.label, hint: c.shortcut || "", run: c.run }));
  }, [query, commands, fileList, fileMode]);

  useEffect(() => { setIdx(0); }, [query]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[idx];
      if (!it) return;
      if (it.kind === "file") { onPickFile(it.label); onClose(); }
      else { it.run?.(); onClose(); }
    } else if (e.key === "Escape") { onClose(); }
  };

  if (!open) return null;
  return (
    <div className="bl-cmd-overlay" onClick={onClose}>
      <div className="bl-cmd" onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "relative" }}>
          {fileMode ? <Search size={14} style={{ position: "absolute", top: 18, left: 18, color: "var(--fg-muted)" }} /> : <CmdIcon size={14} style={{ position: "absolute", top: 18, left: 18, color: "var(--fg-muted)" }} />}
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            className="bl-cmd-input"
            placeholder={fileMode ? "Open file by name…  (type > for commands)" : "Run a command…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            style={{ paddingLeft: 42 }}
          />
        </div>
        <div className="bl-cmd-list">
          {items.length === 0 && (
            <div style={{ padding: 14, color: "var(--fg-dim)", fontSize: 12 }}>No matches</div>
          )}
          {items.map((it, i) => (
            <div
              key={i}
              className={`bl-cmd-item ${i === idx ? "active" : ""}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                if (it.kind === "file") { onPickFile(it.label); onClose(); }
                else { it.run?.(); onClose(); }
              }}
            >
              <span className="label">{it.label}</span>
              <span className="hint">{it.hint}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
