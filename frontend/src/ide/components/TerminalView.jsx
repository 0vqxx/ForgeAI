/** xterm.js integrated terminal connected via WebSocket. */
import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { wsURL } from "../lib/api";
import { useSettings } from "../lib/store";

export default function TerminalView({ visible }) {
  const ref = useRef(null);
  const settings = useSettings();
  const [mounted, setMounted] = useState(false);

  // Defer mount until container has real dimensions
  useEffect(() => {
    if (!ref.current || mounted) return;
    let raf;
    const check = () => {
      if (!ref.current) return;
      if (ref.current.clientHeight > 30 && ref.current.clientWidth > 30) {
        setMounted(true);
      } else {
        raf = requestAnimationFrame(check);
      }
    };
    check();
    return () => raf && cancelAnimationFrame(raf);
  }, [mounted, visible]);

  useEffect(() => {
    if (!mounted || !ref.current) return;
    const isLight = settings.theme === "light" || settings.theme === "vintage";
    const term = new Terminal({
      fontFamily: settings.fontFamily + ", monospace",
      fontSize: settings.fontSize,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: settings.theme === "vintage" ? "#f5efe1" : isLight ? "#ffffff" : "#09090b",
        foreground: settings.theme === "vintage" ? "#3b3422" : isLight ? "#18181b" : "#e9e9ee",
        cursor: "#ea580c",
        selectionBackground: "#ea580c3a",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(ref.current);
    // wait one frame so xterm computes dimensions before fit
    let disposed = false;
    requestAnimationFrame(() => {
      if (disposed) return;
      try { fit.fit(); } catch { /* ignore */ }
    });

    const ws = new WebSocket(wsURL("/api/terminal/ws"));
    ws.onopen = () => ws.send(JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }));
    ws.onmessage = (e) => { if (!disposed) try { term.write(e.data); } catch { /* ignore */ } };
    ws.onerror = () => term.write("\r\n\x1b[31m[terminal disconnected]\x1b[0m\r\n");

    const dataDisp = term.onData((d) => ws.readyState === 1 && ws.send(JSON.stringify({ type: "input", data: d })));
    const resizeDisp = term.onResize(({ rows, cols }) => ws.readyState === 1 && ws.send(JSON.stringify({ type: "resize", rows, cols })));

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      requestAnimationFrame(() => {
        try {
          if (ref.current && ref.current.clientHeight > 20 && ref.current.clientWidth > 20) fit.fit();
        } catch { /* ignore */ }
      });
    });
    ro.observe(ref.current);

    return () => {
      disposed = true;
      ro.disconnect();
      try { dataDisp.dispose(); } catch { /* ignore */ }
      try { resizeDisp.dispose(); } catch { /* ignore */ }
      try { ws.close(); } catch { /* ignore */ }
      try { term.dispose(); } catch { /* ignore */ }
    };
  }, [mounted, settings.theme, settings.fontFamily, settings.fontSize]);

  return <div ref={ref} style={{ width: "100%", height: "100%", padding: 8, background: "var(--panel)" }} data-testid="terminal" />;
}
