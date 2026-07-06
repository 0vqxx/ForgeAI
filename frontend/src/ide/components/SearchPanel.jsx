/** Workspace-wide search panel. */
import { useState } from "react";
import { Search } from "lucide-react";
import { fsApi } from "../lib/api";

export default function SearchPanel({ onOpenFile }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const run = async (e) => {
    e?.preventDefault?.();
    if (!q) return;
    setLoading(true);
    try {
      const data = await fsApi.search(q);
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bl-side">
      <div className="bl-side-header"><span>Search</span></div>
      <form onSubmit={run} style={{ padding: "0 12px 8px" }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", top: 9, left: 9, color: "var(--fg-muted)" }} />
          <input
            data-testid="search-input"
            className="bl-input"
            placeholder="Search files..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 28 }}
          />
        </div>
      </form>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 4px 8px", fontSize: 12 }}>
        {loading && <div style={{ padding: 10, color: "var(--fg-dim)" }}>Searching…</div>}
        {!loading && results.length === 0 && q && (
          <div style={{ padding: 10, color: "var(--fg-dim)" }}>No results.</div>
        )}
        {results.map((r) => (
          <div key={r.path} style={{ marginBottom: 8 }}>
            <div
              style={{ padding: "4px 10px", color: "var(--accent)", cursor: "pointer", fontWeight: 500 }}
              onClick={() => onOpenFile({ path: r.path, name: r.path.split("/").pop(), is_dir: false })}
            >
              {r.path}
            </div>
            {r.matches.map((m, i) => (
              <div
                key={i}
                style={{ padding: "2px 18px", color: "var(--fg-muted)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                onClick={() => onOpenFile({ path: r.path, name: r.path.split("/").pop(), is_dir: false, line: m.line })}
              >
                <span style={{ color: "var(--fg-dim)" }}>{m.line}</span>  {m.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
