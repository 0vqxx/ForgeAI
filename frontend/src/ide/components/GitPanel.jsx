/** Git panel - status, diff preview, AI-generated commit message. */
import { useEffect, useState } from "react";
import { GitBranch, RefreshCw, Sparkles, GitCommit } from "lucide-react";
import { gitApi, aiApi } from "../lib/api";
import { useSettings } from "../lib/store";
import { toast } from "sonner";

export default function GitPanel() {
  const [status, setStatus] = useState({ repo: false, files: [], branch: null });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const model = useSettings((s) => s.model);

  const refresh = async () => {
    try { setStatus(await gitApi.status()); } catch { /* ignore */ }
  };

  useEffect(() => { refresh(); }, []);

  const handleInit = async () => {
    setBusy(true);
    try { await gitApi.init(); await refresh(); toast.success("Initialized repo"); }
    catch { toast.error("git init failed"); }
    finally { setBusy(false); }
  };

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const d = await gitApi.diff();
      if (!d.diff) { toast("No changes to summarize"); return; }
      const r = await aiApi.commitMessage({ model, diff: d.diff });
      setMessage(r.message);
    } catch (err) { toast.error("AI commit-msg failed"); }
    finally { setBusy(false); }
  };

  const handleCommit = async () => {
    if (!message.trim()) { toast.error("Enter a message"); return; }
    setBusy(true);
    try { await gitApi.commit(message); setMessage(""); await refresh(); toast.success("Committed"); }
    catch (err) { toast.error(err.response?.data?.detail || "commit failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bl-side">
      <div className="bl-side-header">
        <span>Source Control</span>
        <button className="bl-btn ghost" style={{ padding: 4, height: 22, width: 22 }} onClick={refresh}><RefreshCw size={13} /></button>
      </div>
      {!status.repo ? (
        <div style={{ padding: 14, fontSize: 12, color: "var(--fg-muted)" }}>
          <p style={{ marginTop: 0 }}>No git repository in this workspace.</p>
          <button className="bl-btn primary" onClick={handleInit} disabled={busy} data-testid="git-init-btn">
            <GitBranch size={13} /> Initialize
          </button>
        </div>
      ) : (
        <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <GitBranch size={12} /> {status.branch || "main"}
          </div>
          <textarea
            className="bl-input"
            placeholder="Commit message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            style={{ resize: "vertical", fontFamily: "inherit" }}
            data-testid="commit-message-input"
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="bl-btn" onClick={handleGenerate} disabled={busy} data-testid="ai-commit-btn">
              <Sparkles size={12} /> AI message
            </button>
            <button className="bl-btn primary" onClick={handleCommit} disabled={busy} data-testid="commit-btn">
              <GitCommit size={12} /> Commit
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 8 }}>
            Changes ({status.files.length})
          </div>
          {status.files.length === 0 && <div style={{ fontSize: 12, color: "var(--fg-dim)" }}>No changes.</div>}
          {status.files.map((f) => (
            <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 16, textAlign: "center", color: "var(--accent)", fontWeight: 600 }}>{f.code}</span>
              <span style={{ color: "var(--fg)" }}>{f.path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
