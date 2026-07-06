export function ForgeMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/forgelogo.png"
      alt="Forge"
      width={size}
      height={size}
      className={`select-none invert dark:invert-0 ${className}`}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );
}

export function ForgeWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-0.5 font-sans text-[16px] font-semibold tracking-tight text-foreground ${className}`}>
      Forge<span className="forge-gradient-text font-semibold"></span>
    </span>
  );
}

export function ForgeLockup({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <ForgeMark size={size} />
      <ForgeWordmark />
    </div>
  );
}
