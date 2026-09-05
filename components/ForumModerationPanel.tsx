"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2, Ban, Loader2, MessageSquare, ExternalLink } from "lucide-react";
import type { ForumPost } from "@/lib/forum";

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `לפני ${m} דק'`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע'`;
  return new Date(d).toLocaleDateString("he-IL");
}

export default function ForumModerationPanel({ posts }: { posts: ForumPost[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hidden" | "threads">("all");

  async function patch(id: string, body: any) {
    setBusy(id);
    await fetch(`/api/forum/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("למחוק לצמיתות?")) return;
    setBusy(id);
    await fetch(`/api/forum/posts/${id}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  async function toggleBan(p: ForumPost) {
    const ban = !p.author.forumBanned;
    if (!confirm(ban ? `לחסום את ${p.author.username} מכתיבה בפורום?` : `לבטל חסימה של ${p.author.username}?`)) return;
    setBusy(p.id);
    await fetch("/api/forum/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: p.author.id, banned: ban })
    }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  const shown = posts.filter((p) =>
    filter === "hidden" ? p.hidden : filter === "threads" ? p.parentId === null : true
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "threads", "hidden"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              filter === f ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"
            }`}
          >
            {f === "all" ? "הכל" : f === "threads" ? "פוסטים ראשיים" : "מוסתרים"}
          </button>
        ))}
        <span className="text-xs text-gray-500">{shown.length} רשומות</span>
      </div>

      {shown.length === 0 ? (
        <p className="card p-6 text-center text-sm text-gray-500">אין רשומות.</p>
      ) : (
        shown.map((p) => {
          const threadId = p.parentId ?? p.id;
          return (
            <div key={p.id} className={`card flex flex-col gap-2 p-3.5 ${p.hidden ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link href={`/users/${p.author.id}`} className="font-bold text-white hover:underline">
                  {p.author.username}
                </Link>
                {p.author.forumBanned && (
                  <span className="rounded bg-red-500/15 px-1.5 text-[10px] font-bold text-red-400">חסום מהפורום</span>
                )}
                <span className="text-gray-600">· {timeAgo(p.createdAt)}</span>
                <span className="rounded bg-surface2 px-1.5 text-[10px] text-gray-400">
                  {p.parentId ? "תגובה" : "פוסט ראשי"}
                </span>
                {p.hidden && <span className="rounded bg-gray-500/20 px-1.5 text-[10px] text-gray-400">מוסתר</span>}
                {p.pinned && <span className="rounded bg-gold/15 px-1.5 text-[10px] text-gold">נעוץ</span>}
                <span className="inline-flex items-center gap-0.5 text-gray-500">
                  <MessageSquare className="h-3 w-3" /> {p.replyCount} · ♥ {p.likeCount}
                </span>
              </div>

              {p.title && <p className="text-sm font-bold text-white">{p.title}</p>}
              <p className="whitespace-pre-wrap text-sm text-gray-300 line-clamp-4">{p.body}</p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => patch(p.id, { hidden: !p.hidden })}
                  disabled={busy === p.id}
                  className="btn-ghost text-xs"
                >
                  {busy === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : p.hidden ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  {p.hidden ? "הצגה" : "הסתרה"}
                </button>
                <button
                  onClick={() => del(p.id)}
                  disabled={busy === p.id}
                  className="rounded-lg px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="me-1 inline h-3.5 w-3.5" /> מחיקה
                </button>
                {p.author.role !== "admin" && (
                  <button
                    onClick={() => toggleBan(p)}
                    disabled={busy === p.id}
                    className="rounded-lg px-2.5 py-1 text-xs text-gray-300 hover:bg-surface2"
                  >
                    <Ban className="me-1 inline h-3.5 w-3.5" />
                    {p.author.forumBanned ? "בטל חסימה" : "חסום מהפורום"}
                  </button>
                )}
                <Link
                  href={`/forum/${threadId}`}
                  target="_blank"
                  className="ms-auto inline-flex items-center gap-1 text-xs text-primary-light hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> לדיון
                </Link>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
