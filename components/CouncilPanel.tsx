"use client";
import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, MessagesSquare, Plus, CheckCircle2, RotateCcw, Siren,
  Quote, Reply, Copy, Pencil, Trash2, Bold, Check, X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MessageReactionsBar from "./MessageReactions";
import { FormattedMessageBody, buildQuoteText, copyMessageWithLink, toggleBoldAtSelection } from "@/lib/chatFormat";
import type { CouncilThread, CouncilMessage, Profile } from "@/types/database";

// "ועדה" - ערוץ חירום/עדכונים משותף לכל צוות הפיקוח (לא פרטי כמו "הודעות" הרגילות).
// מנהל בפועל פותח ישירות; חבר צוות פיקוח רק מבקש, ואם עוד חבר צוות שונה מבקש תוך 24 שעות
// זה נפתח אוטומטית גם ללא אישור מנהל. כולל: אימוג'י, ציטוט, הגבה, העתקה, הדגשה, עריכה ומחיקה.
export default function CouncilPanel({ currentProfile }: { currentProfile: Profile }) {
  const supabase = createClient();
  const isAdmin = currentProfile.role === "admin";
  const [threads, setThreads] = useState<CouncilThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CouncilThread | null>(null);
  const [messages, setMessages] = useState<CouncilMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [replyingTo, setReplyingTo] = useState<CouncilMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newResultMsg, setNewResultMsg] = useState("");

  async function loadThreads() {
    const { data } = await supabase
      .from("council_threads")
      .select("*, opener:profiles!council_threads_opened_by_fkey(username)")
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false });
    setThreads((data as unknown as CouncilThread[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadThreads();
  }, []);

  async function openThread(thread: CouncilThread) {
    setSelected(thread);
    setReplyingTo(null);
    setEditingId(null);
    fetch(`/api/council/threads/${thread.id}/mark-read`, { method: "POST" }).catch(() => {});
    const { data } = await supabase
      .from("council_messages")
      .select("*, sender:profiles!council_messages_sender_id_fkey(username)")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });
    setMessages((data as unknown as CouncilMessage[]) ?? []);
  }

  async function refreshMessages() {
    if (!selected) return;
    const { data } = await supabase
      .from("council_messages")
      .select("*, sender:profiles!council_messages_sender_id_fkey(username)")
      .eq("thread_id", selected.id)
      .order("created_at", { ascending: true });
    setMessages((data as unknown as CouncilMessage[]) ?? []);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    await fetch(`/api/council/threads/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply, replyToId: replyingTo?.id ?? null })
    });
    setReply("");
    setReplyingTo(null);
    setBusy(false);
    await refreshMessages();
    await loadThreads();
  }

  async function toggleStatus() {
    if (!selected) return;
    const newStatus = selected.status === "open" ? "closed" : "open";
    setBusy(true);
    await fetch(`/api/council/threads/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    setBusy(false);
    setSelected({ ...selected, status: newStatus });
    await loadThreads();
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    setNewResultMsg("");
    const res = await fetch("/api/council/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, reason: newReason })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNewResultMsg(json.error || "שגיאה בשליחת הבקשה");
      return;
    }
    if (json.opened) {
      setShowNew(false);
      setNewTitle("");
      setNewReason("");
      await loadThreads();
    } else {
      setNewResultMsg(
        `הבקשה נשלחה. הוועדה תיפתח אוטומטית אם חבר צוות נוסף יבקש גם הוא אותו דבר תוך 24 שעות (כרגע ${json.pendingCount ?? 1} מתוך 2 דרושים).`
      );
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...m.reactions };
        const users = new Set(reactions[emoji] ?? []);
        if (users.has(currentProfile.id)) users.delete(currentProfile.id);
        else users.add(currentProfile.id);
        if (users.size > 0) reactions[emoji] = [...users];
        else delete reactions[emoji];
        return { ...m, reactions };
      })
    );
    await fetch(`/api/council/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji })
    });
    await refreshMessages();
  }

  function quoteMessage(m: CouncilMessage) {
    setReply((prev) => buildQuoteText(m.sender?.username ?? "צוות", m.body) + prev);
    textareaRef.current?.focus();
  }

  function replyToMessage(m: CouncilMessage) {
    setReplyingTo(m);
    textareaRef.current?.focus();
  }

  async function copyMessage(m: CouncilMessage) {
    const ok = await copyMessageWithLink(m.id, m.body);
    if (ok) {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }

  function startEdit(m: CouncilMessage) {
    setEditingId(m.id);
    setEditingText(m.body);
  }

  async function saveEdit(messageId: string) {
    if (!editingText.trim()) return;
    setBusy(true);
    await fetch(`/api/council/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editingText })
    });
    setBusy(false);
    setEditingId(null);
    await refreshMessages();
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("למחוק את ההודעה? אי אפשר לשחזר.")) return;
    setBusy(true);
    await fetch(`/api/council/messages/${messageId}`, { method: "DELETE" });
    setBusy(false);
    await refreshMessages();
  }

  function toggleBold() {
    if (!textareaRef.current) return;
    setReply((prev) => toggleBoldAtSelection(textareaRef.current!, prev));
    textareaRef.current.focus();
  }

  if (loading) return <div className="card p-6 text-center text-gray-500">טוען ועדות...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4">
        <div className="flex items-start gap-3">
          <Siren className="h-5 w-5 shrink-0 text-gold" />
          <p className="text-sm text-gray-300">
            ערוץ ל"ועדה" - מצבי חירום, שינויים, גל חסימות וכו'. {isAdmin ? "כמנהל, פתיחה שלך מיידית." : "פתיחה דורשת אישור מנהל, אלא אם עוד חבר צוות מבקש גם הוא תוך 24 שעות."}
          </p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="btn-primary shrink-0 text-sm">
          <Plus className="h-4 w-4" /> {isAdmin ? "פתיחת ועדה" : "בקשת פתיחת ועדה"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={submitNew} className="card flex flex-col gap-3 p-5">
          <input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="input-field" placeholder="נושא הוועדה (למשל: גל חסימות חשוד)" />
          <textarea rows={3} value={newReason} onChange={(e) => setNewReason(e.target.value)} className="input-field resize-none" placeholder="פירוט (אופציונלי)..." />
          {newResultMsg && <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm text-gold">{newResultMsg}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} שליחה
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="btn-ghost">ביטול</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-2 md:col-span-1">
          {threads.length === 0 ? (
            <div className="card p-6 text-center text-sm text-gray-500">אין דיוני ועדה כרגע.</div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t)}
                className={`card flex items-center justify-between gap-2 p-4 text-right transition ${
                  selected?.id === t.id ? "border-gold/60" : "hover:border-gold/30"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">{t.title}</p>
                  <p className="truncate text-xs text-gray-500">
                    {t.opener?.username ?? "צוות"} {t.auto_approved && "· נפתח אוטומטית"}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  t.status === "open" ? "bg-gold/15 text-gold" : "bg-gray-500/15 text-gray-400"
                }`}>
                  {t.status === "open" ? "פתוח" : "סגור"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="md:col-span-2">
          {!selected ? (
            <div className="card flex h-full min-h-[200px] items-center justify-center p-6 text-center text-gray-500">
              <div>
                <MessagesSquare className="mx-auto mb-2 h-8 w-8" />
                בחרו דיון ועדה מהרשימה
              </div>
            </div>
          ) : (
            <div className="card flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white">{selected.title}</h2>
                  <p className="text-xs text-gray-500">נפתח ע"י {selected.opener?.username ?? "צוות"}</p>
                </div>
                <button onClick={toggleStatus} disabled={busy} className="btn-ghost text-xs">
                  {selected.status === "open" ? <><CheckCircle2 className="h-3.5 w-3.5" /> סגור דיון</> : <><RotateCcw className="h-3.5 w-3.5" /> פתח מחדש</>}
                </button>
              </div>

              <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
                {messages.map((m) => {
                  const isMine = m.sender_id === currentProfile.id;
                  const canDelete = isMine || isAdmin;
                  const repliedMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                  return (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={`group max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        isMine ? "self-end bg-primary/20 text-white" : "self-start bg-surface2 text-gray-200"
                      }`}
                    >
                      <p className="mb-1 text-xs font-bold text-gray-400">{m.sender?.username ?? "צוות"}</p>

                      {m.deleted_at ? (
                        <p className="italic text-gray-500">ההודעה נמחקה</p>
                      ) : (
                        <>
                          {repliedMsg && (
                            <div className="mb-1.5 rounded-lg border-e-2 border-current/40 bg-black/10 px-2 py-1 text-xs opacity-70">
                              {repliedMsg.deleted_at ? "ההודעה נמחקה" : repliedMsg.body.slice(0, 80)}
                            </div>
                          )}

                          {editingId === m.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                rows={2}
                                className="input-field resize-none text-black"
                              />
                              <div className="flex gap-2">
                                <button onClick={() => saveEdit(m.id)} disabled={busy} className="btn-primary px-3 py-1 text-xs"><Check className="h-3.5 w-3.5" /> שמירה</button>
                                <button onClick={() => setEditingId(null)} className="btn-ghost px-3 py-1 text-xs">ביטול</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <FormattedMessageBody text={m.body} />
                              {m.edited_at && <span className="text-[10px] text-gray-500"> (נערך)</span>}
                            </>
                          )}

                          <MessageReactionsBar reactions={m.reactions} currentUserId={currentProfile.id} onToggle={(emoji) => toggleReaction(m.id, emoji)} />

                          {editingId !== m.id && (
                            <div className="mt-1.5 flex items-center gap-2.5 opacity-0 transition group-hover:opacity-100">
                              <button onClick={() => quoteMessage(m)} title="ציטוט" className="text-gray-400 hover:text-white"><Quote className="h-3.5 w-3.5" /></button>
                              <button onClick={() => replyToMessage(m)} title="הגבה" className="text-gray-400 hover:text-white"><Reply className="h-3.5 w-3.5" /></button>
                              <button onClick={() => copyMessage(m)} title="העתקת קישור וטקסט" className="text-gray-400 hover:text-white">
                                {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              {isMine && (
                                <button onClick={() => startEdit(m)} title="עריכה" className="text-gray-400 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                              )}
                              {canDelete && (
                                <button onClick={() => deleteMessage(m.id)} title="מחיקה" className="text-gray-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {replyingTo && (
                <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-gray-300">
                  <Reply className="h-3.5 w-3.5 shrink-0 text-primary-light" />
                  <span className="min-w-0 flex-1 truncate">מגיב ל: {replyingTo.deleted_at ? "הודעה שנמחקה" : replyingTo.body}</span>
                  <button type="button" onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              <form onSubmit={sendReply} className="flex items-end gap-2">
                <button type="button" onClick={toggleBold} title="הדגשת כתב" className="btn-ghost shrink-0 px-3"><Bold className="h-4 w-4" /></button>
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  className="input-field flex-1 resize-none"
                  placeholder="הקלידו הודעה לצוות..."
                />
                <button type="submit" disabled={busy || !reply.trim()} className="btn-primary shrink-0">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
