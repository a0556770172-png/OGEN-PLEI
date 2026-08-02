"use client";
import { useEffect, useState } from "react";
import { ThumbsUp, Loader2 } from "lucide-react";

export default function AppLikeButton({ appId }: { appId: string }) {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/apps/${appId}/like`)
      .then((r) => r.json())
      .then((json) => { setCount(json.count ?? 0); setLiked(!!json.liked); })
      .catch(() => {});
  }, [appId]);

  async function toggle() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/apps/${appId}/like`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error || "שגיאה"); return; }
    setLiked(json.liked);
    setCount((c) => (json.liked ? c + 1 : Math.max(0, c - 1)));
  }

  return (
    <div className="flex flex-col items-center gap-1 sm:items-start">
      <button
        onClick={toggle}
        disabled={busy}
        className={`btn-ghost text-sm ${liked ? "border-primary/60 text-primary-light" : ""}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
        לייק {count > 0 ? `(${count.toLocaleString("he-IL")})` : ""}
      </button>
      {error && <p className="max-w-xs text-center text-xs text-red-400 sm:text-start">{error}</p>}
    </div>
  );
}
