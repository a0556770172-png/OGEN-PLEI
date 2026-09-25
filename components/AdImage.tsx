"use client";
import { useEffect, useState } from "react";
import type { AdAnimation } from "@/lib/adAnimation";

// תמונת הפרסומת. כשמדובר בגיף מונפש, השרת שמר אותו כ-sprite סטטי (ראו lib/adAnimation.ts)
// וכאן מריצים את הפריימים בעצמנו - כך שהאנימציה זזה גם כשמסנן בדרך מקפיא קבצי GIF.
export default function AdImage({
  src,
  animation,
  alt,
  className = ""
}: {
  src: string;
  animation?: AdAnimation | null;
  alt: string;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animation) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % animation.frames), animation.frameMs);
    return () => clearInterval(t);
  }, [animation]);

  if (!animation) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} />;
  }

  const rows = Math.ceil(animation.frames / animation.cols);
  const col = frame % animation.cols;
  const row = Math.floor(frame / animation.cols);
  return (
    <div
      role="img"
      aria-label={alt}
      className={className}
      style={{
        aspectRatio: `${animation.width} / ${animation.height}`,
        backgroundImage: `url("${src}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${animation.cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${animation.cols > 1 ? (col / (animation.cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`
      }}
    />
  );
}
