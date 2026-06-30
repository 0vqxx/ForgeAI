/** Monaco editor wrapper with tabs, ghost-text autocomplete, inline edit, and context actions. */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { X, Sparkles, FileText } from "lucide-react";
import { fsApi, aiApi, detectLanguage } from "../lib/api";
import { useSettings } from "../lib/store";
import { toast } from "sonner";

// Configure Monaco workers (use CDN to avoid bundling)
loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs" } });

const VINTAGE_THEME = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "8a7d5b", fontStyle: "italic" },
    { token: "keyword", foreground: "5f7a3a", fontStyle: "bold" },
    { token: "string", foreground: "9a5a2b" },
    { token: "number", foreground: "8a4a1f" },
    { token: "type", foreground: "4f6a2a" },
  ],
  colors: {
    "editor.background": "#f8f2e4",
    "editor.foreground": "#3b3422",
    "editorLineNumber.foreground": "#a5946a",
    "editor.selectionBackground": "#dfd3a8",
    "editor.lineHighlightBackground": "#efe7d3",
    "editorCursor.foreground": "#5f7a3a",
  },
};

const DARK_THEME = {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#09090b",
    "editor.foreground": "#e9e9ee",
    "editorLineNumber.foreground": "#3a3a44",
    "editorLineNumber.activeForeground": "#8b8b95",
    "editor.lineHighlightBackground": "#111114",
    "editor.selectionBackground": "#ea580c3a",
    "editorCursor.foreground": "#ea580c",
    "editorGutter.background": "#09090b",
  },
};

