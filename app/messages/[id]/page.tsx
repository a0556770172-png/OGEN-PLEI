"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ArrowRight, Ban, Check, Copy, Loader2, MoreHorizontal, Pencil, Send, Smile, Trash2, User as UserIcon, X } from "lucide-react";
import { fullMessageTime } from "@/lib/formatTime";
import { useVisibleInterval } from "@/lib/useVisibleInterval";
import LinkifiedText from "@/components/LinkifiedText";
import EmojiPicker from "@/components/EmojiPicker";

interface DmMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  pending?: boolean; // הודעה שנשלחה ועדיין לא אושרה מהשרת (מוצגת מיד)
}

const MAX_LEN = 2000;
const GROUP_GAP_MS = 5 * 60 * 1000;
// הודעה שמורכבת מ-1-3 אימוג'ים בלבד מוצגת גדולה וללא בועה (כמו בווטסאפ)
const EMOJI_ONLY = new RegExp("^[\\p{Extended_Pictographic}\\uFE0F\\u200D\\u{1F3FB}-\\u{1F3FF}\\s]+$", "u");

function isBigEmoji(body: string) {
  const s = body.trim();
  if (!s || s.length > 24 || !EMOJI_ONLY.test(s)) return false;
  const seg = (Intl as any).Segmenter;
  const count = seg ? [...new seg("he", { granularity: "grapheme" }).segment(s.replace(/\s/g, ""))].length : s.length;
  return count <= 3;
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff === 0) return "היום";
  if (diff === 1) return "אתמול";
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt={name} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <UserIcon className="text-primary-light" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  );
}

