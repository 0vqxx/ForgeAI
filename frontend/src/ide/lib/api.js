/** Backend API client + helpers. */
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fsApi = {
  tree: (path = "") => api.get("/fs/tree", { params: { path } }).then((r) => r.data),
  read: (path) => api.get("/fs/read", { params: { path } }).then((r) => r.data),
  write: (path, content) => api.post("/fs/write", { path, content }).then((r) => r.data),
  create: (path, is_dir = false) => api.post("/fs/create", { path, is_dir }).then((r) => r.data),
  rename: (path, new_path) => api.post("/fs/rename", { path, new_path }).then((r) => r.data),
  remove: (path) => api.delete("/fs/delete", { params: { path } }).then((r) => r.data),
  search: (query) => api.post("/fs/search", { query }).then((r) => r.data),
  upload: (file, dest = "") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dest", dest);
    return api.post("/fs/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
};

export const aiApi = {
  models: () => api.get("/ai/models").then((r) => r.data),
  complete: (body) => api.post("/ai/complete", body).then((r) => r.data),
  edit: (body) => api.post("/ai/edit", body).then((r) => r.data),
  explain: (body) => api.post("/ai/explain", body).then((r) => r.data),
  refactor: (body) => api.post("/ai/refactor", body).then((r) => r.data),
  docs: (body) => api.post("/ai/docs", body).then((r) => r.data),
  tests: (body) => api.post("/ai/tests", body).then((r) => r.data),
  fix: (body) => api.post("/ai/fix", body).then((r) => r.data),
  generate: (body) => api.post("/ai/generate", body).then((r) => r.data),
  commitMessage: (body) => api.post("/ai/commit-message", body).then((r) => r.data),
};

export const gitApi = {
  status: () => api.get("/git/status").then((r) => r.data),
  diff: (path = "") => api.get("/git/diff", { params: { path } }).then((r) => r.data),
  init: () => api.post("/git/init").then((r) => r.data),
  commit: (message) => api.post("/git/commit", { message }).then((r) => r.data),
};

/** Stream chat completions via SSE. */
export async function streamChat({ model, messages, system, signal, onDelta, onError }) {
  try {
    const res = await fetch(`${API}/ai/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, system, temperature: 0.2, max_tokens: 3000 }),
      signal,
    });
    if (!res.ok || !res.body) {
      onError?.(new Error(`HTTP ${res.status}`));
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const block of lines) {
        const line = block.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const obj = JSON.parse(data);
          if (obj.delta) onDelta?.(obj.delta);
          if (obj.error) onError?.(new Error(obj.error));
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") onError?.(err);
  }
}

export function wsURL(path) {
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}${path}`;
}

/** Map filename to Monaco language id. */
export function detectLanguage(filename = "") {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python",
    cs: "csharp",
    cpp: "cpp", cc: "cpp", cxx: "cpp", h: "cpp", hpp: "cpp",
    c: "c",
    java: "java",
    rs: "rust",
    go: "go",
    html: "html", htm: "html",
    css: "css", scss: "scss",
    json: "json",
    yaml: "yaml", yml: "yaml",
    md: "markdown", markdown: "markdown",
    sh: "shell", bash: "shell",
    rb: "ruby",
    php: "php",
    sql: "sql",
    xml: "xml",
    toml: "ini",
  };
  return map[ext] || "plaintext";
}
