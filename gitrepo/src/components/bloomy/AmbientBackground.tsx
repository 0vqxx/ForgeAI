export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full opacity-60 blur-3xl animate-forge-drift"
        style={{
          background:
            "radial-gradient(closest-side, rgba(249,115,22,0.25), transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[36rem] w-[36rem] rounded-full opacity-50 blur-3xl animate-forge-drift"
        style={{
          animationDelay: "-6s",
          background:
            "radial-gradient(closest-side, rgba(251,146,60,0.20), transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-40 left-1/3 h-[34rem] w-[34rem] rounded-full opacity-45 blur-3xl animate-forge-drift"
        style={{
          animationDelay: "-12s",
          background:
            "radial-gradient(closest-side, rgba(249,115,22,0.18), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}
