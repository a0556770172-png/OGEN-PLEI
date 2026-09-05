"use client";
import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";

// לייק על פוסט בפורום. לפוסט של המשתמש עצמו / כשלא מחובר - תצוגה בלבד (disabled).
export default function ForumLikeButton({
  postId,
  initialCount,
  initialLiked,
  disabled = false,
  hint
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy || disabled) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch(`/api/forum/posts/${postId}/like`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLiked(!next);
        setCount((c) => c + (next ? -1 : 1));
      } else {
        setLiked(!!json.liked);
      }
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={disabled || busy}
      title={hint || (disabled ? undefined : "לייק")}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
        liked
          ? "border-red-500/40 bg-red-500/10 text-red-400"
          : "border-border bg-surface2 text-gray-400 hover:border-red-500/30 hover:text-red-400"
      } ${disabled ? "cursor-default opacity-70 hover:border-border hover:text-gray-400" : ""}`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-400" : ""}`} />
      )}
      {count.toLocaleString("he-IL")}
    </button>
  );
}
