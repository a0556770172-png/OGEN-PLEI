"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Loader2, Send, Reply, Trash2, X } from "lucide-react";

type Comment = {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author: { username: string } | null;
};

// תגובות בבקשת קהילה: כל משתמש מחובר יכול להגיב, ולענות לתגובה של משתמש אחר.
// מי שעליו ענו (וגם המבקש והמתנדב) מקבלים התראה בפעמון.
export default function CommunityComments({
  requestId,
  initialCount,
  currentUserId,
  isStaffUser
}: {
  requestId: string;
  initialCount: number;
  currentUserId: string | null;
  isStaffUser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(initialCount);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/community-requests/${requestId}/comments`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    const list: Comment[] = json.comments ?? [];
    setComments(list);
    setCount(list.length);
  }

  useEffect(() => {
    if (open && comments === null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/community-requests/${requestId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text.trim(), parentId: replyTo?.id ?? null })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "שגיאה בשליחת התגובה");
      return;
    }
    setText("");
    setReplyTo(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("למחוק את התגובה?")) return;
    const res = await fetch(`/api/community-requests/comments/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else alert("שגיאה במחיקה");
  }

  const roots = (comments ?? []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parent_id === id);

  function CommentRow({ c, isReply }: { c: Comment; isReply?: boolean }) {
    return (
      <div className={`rounded-xl bg-surface2 px-3 py-2 ${isReply ? "ms-6 border-s-2 border-primary/30" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href={`/users/${c.author_id}`} className="font-bold text-gray-200 hover:text-primary-light hover:underline">
            {c.author?.username ?? "משתמש"}
          </Link>
          <span className="text-gray-500">{new Date(c.created_at).toLocaleDateString("he-IL")}</span>
          <div className="ms-auto flex items-center gap-1">
            {currentUserId && (
              <button
                type="button"
                onClick={() => setReplyTo(c)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold text-primary-light hover:bg-primary/10"
              >
                <Reply className="h-3 w-3" /> תגובה
              </button>
            )}
            {(c.author_id === currentUserId || isStaffUser) && (
              <button type="button" onClick={() => remove(c.id)} aria-label="מחיקת תגובה" className="rounded-lg p-1 text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-300">{c.body}</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 transition hover:text-primary-light"
      >
        <MessageCircle className="h-3.5 w-3.5" /> תגובות{count ? ` (${count})` : ""}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {comments === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          ) : roots.length === 0 ? (
            <p className="text-xs text-gray-500">אין תגובות עדיין.</p>
          ) : (
            roots.map((c) => (
              <div key={c.id} className="flex flex-col gap-1.5">
                <CommentRow c={c} />
                {repliesOf(c.id).map((r) => (
                  <CommentRow key={r.id} c={r} isReply />
                ))}
              </div>
            ))
          )}

          {currentUserId ? (
            <form onSubmit={send} className="mt-1 flex flex-col gap-1.5">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs text-primary-light">
                  <Reply className="h-3 w-3" /> עונה ל-{replyTo.author?.username ?? "משתמש"}
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="ביטול תשובה" className="text-gray-500 hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  dir="rtl"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                  placeholder={replyTo ? "כתבו תשובה..." : "כתבו תגובה..."}
                  className="input-field flex-1 py-2 text-sm"
                />
                <button type="submit" disabled={busy || !text.trim()} className="btn-primary px-3 text-sm">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </form>
          ) : (
            <p className="text-xs text-gray-500">
              כדי להגיב <Link href="/login?redirect=/community" className="text-primary-light hover:underline">התחברו</Link>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
