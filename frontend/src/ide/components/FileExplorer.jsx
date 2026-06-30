/** File explorer — flat iterative tree (no recursive component) to avoid babel plugin recursion. */
import { useEffect, useState, useCallback } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FilePlus, FolderPlus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { fsApi } from "../lib/api";
import { toast } from "sonner";

export default function FileExplorer({ onOpenFile }) {
  const [rootEntries, setRootEntries] = useState([]);
  const [childCache, setChildCache] = useState({}); // path -> entries[]
  const [expanded, setExpanded] = useState({}); // path -> bool
  const [selected, setSelected] = useState(null);
  const [renamePath, setRenamePath] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const refreshPath = useCallback(async (path) => {
    const data = await fsApi.tree(path);
    if (!path) setRootEntries(data.entries);
    setChildCache((c) => ({ ...c, [path]: data.entries }));
  }, []);

  useEffect(() => { refreshPath(""); }, [refreshPath]);

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    for (const f of files) {
      try {
        await fsApi.upload(f, "");
        toast.success(`Imported ${f.name}`);
      } catch (err) {
        toast.error(`Failed: ${f.name}`);
      }
    }
    refreshPath("");
  };

  const toggleDir = async (node) => {
    const isOpen = !!expanded[node.path];
    setExpanded((e) => ({ ...e, [node.path]: !isOpen }));
    if (!isOpen && !childCache[node.path]) {
      await refreshPath(node.path);
    }
  };

  const onRowClick = (node) => {
    setSelected(node.path);
    if (node.is_dir) toggleDir(node);
    else onOpenFile(node);
  };

  const handleDelete = async (e, node) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${node.name}?`)) return;
    try {
      await fsApi.remove(node.path);
      toast.success(`Deleted ${node.name}`);
      // refresh parent
      const parent = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : "";
      await refreshPath(parent);
    } catch { toast.error("Delete failed"); }
  };

  const startRename = (e, node) => {
    e.stopPropagation();
    setRenamePath(node.path);
    setRenameValue(node.name);
  };

  const commitRename = async (node) => {
    if (!renameValue || renameValue === node.name) { setRenamePath(null); return; }
    const parent = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : "";
    const newPath = parent ? `${parent}/${renameValue}` : renameValue;
    try {
      await fsApi.rename(node.path, newPath);
      toast.success("Renamed");
      setRenamePath(null);
      await refreshPath(parent);
    } catch { toast.error("Rename failed"); }
  };

  const createFile = async () => {
    const name = window.prompt("New file name (e.g. src/app.js):");
    if (!name) return;
    try { await fsApi.create(name, false); toast.success(`Created ${name}`); refreshPath(""); }
    catch (err) { toast.error(err.response?.data?.detail || "Create failed"); }
  };

  const createFolder = async () => {
    const name = window.prompt("New folder name:");
    if (!name) return;
    try { await fsApi.create(name, true); toast.success(`Created ${name}/`); refreshPath(""); }
    catch (err) { toast.error(err.response?.data?.detail || "Create failed"); }
  };

  // Flatten tree based on expansion state
  const flat = [];
  const walk = (entries, depth) => {
    for (const node of entries) {
      flat.push({ ...node, depth });
      if (node.is_dir && expanded[node.path] && childCache[node.path]) {
        walk(childCache[node.path], depth + 1);
      }
    }
  };
  walk(rootEntries, 0);

  return (
    <div
      className="bl-side"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      style={isDragging ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : {}}
    >
      <div className="bl-side-header">
        <span>Explorer</span>
        <span style={{ display: "flex", gap: 2 }}>
          <button className="bl-btn ghost" style={{ padding: 4, height: 22, width: 22 }} onClick={createFile} title="New file" data-testid="new-file-btn">
            <FilePlus size={13} />
          </button>
          <button className="bl-btn ghost" style={{ padding: 4, height: 22, width: 22 }} onClick={createFolder} title="New folder" data-testid="new-folder-btn">
            <FolderPlus size={13} />
          </button>
          <button className="bl-btn ghost" style={{ padding: 4, height: 22, width: 22 }} onClick={() => refreshPath("")} title="Refresh" data-testid="refresh-tree-btn">
            <RefreshCw size={13} />
          </button>
        </span>
      </div>
      {isDragging && (
        <div style={{ padding: 12, fontSize: 12, color: "var(--accent)", textAlign: "center", borderBottom: "1px solid var(--accent)", background: "var(--accent-soft)" }}>
          Drop files to import into workspace
        </div>
      )}
      <div className="bl-tree" data-testid="file-tree">
        {flat.map((node) => {
          const isOpen = !!expanded[node.path];
          return (
            <div
              key={node.path}
              className={`bl-tree-row ${selected === node.path ? "selected" : ""}`}
              style={{ paddingLeft: 8 + node.depth * 12 }}
              onClick={() => onRowClick(node)}
              data-testid={`tree-${node.path}`}
            >
              {node.is_dir ? (
                <span className="ico">{isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
              ) : (
                <span className="ico" style={{ width: 12 }} />
              )}
              <span className="ico" style={{ color: node.is_dir ? "var(--accent)" : "var(--fg-muted)" }}>
                {node.is_dir ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />) : <File size={14} />}
              </span>
              {renamePath === node.path ? (
                <input
                  autoFocus
                  className="bl-input"
                  style={{ padding: "0 6px", height: 22, fontSize: 12 }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(node)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(node);
                    if (e.key === "Escape") setRenamePath(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="name" style={{ flex: 1 }}>{node.name}</span>
              )}
              <span style={{ display: "flex", gap: 2, opacity: 0.7, paddingRight: 6 }} onClick={(e) => e.stopPropagation()}>
                <button className="bl-btn ghost" style={{ padding: 2, height: 20, width: 20 }} onClick={(e) => startRename(e, node)}>
                  <Pencil size={11} />
                </button>
                <button className="bl-btn ghost" style={{ padding: 2, height: 20, width: 20 }} onClick={(e) => handleDelete(e, node)}>
                  <Trash2 size={11} />
                </button>
              </span>
            </div>
          );
        })}
        {flat.length === 0 && (
          <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--fg-dim)" }}>
            Empty workspace — create a file to begin.
          </div>
        )}
      </div>
    </div>
  );
}
