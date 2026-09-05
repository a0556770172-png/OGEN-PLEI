"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  ShieldCheck,
  Crown,
  Package,
  MessageSquare,
  MoreHorizontal,
  Pin,
  EyeOff,
  Eye,
  Trash2,
  Pencil,
  Loader2,
  X,
  Check
} from "lucide-react";
import ForumLikeButton from "./ForumLikeButton";
import type { ForumPost } from "@/lib/forum";

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString("he-IL");
}

export default function ForumPostCard({
  post,
  loggedIn,
  isStaff,
  variant
}: {
  post: ForumPost;
  loggedIn: boolean;
  isStaff: boolean;
  variant: "list" | "detail" | "reply";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title ?? "");
  const [editBody, setEditBody] = useState(post.body);
  const [busy, setBusy] = useState(false);

  const canEdit = post.isMine;
  const canDelete = post.isMine || isStaff;
  const showMenu = canEdit || canDelete || isStaff;
  const isRoot = post.parentId === null;

  async function act(payload: any) {
    setBusy(true);
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditing(false);
        setMenuOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("למחוק את הפוסט?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) {
        setMenuOpen(false);
        if (variant === "detail") router.push("/forum");
        else router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const Wrapper: any = variant === "list" ? Link : "div";
  const wrapperProps = variant === "list" ? { href: `/forum/${post.id}` } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`card block p-4 ${variant === "list" ? "transition hover:border-primary/40" : ""} ${
        post.hidden ? "opacity-50" : ""
      } ${post.pinned && variant === "list" ? "border-gold/40" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Link
          href={`/users/${post.author.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border"
        >
          {post.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatarUrl} alt={post.author.username} className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-4 w-4 text-primary-light" />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link
              href={`/users/${post.author.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-white hover:underline"
            >
              {post.author.username}
            </Link>
            {post.author.role === "admin" && <span className="text-red-400">מנהל</span>}
            {post.author.isModerator && post.author.role !== "admin" && (
              <ShieldCheck className="h-3 w-3 text-primary-light" />
            )}
            {(post.author.role === "developer" || post.author.role === "admin") && (
              <Package className="h-3 w-3 text-accent" />
            )}
            {post.author.isPro && <Crown className="h-3 w-3 text-gold" />}
            <span className="text-gray-600">· {timeAgo(post.createdAt)}</span>
            {post.pinned && (
              <span className="inline-flex items-center gap-0.5 text-gold">
                <Pin className="h-3 w-3" /> נעוץ
              </span>
            )}
            {post.hidden && <span className="rounded bg-gray-500/20 px-1.5 text-[10px] text-gray-400">מוסתר</span>}
          </div>

          {editing ? (
            <div className="mt-2 flex flex-col gap-2" onClick={(e) => e.preventDefault()}>
              {isRoot && (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={140}
                  placeholder="כותרת (לא חובה)"
                  className="input-field text-sm"
                />
              )}
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
                maxLength={5000}
                className="input-field resize-none text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => act({ body: editBody, ...(isRoot ? { title: editTitle } : {}) })}
                  disabled={busy}
                  className="btn-primary text-xs"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} שמירה
                </button>
                <button onClick={() => setEditing(false)} className="btn-ghost text-xs text-gray-400">
                  <X className="h-3.5 w-3.5" /> ביטול
                </button>
              </div>
            </div>
          ) : (
            <>
              {isRoot && post.title && (
                <p className={`mt-1 font-bold text-white ${variant === "list" ? "text-base" : "text-lg"}`}>
                  {post.title}
                </p>
              )}
              <p
                className={`mt-1 whitespace-pre-wrap text-sm text-gray-300 ${
                  variant === "list" ? "line-clamp-3" : ""
                }`}
              >
                {post.body}
              </p>
            </>
          )}

          {!editing && (
            <div className="mt-2.5 flex items-center gap-3">
              <ForumLikeButton
                postId={post.id}
                initialCount={post.likeCount}
                initialLiked={post.likedByMe}
                disabled={!loggedIn || post.isMine}
                hint={post.isMine ? "לא ניתן לתת לייק לפוסט שלך" : !loggedIn ? "התחברו כדי לתת לייק" : undefined}
              />
              {isRoot && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <MessageSquare className="h-3.5 w-3.5" /> {post.replyCount.toLocaleString("he-IL")}
                </span>
              )}
              {isRoot && post.likeCount > 0 && (
                <span className="text-[11px] text-gray-600">כל לייק = מוניטין לכותב</span>
              )}
            </div>
          )}
        </div>

        {showMenu && !editing && (
          <div className="relative shrink-0" onClick={(e) => e.preventDefault()}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-1 text-gray-500 transition hover:bg-surface2 hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-border bg-bg py-1 text-sm shadow-2xl">
                {canEdit && (
                  <button
                    onClick={() => { setEditing(true); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-gray-300 hover:bg-surface2"
                  >
                    <Pencil className="h-3.5 w-3.5" /> עריכה
                  </button>
                )}
                {isStaff && (
                  <>
                    <button
                      onClick={() => act({ hidden: !post.hidden })}
                      disabled={busy}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-gray-300 hover:bg-surface2"
                    >
                      {post.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {post.hidden ? "הצגה" : "הסתרה"}
                    </button>
                    {isRoot && (
                      <button
                        onClick={() => act({ pinned: !post.pinned })}
                        disabled={busy}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-gray-300 hover:bg-surface2"
                      >
                        <Pin className="h-3.5 w-3.5" /> {post.pinned ? "ביטול נעיצה" : "נעיצה"}
                      </button>
                    )}
                  </>
                )}
                {canDelete && (
                  <button
                    onClick={remove}
                    disabled={busy}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> מחיקה
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Wrapper>
  );
}
