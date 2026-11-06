"use client";
import { useState } from "react";
import { Eye, Play } from "lucide-react";

const SEEN_MS = 6 * 60 * 60 * 1000; // צפייה חוזרת של אותו דפדפן באותו פוסט נספרת פעם ב-6 שעות

function seenRecently(id: string) {
  try {
    const t = Number(localStorage.getItem(`ogen-vv-${id}`) ?? 0);
    return Date.now() - t < SEEN_MS;
  } catch {
    return false;
  }
}

export default function ForumVideo({
  postId,
  src,
  poster,
  views,
  mode
}: {
  postId: string;
  src: string;
  poster: string | null;
  views: number;
  mode: "list" | "detail";
}) {
  const [count, setCount] = useState(views);
  const [counted, setCounted] = useState(false);

  async function countView() {
    if (counted) return;
    setCounted(true);
    if (seenRecently(postId)) return;
    try {
      localStorage.setItem(`ogen-vv-${postId}`, String(Date.now()));
    } catch {}
    try {
      const res = await fetch(`/api/forum/posts/${postId}/view`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (typeof data.views === "number") setCount(data.views);
    } catch {}
  }

  const viewsLabel = (
    <span className="inline-flex items-center gap-1 text-xs text-gray-300">
      <Eye className="h-3.5 w-3.5" /> {count.toLocaleString("he-IL")} צפיות
    </span>
  );

  if (mode === "list") {
    // ברשימה מציגים תמונה עם כפתור הפעלה - הניגון עצמו בעמוד הפוסט (הכרטיס כולו קישור)
    return (
      <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-xl bg-black">
        {poster && <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-white shadow-glow">
            <Play className="h-6 w-6" fill="currentColor" />
          </span>
        </span>
        <span className="absolute bottom-2 start-2 rounded-lg bg-black/70 px-2 py-1">{viewsLabel}</span>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <video
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        onPlay={countView}
        className="aspect-video w-full rounded-xl bg-black"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-gray-400">{viewsLabel}</span>
        <span className="text-[11px] text-gray-600">נספרת צפייה בכל הפעלה ראשונה</span>
      </div>
    </div>
  );
}
