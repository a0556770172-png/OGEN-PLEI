"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, PenLine, Reply, X } from "lucide-react";

// כתיבת פוסט חדש (parentId ריק) או תגובה. loggedIn=false -> מציג הזמנה להתחבר.
export default function ForumComposer({
  parentId = null,
  loggedIn,
  variant = "post"
}: {
  parentId?: string | null;
  loggedIn: boolean;
  variant?: "post" | "reply";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(variant === "reply");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // תגובה לתגובה מסוימת (כפתורי "הגב"/"ציטוט" בכרטיסי הדיון שולחים אירוע forum-compose)
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (variant !== "reply") return;
    function onCompose(e: Event) {
      const d = (e as CustomEvent).detail as { replyToId: string | null; username: string; quote?: string };
      setReplyTo(d.replyToId ? { id: d.replyToId, username: d.username } : null);
      if (d.quote) setBody((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n\n` : "") + d.quote);
      document.getElementById("forum-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => areaRef.current?.focus(), 350);
    }
    window.addEventListener("forum-compose", onCompose);
    return () => window.removeEventListener("forum-compose", onCompose);
  }, [variant]);

  if (!loggedIn) {
    return (
      <div className="card flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-gray-400">
          {variant === "reply" ? "כדי להגיב צריך להתחבר." : "כדי לכתוב פוסט צריך להתחבר."}
        </p>
        <a href="/login" className="btn-primary text-sm">התחברות</a>
      </div>
    );
  }

  async function submit() {
    const t = body.trim();
    if (t.length < 2) {
      setError("צריך לכתוב משהו");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t, title: title.trim() || undefined, parentId: parentId || undefined, replyToId: replyTo?.id })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "שגיאה בשליחה");
        return;
      }
      setTitle("");
      setBody("");
      setReplyTo(null);
      if (variant === "post") setOpen(false);
      if (parentId) router.refresh();
      else router.push(`/forum/${json.id}`);
    } catch {
      setError("שגיאת רשת - נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "post" && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="card flex w-full items-center gap-3 p-4 text-right text-sm text-gray-400 transition hover:border-primary/40 hover:text-white"
      >
        <PenLine className="h-4 w-4 text-primary-light" />
        מה מפריע לכם? מה הייתם משפרים? כתבו פוסט…
      </button>
    );
  }

  return (
    <div id={variant === "reply" ? "forum-composer" : undefined} className="card flex flex-col gap-3 p-4">
      {replyTo && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary-light">
          <span className="inline-flex items-center gap-1.5">
            <Reply className="h-3.5 w-3.5 -scale-x-100" /> מגיבים ל-<b>{replyTo.username}</b>
          </span>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="ביטול תגובה ישירה" className="rounded p-0.5 hover:bg-white/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {variant === "post" && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="כותרת (לא חובה)"
          className="input-field"
        />
      )}
      <textarea
        ref={areaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={variant === "reply" ? 3 : 5}
        maxLength={5000}
        placeholder={variant === "reply" ? "כתבו תגובה…" : "כתבו כאן מה על הלב — מה מפריע, מה חסר, איך אפשר לקדם את עוגן פליי…"}
        className="input-field resize-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={busy} className="btn-primary text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {variant === "reply" ? "שליחת תגובה" : "פרסום"}
        </button>
        {variant === "post" && (
          <button onClick={() => setOpen(false)} className="btn-ghost text-sm text-gray-400">
            ביטול
          </button>
        )}
      </div>
    </div>
  );
}