export default function DmThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = params.id;
  const [meId, setMeId] = useState<string | null>(null);
  const [otherUsername, setOtherUsername] = useState("");
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  // תפריט פעולות על הודעה (fixed, כדי שלא ייחתך בתוך אזור ההודעות הגולל)
  const [menu, setMenu] = useState<{ id: string; mine: boolean; left: number; top?: number; bottom?: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // האם המשתמש קרוב לתחתית (אז גוללים אוטומטית להודעות חדשות)
  const firstScrollDone = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dm/threads/${threadId}/messages`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const server: DmMessage[] = json.messages ?? [];
      // הודעות שנשלחו כרגע ועדיין לא אושרו נשארות מוצגות גם אם הרענון הגיע לפניהן
      setMessages((prev) => [...server, ...prev.filter((m) => m.pending)]);
      setMeId(json.meId ?? null);
      setOtherUsername(json.otherUsername ?? "");
      setOtherUserId(json.otherUserId ?? null);
      setOtherAvatar(json.otherAvatarUrl ?? null);
    } else {
      setError(json.error || "שגיאה בטעינת השיחה");
    }
    setLoading(false);
    fetch(`/api/dm/threads/${threadId}/mark-read`, { method: "POST" }).catch(() => {});
  }, [threadId]);

  useEffect(() => {
    fetch("/api/profile/heartbeat", { method: "POST" }).catch(() => {});
    load();
  }, [load]);

  // רענון שיחה: כל 5 שניות ורק כשהלשונית מוצגת
  useVisibleInterval(load, 5000);

  // גלילה: בטעינה הראשונה קופצים לסוף; אחר כך גוללים להודעות חדשות רק אם המשתמש כבר היה למטה
  // (או שההודעה האחרונה שלו) - כדי לא "לקפוץ" לו בזמן שהוא קורא הודעות ישנות.
  const lastId = messages.length ? messages[messages.length - 1].id : null;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages.length) return;
    const last = messages[messages.length - 1];
    const lastMine = !!last.pending || last.sender_id === meId;
    if (!firstScrollDone.current) {
      el.scrollTop = el.scrollHeight;
      firstScrollDone.current = true;
    } else if (stickRef.current || lastMine) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  // תיבת הכתיבה גדלה עם הטקסט (עד 5 שורות)
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    // scrollHeight לא כולל את המסגרת - בלי התוספת הזו מופיע פס גלילה זעיר גם בשורה אחת
    const border = ta.offsetHeight - ta.clientHeight;
    const wanted = ta.scrollHeight + border;
    ta.style.height = `${Math.min(wanted, 128)}px`;
    ta.style.overflowY = wanted > 128 ? "auto" : "hidden";
  }, [text]);

  // סגירת תפריט ההודעה: לחיצה בחוץ / Escape
  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menu]);

  function closeMenu() {
    setMenu(null);
    setConfirmDelete(false);
    setCopied(false);
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, m: DmMessage) {
    if (menu?.id === m.id) return closeMenu();
    const r = e.currentTarget.getBoundingClientRect();
    const W = 176;
    const left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2));
    const spaceBelow = window.innerHeight - r.bottom;
    setConfirmDelete(false);
    setCopied(false);
    setMenu(
      spaceBelow > 170
        ? { id: m.id, mine: m.sender_id === meId, left, top: r.bottom + 4 }
        : { id: m.id, mine: m.sender_id === meId, left, bottom: window.innerHeight - r.top + 4 }
    );
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy || body.length > MAX_LEN) return;
    setError("");
    setShowEmoji(false);
    stickRef.current = true;
    const tmpId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tmpId, sender_id: meId ?? "me", body, created_at: new Date().toISOString(), pending: true }]);
    setText("");
    setBusy(true);
    const res = await fetch(`/api/dm/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res || !res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      setText(body); // לא מאבדים את מה שהוקלד
      setError(json?.error || "שגיאה בשליחה");
      return;
    }
    const real: DmMessage | undefined = json.message;
    setMessages((prev) => {
      const rest = prev.filter((m) => m.id !== tmpId && m.id !== real?.id);
      const merged = real ? [...rest, real] : rest;
      // רענון ברקע יכול היה להביא בינתיים הודעה חדשה של הצד השני - שומרים על סדר כרונולוגי
      return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    taRef.current?.focus();
  }

  function insertEmoji(emoji: string) {
    const ta = taRef.current;
    if (!ta) return setText((t) => t + emoji);
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function startEdit(m: DmMessage) {
    closeMenu();
    setEditingId(m.id);
    setEditText(m.body);
  }

  async function saveEdit() {
    const id = editingId;
    const body = editText.trim();
    if (!id || editBusy) return;
    if (!body) return setError("ההודעה לא יכולה להיות ריקה");
    const original = messages.find((m) => m.id === id);
    if (original && original.body === body) return setEditingId(null);
    setEditBusy(true);
    setError("");
    const res = await fetch(`/api/dm/threads/${threadId}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setEditBusy(false);
    if (!res || !res.ok) {
      setError(json?.error || "שגיאה בעריכת ההודעה");
      if (res?.status === 404) {
        setEditingId(null);
        load();
      }
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: json.message.body, edited_at: json.message.edited_at } : m)));
    setEditingId(null);
  }

  async function doDelete(id: string) {
    closeMenu();
    setError("");
    const snapshot = messages;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), body: "" } : m)));
    const res = await fetch(`/api/dm/threads/${threadId}/messages/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      const json = await res?.json().catch(() => ({}));
      setMessages(snapshot);
      setError(json?.error || "שגיאה במחיקת ההודעה");
    }
  }

  async function copyMessage(m: DmMessage) {
    try {
      await navigator.clipboard.writeText(m.body);
      setCopied(true);
      setTimeout(closeMenu, 700);
    } catch {
      setError("לא הצלחנו להעתיק - אפשר לסמן ולהעתיק ידנית");
      closeMenu();
    }
  }

  const menuMsg = menu ? messages.find((m) => m.id === menu.id) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card flex flex-col overflow-hidden p-0">
        {/* ---- כותרת השיחה ---- */}
        <div className="flex items-center gap-3 border-b border-border/70 bg-surface2/40 px-3 py-3 sm:px-4">
          <Link href="/messages" aria-label="חזרה לכל השיחות" className="rounded-full p-2 text-gray-400 transition hover:bg-surface2 hover:text-white">
            <ArrowRight className="h-5 w-5" />
          </Link>
          {loading ? (
            <>
              <span className="h-10 w-10 animate-pulse rounded-full bg-surface2" />
              <span className="h-4 w-28 animate-pulse rounded bg-surface2" />
            </>
          ) : (
            <Link href={otherUserId ? `/users/${otherUserId}` : "#"} className="flex min-w-0 items-center gap-3 transition hover:opacity-80">
              <Avatar url={otherAvatar} name={otherUsername} size={40} />
              <span className="min-w-0">
                <span className="block truncate font-bold text-white">{otherUsername}</span>
                <span className="block text-[11px] text-gray-500">לחיצה לפרופיל</span>
              </span>
            </Link>
          )}
        </div>

        {/* ---- ההודעות ---- */}
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            if (menu) closeMenu();
          }}
          className="flex h-[60vh] min-h-[320px] max-h-[640px] flex-col overflow-y-auto px-3 py-4 sm:px-5"
        >
          {!loading && messages.length === 0 && (
            <div className="m-auto text-center text-sm text-gray-500">
              <Smile className="mx-auto mb-2 h-8 w-8 text-primary-light/70" />
              אין הודעות עדיין. כתבו משהו כדי להתחיל את השיחה 👋
            </div>
          )}
          {messages.map((m, i) => {
            const mine = !!m.pending || m.sender_id === meId;
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
            const joinsPrev = !!prev && !newDay && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS;
            const joinsNext =
              !!next &&
              next.sender_id === m.sender_id &&
              new Date(next.created_at).toDateString() === new Date(m.created_at).toDateString() &&
              new Date(next.created_at).getTime() - new Date(m.created_at).getTime() < GROUP_GAP_MS;
            const deleted = !!m.deleted_at;
            const big = !deleted && isBigEmoji(m.body);
            const editing = editingId === m.id;

            return (
              <div key={m.id} className={joinsPrev ? "mt-0.5" : "mt-3"}>
                {newDay && (
                  <div className="mb-3 flex justify-center">
                    <span className="rounded-full bg-surface2/80 px-3 py-1 text-[11px] font-semibold text-gray-400">{dayLabel(m.created_at)}</span>
                  </div>
                )}
                <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  {editing ? (
                    <div className="w-full max-w-[85%] rounded-2xl border border-primary/50 bg-surface2 p-2.5">
                      <textarea
                        autoFocus
                        onFocus={(e) => {
                          // הסמן בסוף הטקסט (ברירת המחדל היא בתחילתו)
                          const l = e.currentTarget.value.length;
                          e.currentTarget.setSelectionRange(l, l);
                        }}
                        value={editText}
                        maxLength={MAX_LEN}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit();
                          } else if (e.key === "Escape") setEditingId(null);
                        }}
                        rows={Math.min(6, Math.max(2, editText.split("\n").length))}
                        className="input-field w-full resize-none text-sm"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-500">Enter לשמירה · Esc לביטול</span>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-300 transition hover:bg-surface">
                            <X className="h-3.5 w-3.5" /> ביטול
                          </button>
                          <button type="button" onClick={saveEdit} disabled={editBusy || !editText.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-[#fff] transition hover:bg-primary-light disabled:opacity-50">
                            {editBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} שמירה
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : deleted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-border px-3 py-1.5 text-xs italic text-gray-500">
                      <Ban className="h-3.5 w-3.5" /> ההודעה נמחקה
                    </span>
                  ) : (
                    <div className={`group flex max-w-[85%] items-end gap-1 ${mine ? "flex-row" : "flex-row-reverse"}`}>
                      {!m.pending && (
                        <button
                          type="button"
                          onClick={(e) => openMenu(e, m)}
                          aria-label="פעולות על ההודעה"
                          aria-expanded={menu?.id === m.id}
                          className={`mb-1 shrink-0 rounded-full p-1.5 text-gray-500 transition hover:bg-surface2 hover:text-white focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 ${menu?.id === m.id ? "!opacity-100 bg-surface2 text-white" : ""}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}
                      <div
                        className={
                          big
                            ? `whitespace-pre-wrap px-1 text-4xl leading-tight ${m.pending ? "opacity-60" : ""}`
                            : `min-w-0 whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${
                                mine ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-100"
                              } ${!joinsNext ? (mine ? "rounded-bl-md" : "rounded-br-md") : ""} ${m.pending ? "opacity-60" : ""}`
                        }
                      >
                        <LinkifiedText
                          text={m.body}
                          linkClassName={`break-all underline decoration-1 underline-offset-2 [unicode-bidi:isolate] ${mine ? "text-[#fff] decoration-white/60 hover:decoration-white" : "text-primary-light hover:text-white"}`}
                        />
                      </div>
                    </div>
                  )}
                  {!joinsNext && !editing && (
                    <span className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-gray-500" title={fullMessageTime(m.created_at)}>
                      {m.edited_at && !deleted && <span className="italic">נערך ·</span>}
                      {m.pending ? "שולח..." : timeOnly(m.created_at)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- כתיבה ---- */}
        <div className="border-t border-border/70 bg-surface2/30 p-3 sm:p-4">
          {error && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")} aria-label="סגירה"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <form onSubmit={send} className="relative flex items-end gap-2">
            {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
            <button
              type="button"
              onClick={() => setShowEmoji((s) => !s)}
              aria-label="הוספת אימוג'י"
              aria-expanded={showEmoji}
              className={`shrink-0 rounded-xl p-2.5 transition ${showEmoji ? "bg-primary/20 text-primary-light" : "text-gray-400 hover:bg-surface2 hover:text-white"}`}
            >
              <Smile className="h-6 w-6" />
            </button>
            <textarea
              ref={taRef}
              value={text}
              maxLength={MAX_LEN}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              className="input-field max-h-32 flex-1 resize-none py-2.5"
              placeholder="הקלידו הודעה..."
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="שליחה" className="btn-primary shrink-0 !px-3.5 !py-3">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 -scale-x-100" />}
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-gray-600">
            <span className="hidden sm:inline">Enter לשליחה · Shift+Enter לשורה חדשה</span>
            {text.length > 1700 && <span className={text.length >= MAX_LEN ? "text-red-400" : ""}>{text.length}/{MAX_LEN}</span>}
          </div>
        </div>
      </div>

      {/* ---- תפריט פעולות על הודעה ---- */}
      {menu && menuMsg && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-card"
          style={{ left: menu.left, top: menu.top, bottom: menu.bottom }}
        >
          {confirmDelete ? (
            <div className="p-3">
              <p className="mb-2.5 text-sm font-semibold text-white">למחוק את ההודעה?</p>
              <p className="mb-3 text-[11px] leading-snug text-gray-500">היא תיעלם משני הצדדים.</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => doDelete(menuMsg.id)} className="flex-1 rounded-lg bg-red-500 px-2 py-1.5 text-xs font-bold text-[#fff] transition hover:bg-red-600">
                  מחיקה
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg bg-surface2 px-2 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-border">
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => copyMessage(menuMsg)} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-200 transition hover:bg-surface2">
                {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />} {copied ? "הועתק" : "העתקה"}
              </button>
              {menu.mine && (
                <>
                  <button type="button" role="menuitem" onClick={() => startEdit(menuMsg)} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-200 transition hover:bg-surface2">
                    <Pencil className="h-4 w-4" /> עריכה
                  </button>
                  <button type="button" role="menuitem" onClick={() => setConfirmDelete(true)} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" /> מחיקה
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
