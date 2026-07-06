import type { ModelProvider } from "@/integrations/nvidia";

export function ProviderIcon({ 
  provider, 
  model,
  size = 14,
  className = ""
}: { 
  provider: ModelProvider; 
  model?: string;
  size?: number;
  className?: string;
}) {
  if (model === "moonshotai/kimi-k2.6" || (provider === "moonshot" && model)) {
    return (
      <img 
        src="/kimi.svg" 
        alt="Kimi" 
        width={size} 
        height={size} 
        style={{ width: size, height: size }}
        className={`select-none ${className}`}
        draggable={false}
      />
    );
  }

  if (provider === "moonshot") {
    return (
      <img 
        src="/moonshot.svg" 
        alt="Moonshot AI" 
        width={size} 
        height={size} 
        style={{ width: size, height: size }}
        className={`select-none dark:invert ${className}`}
        draggable={false}
      />
    );
  }

  if (provider === "z-ai") {
    return (
      <img 
        src="/zdotai.svg" 
        alt="Zhipu AI" 
        width={size} 
        height={size} 
        style={{ width: size, height: size }}
        className={`select-none dark:invert ${className}`}
        draggable={false}
      />
    );
  }

  return null;
}

