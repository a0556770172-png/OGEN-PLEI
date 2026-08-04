"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageCircle, Plus, Send, Loader2, AlertCircle,
  Quote, Reply, Copy, Pencil, Trash2, Bold, Check, X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import TicketAttachment from "@/components/TicketAttachment";
import MessageReactionsBar from "@/components/MessageReactions";
import { FormattedMessageBody, buildQuoteText, copyMessageWithLink, toggleBoldAtSelection } from "@/lib/chatFormat";
import type { Ticket, TicketMessage } from "@/types/database";

// עוטפים ב-Suspense כי useSearchParams (בשביל ?ticket=<id> - ראו components/NotificationBell.tsx)
// דורש את זה ב-App Router, אחרת ה-build נכשל (ראו הסבר דומה ב-app/login/page.tsx).
export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageInner />
    </Suspense>
  );
}

function SupportPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [replyingTo, setReplyingTo] = useState<TicketMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadTickets() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    const { data } = await supabase.from("tickets").select("*").order("updated_at", { ascending: false });
    const list = (data as Ticket[]) ?? [];
    setTickets(list);
    setLoading(false);

    // אם הגענו מכפתור ההתראות (ראו components/NotificationBell.tsx) עם ?ticket=<id> - פותחים
    // ישר את השיחה הזו, בלי שהמשתמש יצטרך לחפש אותה ידנית ברשימה.
    const wantedId = searchParams.get("ticket");
    if (wantedId) {
      const wanted = list.find((t) => t.id === wantedId);
      if (wanted) openTicket(wanted);
    }
  }

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openTicket(ticket: Ticket) {
    setSelected(ticket);
    setReplyingTo(null);
    setEditingId(null);
    fetch(`/api/tickets/${ticket.id}/mark-read`, { method: "POST" }).catch(() => {});
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setMessages((data as TicketMessage[]) ?? []);
  }

  async function refreshMessages() {
    if (!selected) return;
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", selected.id)
      .order("created_at", { ascending: true });
    setMessages((data as TicketMessage[]) ?? []);
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: newSubject, message: newMessage })
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error || "שגיאה ביצירת הפנייה");
      return;
    }
    setNewSubject("");
    setNewMessage("");
    setShowNew(false);
    await loadTickets();
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tickets/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply, replyToId: replyingTo?.id ?? null })
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error || "שגיאה בשליחת ההודעה");
      return;
    }
    setReply("");
    setReplyingTo(null);
    await openTicket(selected);
    await loadTickets();
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!userId) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...m.reactions };
        const users = new Set(reactions[emoji] ?? []);
        if (users.has(userId)) users.delete(userId);
        else users.add(userId);
        if (users.size > 0) reactions[emoji] = [...users];
        else delete reactions[emoji];
        return { ...m, reactions };
      })
    );
    await fetch(`/api/tickets/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji })
    });
    await refreshMessages();
  }

  function quoteMessage(m: TicketMessage) {
    const senderName = m.sender_role === "staff" ? "צוות עוגן פליי" : "אני";
    setReply((prev) => buildQuoteText(senderName, m.body) + prev);
    textareaRef.current?.focus();
  }

  function replyToMessage(m: TicketMessage) {
    setReplyingTo(m);
    textareaRef.current?.focus();
  }

  async function copyMessage(m: TicketMessage) {
    const ok = await copyMessageWithLink(m.id, m.body);
    if (ok) {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }

  function startEdit(m: TicketMessage) {
    setEditingId(m.id);
    setEditingText(m.body);
  }

  async function saveEdit(messageId: string) {
    if (!editingText.trim()) return;
    setBusy(true);
    await fetch(`/api/tickets/messages/${messageId}`, {
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
    await fetch(`/api/tickets/messages/${messageId}`, { method: "DELETE" });
    setBusy(false);
    await refreshMessages();
  }

  function toggleBold() {
    if (!textareaRef.current) return;
    setReply((prev) => toggleBoldAtSelection(textareaRef.current!, prev));
    textareaRef.current.focus();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black">הודעות</h1>
          <p className="text-gray-400">שאלה, בעיה, או בקשה? אפשר לפנות אלינו כאן, וגם לקבל כאן הודעות מהצוות.</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="btn-primary">
          <Plus className="h-4 w-4" /> פנייה חדשה
        </button>
      </div>

      {showNew && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={createTicket}
          className="card flex flex-col gap-3 p-6"
        >
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">נושא</label>
            <input required value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="input-field" placeholder="במה מדובר?" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">תוכן הפנייה</label>
            <textarea required rows={4} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="input-field resize-none" placeholder="פרטו כאן את הבקשה או הבעיה..." />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            שליחה
          </button>
        </motion.form>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-2 md:col-span-1">
          {loading ? (
            <div className="card p-6 text-center text-gray-500">טוען...</div>
          ) : tickets.length === 0 ? (
            <div className="card p-6 text-center text-sm text-gray-500">עדיין אין פניות. לחצו על "פנייה חדשה" כדי לפתוח אחת.</div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => openTicket(t)}
                className={`card flex items-center justify-between gap-2 p-4 text-right transition ${
                  selected?.id === t.id ? "border-primary/60" : "hover:border-primary/30"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">{t.subject}</p>
                  <p className="text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString("he-IL")}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  t.status === "open" ? "bg-accent/15 text-accent" : "bg-gray-500/15 text-gray-400"
                }`}>
                  {t.status === "open" ? "פתוחה" : "סגורה"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="md:col-span-2">
          {!selected ? (
            <div className="card flex h-full min-h-[200px] items-center justify-center p-6 text-center text-gray-500">
              <div>
                <MessageCircle className="mx-auto mb-2 h-8 w-8" />
                בחרו פנייה מהרשימה כדי לצפות בשיחה
              </div>
            </div>
          ) : (
            <div className="card flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white">{selected.subject}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  selected.status === "open" ? "bg-accent/15 text-accent" : "bg-gray-500/15 text-gray-400"
                }`}>
                  {selected.status === "open" ? "פתוחה" : "סגורה"}
                </span>
              </div>

              <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
                {messages.map((m) => {
                  const isMine = userId && m.sender_id === userId;
                  const repliedMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                  return (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={`group max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.sender_role === "staff" ? "self-start bg-surface2 text-gray-200" : "self-end bg-primary/20 text-white"
                      }`}
                    >
                      <p className="mb-1 text-xs font-bold text-gray-400">{m.sender_role === "staff" ? "צוות עוגן פליי" : "אני"}</p>

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
                              {m.attachment_key && (
                                <TicketAttachment attachmentKey={m.attachment_key} attachmentName={m.attachment_name} attachmentType={m.attachment_type} />
                              )}
                            </>
                          )}

                          {userId && (
                            <MessageReactionsBar reactions={m.reactions} currentUserId={userId} onToggle={(emoji) => toggleReaction(m.id, emoji)} />
                          )}

                          {editingId !== m.id && (
                            <div className="mt-1.5 flex items-center gap-2.5 opacity-0 transition group-hover:opacity-100">
                              <button onClick={() => quoteMessage(m)} title="ציטוט" className="text-gray-400 hover:text-white"><Quote className="h-3.5 w-3.5" /></button>
                              <button onClick={() => replyToMessage(m)} title="הגבה" className="text-gray-400 hover:text-white"><Reply className="h-3.5 w-3.5" /></button>
                              <button onClick={() => copyMessage(m)} title="העתקת קישור וטקסט" className="text-gray-400 hover:text-white">
                                {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              {isMine && (
                                <>
                                  <button onClick={() => startEdit(m)} title="עריכה" className="text-gray-400 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => deleteMessage(m.id)} title="מחיקה" className="text-gray-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                                </>
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
                  placeholder="הקלידו תגובה..."
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