export default function EditorArea({
  openFiles,
  activeIndex,
  setActiveIndex,
  closeFile,
  updateFileContent,
  saveFile,
  registerEditorApi,
}) {
  const settings = useSettings();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [ghost, setGhost] = useState(null); // { decorationId, suggestion, line, col }
  const ghostDecRef = useRef([]);
  const debounceRef = useRef(null);
  const [inlineEdit, setInlineEdit] = useState(null); // { selection, instruction }
  const [editing, setEditing] = useState(false);

  const file = openFiles[activeIndex];

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.defineTheme("bloom-dark", DARK_THEME);
    monaco.editor.defineTheme("bloom-vintage", VINTAGE_THEME);
    applyTheme();

    // Ctrl+S save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveFile?.());
    // Tab accepts ghost text
    editor.addCommand(monaco.KeyCode.Tab, () => {
      if (ghost?.suggestion) {
        acceptGhost();
      } else {
        editor.trigger("keyboard", "tab", null);
      }
    });
    // Escape dismisses ghost
    editor.addCommand(monaco.KeyCode.Escape, () => {
      if (ghost) dismissGhost();
    });
    // Inline edit (Ctrl+K)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const sel = editor.getSelection();
      const text = editor.getModel().getValueInRange(sel);
      if (!text) { toast("Select code first"); return; }
      const instruction = window.prompt("Describe the change…");
      if (!instruction) return;
      runInlineEdit(text, instruction, sel);
    });
    // Context menu actions
    editor.addAction({
      id: "bloom.explain",
      label: "BloomIDE: Explain selection",
      contextMenuGroupId: "bloom",
      contextMenuOrder: 1,
      run: () => runContextAction("explain"),
    });
    editor.addAction({
      id: "bloom.refactor",
      label: "BloomIDE: Refactor selection",
      contextMenuGroupId: "bloom",
      contextMenuOrder: 2,
      run: () => runContextAction("refactor"),
    });
    editor.addAction({
      id: "bloom.docs",
      label: "BloomIDE: Generate docs",
      contextMenuGroupId: "bloom",
      contextMenuOrder: 3,
      run: () => runContextAction("docs"),
    });
    editor.addAction({
      id: "bloom.tests",
      label: "BloomIDE: Generate tests",
      contextMenuGroupId: "bloom",
      contextMenuOrder: 4,
      run: () => runContextAction("tests"),
    });
    editor.addAction({
      id: "bloom.fix",
      label: "BloomIDE: Fix errors",
      contextMenuGroupId: "bloom",
      contextMenuOrder: 5,
      run: () => runContextAction("fix"),
    });
    editor.addAction({
      id: "bloom.rename",
      label: "Rename symbol",
      keybindings: [monaco.KeyCode.F2],
      contextMenuGroupId: "navigation",
      run: () => editor.trigger("keyboard", "editor.action.rename", null),
    });

    registerEditorApi?.({
      getEditor: () => editorRef.current,
      getMonaco: () => monacoRef.current,
      focus: () => editor.focus(),
      revealLine: (line) => editor.revealLineInCenter(line),
      openFind: () => editor.trigger("keyboard", "actions.find", null),
      openReplace: () => editor.trigger("keyboard", "editor.action.startFindReplaceAction", null),
      goToDefinition: () => editor.trigger("keyboard", "editor.action.revealDefinition", null),
      rename: () => editor.trigger("keyboard", "editor.action.rename", null),
    });
  };

  const applyTheme = useCallback(() => {
    if (!monacoRef.current) return;
    if (settings.theme === "vintage") monacoRef.current.editor.setTheme("bloom-vintage");
    else if (settings.theme === "light") monacoRef.current.editor.setTheme("vs");
    else monacoRef.current.editor.setTheme("bloom-dark");
  }, [settings.theme]);

  useEffect(() => { applyTheme(); }, [applyTheme]);

  // Reveal a specific line when requested
  useEffect(() => {
    if (file?.line && editorRef.current) {
      editorRef.current.revealLineInCenter(file.line);
      editorRef.current.setPosition({ lineNumber: file.line, column: 1 });
    }
  }, [activeIndex, file?.line]);

  const dismissGhost = () => {
    if (editorRef.current && ghostDecRef.current.length) {
      ghostDecRef.current = editorRef.current.deltaDecorations(ghostDecRef.current, []);
    }
    setGhost(null);
  };

  const acceptGhost = () => {
    if (!ghost || !editorRef.current) return;
    const editor = editorRef.current;
    const pos = editor.getPosition();
    editor.executeEdits("ghost", [{
      range: { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column },
      text: ghost.suggestion,
      forceMoveMarkers: true,
    }]);
    dismissGhost();
  };

  const triggerGhost = useCallback(async () => {
    if (!settings.ghostText) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !file) return;
    const model = editor.getModel();
    const pos = editor.getPosition();
    if (!model || !pos) return;
    const prefix = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: pos.lineNumber, endColumn: pos.column });
    const last = model.getLineCount();
    const lastCol = model.getLineMaxColumn(last);
    const suffix = model.getValueInRange({ startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: last, endColumn: lastCol });
    try {
      const { completion } = await aiApi.complete({ model: settings.model, prefix, suffix, language: file.language });
      if (!completion || !editorRef.current) return;
      // ensure cursor hasn't moved much
      const cur = editor.getPosition();
      if (cur.lineNumber !== pos.lineNumber || cur.column !== pos.column) return;
      ghostDecRef.current = editor.deltaDecorations(ghostDecRef.current, [{
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        options: { after: { content: completion.split("\n")[0], inlineClassName: "bl-ghost" } },
      }]);
      setGhost({ suggestion: completion, line: pos.lineNumber, col: pos.column });
    } catch {
      /* ignore */
    }
  }, [settings.ghostText, settings.model, file]);

  const onChange = (val) => {
    if (file) updateFileContent(activeIndex, val ?? "");
    dismissGhost();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (settings.ghostText) {
      debounceRef.current = setTimeout(triggerGhost, 600);
    }
  };

  const runContextAction = async (action) => {
    const editor = editorRef.current;
    if (!editor || !file) return;
    const sel = editor.getSelection();
    const text = editor.getModel().getValueInRange(sel) || editor.getValue();
    setEditing(true);
    try {
      if (action === "explain") {
        const { explanation } = await aiApi.explain({ model: settings.model, code: text, language: file.language });
        toast(explanation.slice(0, 200), { duration: 9000, description: "See AI panel for full response" });
      } else {
        const fn = { refactor: aiApi.refactor, docs: aiApi.docs, tests: aiApi.tests, fix: aiApi.fix }[action];
        const { code } = await fn({ model: settings.model, code: text, language: file.language });
        if (action === "tests") {
          // open new file
          const testName = file.path.replace(/(\.[^./]+)?$/, ".test$1");
          await fsApi.write(testName, code);
          toast.success(`Tests written to ${testName}`);
        } else {
          editor.executeEdits("ai-" + action, [{ range: sel, text: code, forceMoveMarkers: true }]);
          toast.success(`AI ${action} applied`);
        }
      }
    } catch (err) {
      toast.error("AI action failed");
    } finally { setEditing(false); }
  };

  const runInlineEdit = async (text, instruction, sel) => {
    setEditing(true);
    try {
      const { code } = await aiApi.edit({ model: settings.model, code: text, instruction, language: file.language });
      editorRef.current.executeEdits("ai-edit", [{ range: sel, text: code, forceMoveMarkers: true }]);
      toast.success("Applied AI edit");
    } catch (err) { toast.error("AI edit failed"); }
    finally { setEditing(false); }
  };

  const options = useMemo(() => ({
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    tabSize: settings.tabSize,
    wordWrap: settings.wordWrap,
    minimap: { enabled: true },
    smoothScrolling: true,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    fontLigatures: true,
    automaticLayout: true,
    padding: { top: 12, bottom: 12 },
    scrollBeyondLastLine: false,
    bracketPairColorization: { enabled: true },
    renderLineHighlight: "all",
  }), [settings.fontFamily, settings.fontSize, settings.tabSize, settings.wordWrap]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0, flex: 1 }}>
      <div className="bl-tab-row" data-testid="editor-tabs">
        {openFiles.map((f, i) => (
          <div
            key={f.path + i}
            className={`bl-tab ${i === activeIndex ? "active" : ""}`}
            onClick={() => setActiveIndex(i)}
            data-testid={`tab-${f.path}`}
          >
            <FileText size={11} />
            <span>{f.name}</span>
            {f.dirty && <span className="dot" />}
            <span className="x" onClick={(e) => { e.stopPropagation(); closeFile(i); }}>
              <X size={11} />
            </span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {!file ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", color: "var(--fg-dim)", gap: 12 }}>
            <img src="https://customer-assets.emergentagent.com/job_bloom-dev/artifacts/9wzw7jmx_ChatGPT%20Image%20Jun%2029%2C%202026%2C%2010_35_48%20PM.png" alt="Forge" style={{ width: 80, height: 80, opacity: 0.6 }} />
            <div style={{ fontSize: 18, color: "var(--fg)", fontWeight: 500 }}>Forge</div>
            <div style={{ fontSize: 12 }}>Open a file from the Explorer or press <span className="bl-kbd">Ctrl+P</span> for command palette</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Drag-and-drop files into the Explorer to import them</div>
          </div>
        ) : (
          <Editor
            height="100%"
            language={file.language}
            value={file.content}
            onChange={onChange}
            onMount={onMount}
            options={options}
            theme={settings.theme === "vintage" ? "bloom-vintage" : settings.theme === "light" ? "vs" : "bloom-dark"}
          />
        )}
        {editing && (
          <div style={{ position: "absolute", top: 10, right: 14, background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8, fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={12} /> Thinking…
          </div>
        )}
      </div>
    </div>
  );
}
