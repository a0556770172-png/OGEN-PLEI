"use client";

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-radial-fade" />
      <div
        className="absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full opacity-30 blur-3xl animate-float"
        style={{ background: "radial-gradient(circle, #7c5cff 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 -left-40 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl animate-float"
        style={{ background: "radial-gradient(circle, #00d9c0 0%, transparent 70%)", animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-0 right-1/4 h-[24rem] w-[24rem] rounded-full opacity-20 blur-3xl animate-float"
        style={{ background: "radial-gradient(circle, #f2b84b 0%, transparent 70%)", animationDelay: "4s" }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }}
      />
    </div>
  );
}
