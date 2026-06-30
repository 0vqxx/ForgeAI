/** Settings dialog. */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSettings } from "../lib/store";
import { aiApi } from "../lib/api";

const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "vintage", label: "Vintage" },
];

const FONTS = [
  "JetBrains Mono",
  "Fira Code",
  "SF Mono",
  "Menlo",
  "Consolas",
  "IBM Plex Mono",
];

export default function SettingsDialog({ open, onClose }) {
  const s = useSettings();
  const [models, setModels] = useState([]);
  useEffect(() => { if (open) aiApi.models().then((d) => setModels(d.models || [])); }, [open]);
  if (!open) return null;
  return (
    <div className="bl-cmd-overlay" onClick={onClose}>
      <div className="bl-cmd" style={{ width: "min(560px, 92vw)", padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Settings</div>
          <button className="bl-btn ghost" style={{ padding: 4, height: 26, width: 26 }} onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, maxHeight: "60vh", overflowY: "auto" }}>
          <Field label="Theme">
            <div style={{ display: "flex", gap: 6 }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  data-testid={`theme-${t.id}`}
                  className={`bl-btn ${s.theme === t.id ? "primary" : ""}`}
                  onClick={() => s.set({ theme: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="AI Model">
            <select className="bl-input" value={s.model} onChange={(e) => s.set({ model: e.target.value })} data-testid="settings-model-select">
              {models.map((m) => (<option key={m.id} value={m.id}>{m.label} — {m.description}</option>))}
            </select>
          </Field>
          <Field label="Editor Font">
            <select className="bl-input" value={s.fontFamily} onChange={(e) => s.set({ fontFamily: e.target.value })}>
              {FONTS.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
          </Field>
          <Field label={`Font size: ${s.fontSize}px`}>
            <input type="range" min={10} max={22} value={s.fontSize} onChange={(e) => s.set({ fontSize: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label={`Tab size: ${s.tabSize}`}>
            <input type="range" min={2} max={8} step={2} value={s.tabSize} onChange={(e) => s.set({ tabSize: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label="Word wrap">
            <select className="bl-input" value={s.wordWrap} onChange={(e) => s.set({ wordWrap: e.target.value })}>
              <option value="on">On</option>
              <option value="off">Off</option>
              <option value="wordWrapColumn">Column</option>
            </select>
          </Field>
          <Field label="AI ghost-text autocomplete">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={s.ghostText} onChange={(e) => s.set({ ghostText: e.target.checked })} /> Enable
            </label>
          </Field>
          <Field label="Auto save">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={s.autoSave} onChange={(e) => s.set({ autoSave: e.target.checked })} /> Save on change (debounced)
            </label>
          </Field>
          <Field label="Terminal shell">
            <input className="bl-input" value={s.terminalShell} onChange={(e) => s.set({ terminalShell: e.target.value })} />
          </Field>
          <button className="bl-btn" onClick={s.reset}>Reset to defaults</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      {children}
    </div>
  );
}
