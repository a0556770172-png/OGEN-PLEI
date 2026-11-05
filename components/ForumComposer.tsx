"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Send, Loader2, PenLine, Reply, X, User as UserIcon } from "lucide-react";

type MentionUser = { id: string; username: string; avatarUrl?: string | null };

// כתיבת פוסט חדש (parentId ריק) או תגובה. loggedIn=false -> מציג הזמנה להתחבר.
// תומך בתגובה לתגובה מסוימת (כפתורי "הגב"/"ציטוט" בדיון), ובהזכרת משתמשים: מקלידים @ ובוחרים מהרשימה.
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

  // הזכרות: מי שנבחר מהרשימה (נשלח לשרת רק אם השם עדיין מופיע בטקסט)
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState<{ start: number; text: string } | null>(null);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);

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

  // הצעות להזכרה: חיפוש משתמשים לפי מה שהוקלד אחרי ה-@ (עם השהיה קצרה)
  useEffect(() => {
    const q = mentionQuery?.text.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      fetch(`/api/users/list?limit=6&q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (active && j && Array.isArray(j.users)) {
            setSuggestions(j.users.map((u: any) => ({ id: u.id, username: u.username, avatarUrl: u.avatarUrl })));
          }
        })
        .catch(() => {});
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [mentionQuery?.text]);

  function onBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const pos = e.target.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const at = before.lastIndexOf("@");
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1]))) {
      const q = before.slice(at + 1);
      if (q.length <= 20 && !q.includes("\n")) {
        setMentionQuery({ start: at, text: q });
        return;
      }
    }
    setMentionQuery(null);
  }

  function pickMention(u: MentionUser) {
    if (!mentionQuery) return;
    const pos = areaRef.current?.selectionStart ?? body.length;
    const before = body.slice(0, mentionQuery.start);
    const after = body.slice(pos);
    const insert = `@${u.username} `;
    setBody(before + insert + after);
    setMentions((prev) => (prev.some((m) => m.id === u.id) ? prev : [...prev, u]));
    setMentionQuery(null);
    setSuggestions([]);
    const caret = (before + insert).length;
    setTimeout(() => {
      areaRef.current?.focus();
      areaRef.current?.setSelectionRange(caret, caret);
    }, 0);
  }

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
        body: JSON.stringify({
          body: t,
          title: title.trim() || undefined,
          parentId: parentId || undefined,
          replyToId: replyTo?.id,
          mentionIds: mentions.filter((m) => t.includes(`@${m.username}`)).map((m) => m.id)
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "שגיאה בשליחה");
        return;
      }
      setTitle("");
      setBody("");
      setReplyTo(null);
      setMentions([]);
      if (variant === "post") setOpen(false);
      // תגובה: עוברים להודעה החדשה (הדף מחשב לבד באיזה עמוד של הדיון היא נמצאת)
      if (parentId) router.push(`/forum/${parentId}?post=${json.id}#post-${json.id}`);
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
      <div className="relative">
        <textarea
          ref={areaRef}
          value={body}
          onChange={onBodyChange}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMentionQuery(null);
          }}
          rows={variant === "reply" ? 3 : 5}
          maxLength={5000}
          placeholder={variant === "reply" ? "כתבו תגובה… (@ להזכרת משתמש)" : "כתבו כאן מה על הלב — מה מפריע, מה חסר, איך אפשר לקדם את עוגן פליי… (@ להזכרת משתמש)"}
          className="input-field w-full resize-none"
        />
        {mentionQuery && suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-bg shadow-2xl">
            {suggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(u)}
                className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-gray-200 transition hover:bg-surface2"
              >
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
                  {u.avatarUrl ? (
                    <Image src={u.avatarUrl} alt="" fill sizes="24px" className="object-cover" />
                  ) : (
                    <UserIcon className="h-3 w-3 text-primary-light" />
                  )}
                </span>
                <span className="font-bold">@{u.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
