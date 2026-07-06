import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { NVIDIA_MODELS, PROVIDER_GROUPS, type NvidiaModel } from "@/integrations/nvidia";
import { ProviderIcon } from "./ProviderIcon";

export function ModelSelector({
  model,
  onSelect,
  align = "right",
}: {
  model: NvidiaModel;
  onSelect: (m: NvidiaModel) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = NVIDIA_MODELS[model];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-elevated/70 px-2.5 py-1 text-[11px] font-medium hover:bg-elevated transition-colors"
      >
        <ProviderIcon provider={current.provider} model={model} size={12} />
        {current.label}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1 w-56 rounded-xl border border-border bg-elevated shadow-xl z-50 overflow-hidden ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {PROVIDER_GROUPS.map((group) => (
            <div key={group.provider}>
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-text-muted">
                <ProviderIcon provider={group.provider} size={10} />
                {group.label}
              </div>
              {group.models.map((key) => {
                const info = NVIDIA_MODELS[key];
                const isGlm52 = key === "z-ai/glm-5.2";
                return (
                  <button
                    key={key}
                    onClick={() => {
                      onSelect(key);
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 transition-colors hover:bg-muted/50 ${
                      model === key ? "bg-muted/80 font-medium text-foreground" : "text-foreground/80"
                    } ${isGlm52 ? "relative font-semibold text-amber-500 hover:text-amber-400" : ""}`}
                    style={isGlm52 ? { textShadow: "0 0 8px rgba(245, 158, 11, 0.4)" } : undefined}
                  >
                    <ProviderIcon provider={info.provider} model={key} size={14} />
                    {info.label}
                    {isGlm52 && (
                      <span className="ml-auto text-[8px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse font-bold tracking-wider uppercase">
                        Strong
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
