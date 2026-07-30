"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, CheckCircle2, RotateCcw, MessageCircle, Paperclip, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import TicketAttachment from "./TicketAttachment";
import type { Ticket, TicketMessage, Profile } from "@/types/database";

// פאנל "הודעות" של הצוות (מנהל/פיקוח) - כאן מאוחדות פניות התמיכה עם אפשרות לצוות
// לפתוח שיחה יזומה למשתמש ספציפי, ולצרף קבצים (מוגבל למנהל או למי שקיבל הרשאה).
export default function TicketsPanel({ currentProfile, profiles = [] }: { currentProfile?: Profile; profiles?: Profile[] }) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showNew, setShowNew] = useState(false);
  const [newTargetId, setNewTargetId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [userQuery, setUserQuery] = useState("");

  const canAttach = !!currentProfile && (currentProfile.role === "admin" || currentProfile.can_send_attachments);

  async function loadTickets() {
    const { data } = await supabase
      .from("tickets")
      .select("*, user:profiles!tickets_user_id_fkey(username, email)")
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false });
    setTickets((data as unknown as Ticket[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function openTicket(ticket: Ticket) {
    setSelected(ticket);
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setMessages((data as TicketMessage[]) ?? []);
  }

  async function uploadPendingFile(ticketId: string) {
    if (!pendingFile) return null;
    const initRes = await fetch(`/api/tickets/${ticketId}/attachment-init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: pendingFile.name, fileSize: pendingFile.size, contentType: pendingFile.type })
    });
    const initJson = await initRes.json().catch(() => ({}));
    if (!initRes.ok) {
      alert(initJson.error || "שגיאה בהעלאת הקובץ");
      return null;
    }
    const putRes = await fetch(initJson.uploadUrl, { method: "PUT", body: pendingFile, headers: { "Content-Type": pendingFile.type } });
    if (!putRes.ok) {
      alert("שגיאה בהעלאת הקובץ ל-R2");
      return null;
    }
    return { attachmentKey: initJson.attachmentKey, attachmentName: initJson.attachmentName, attachmentType: initJson.attachmentType };
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || (!reply.trim() && !pendingFile)) return;
    setBusy(true);
    let attachment: { attachmentKey: string; attachmentName: string; attachmentType: string } | null = null;
    if (pendingFile) {
      attachment = await uploadPendingFile(selected.id);
      if (!attachment) { setBusy(false); return; }
    }
    await fetch(`/api/tickets/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply, ...attachment })
    });
    setReply("");
    setPendingFile(null);
    setBusy(false);
    await openTicket(selected);
    await loadTickets();
  }

  async function toggleStatus() {
    if (!selected) return;
    const newStatus = selected.status === "open" ? "closed" : "open";
    setBusy(true);
    await fetch(`/api/tickets/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    setBusy(false);
    setSelected({ ...selected, status: newStatus });
    await loadTickets();
  }

  async function startNewConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!newTargetId || !newSubject.trim() || !newMessage.trim()) return;
    setBusy(true);
    const res = await fetch("/api/tickets/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: newTargetId, subject: newSubject, message: newMessage })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "שגיאה בפתיחת השיחה");
      return;
    }
    setShowNew(false);
    setNewTargetId("");
    setNewSubject("");
    setNewMessage("");
    setUserQuery("");
    await loadTickets();
  }

  const filteredUsers = profiles.filter(
    (p) => !userQuery.trim() || p.username.toLowerCase().includes(userQuery.toLowerCase()) || p.email.toLowerCase().includes(userQuery.toLowerCase())
  );

  if (loading) return <div className="card p-6 text-center text-gray-500">טוען הודעות...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew((v) => !v)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> שיחה חדשה למשתמש
        </button>
      </div>

      {showNew && (
        <form onSubmit={startNewConversation} className="card flex flex-col gap-3 p-5">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">בחר משתמש</label>
            <input
              value={userQuery}
              onChange={(e) => { setUserQuery(e.target.value); setNewTargetId(""); }}
              className="input-field mb-2"
              placeholder="חיפוש לפי שם משתמש או אימייל..."
            />
            {userQuery && !newTargetId && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                {filteredUsers.slice(0, 20).map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => { setNewTargetId(p.id); setUserQuery(`${p.username} (${p.email})`); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-surface2"
                  >
                    <span className="font-bold text-white">{p.username}</span>
                    <span className="text-xs text-gray-500">{p.email}</span>
                  </button>
                ))}
                {filteredUsers.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">לא נמצאו משתמשים</div>}
              </div>
            )}
          </div>
          <input required value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="input-field" placeholder="נושא ההודעה" />
          <textarea required rows={3} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="input-field resize-none" placeholder="תוכן ההודעה..." />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !newTargetId} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} שליחה
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="btn-ghost">ביטול</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-2 md:col-span-1">
          {tickets.length === 0 ? (
            <div className="card p-6 text-center text-sm text-gray-500">אין הודעות כרגע.</div>
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
                  <p className="truncate text-xs text-gray-500">{t.user?.username ?? t.user?.email ?? "משתמש"}</p>
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
                בחרו הודעה מהרשימה כדי לצפות בשיחה ולהגיב
              </div>
            </div>
          ) : (
            <div className="card flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white">{selected.subject}</h2>
                  <p className="text-xs text-gray-500">{selected.user?.username ?? selected.user?.email}</p>
                </div>
                <button onClick={toggleStatus} disabled={busy} className="btn-ghost text-xs">
                  {selected.status === "open" ? <><CheckCircle2 className="h-3.5 w-3.5" /> סגור פנייה</> : <><RotateCcw className="h-3.5 w-3.5" /> פתח מחדש</>}
                </button>
              </div>

              <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.sender_role === "staff" ? "self-start bg-primary/20 text-white" : "self-end bg-surface2 text-gray-200"
                    }`}
                  >
                    <p className="mb-1 text-xs font-bold text-gray-400">{m.sender_role === "staff" ? "צוות" : selected.user?.username ?? "משתמש"}</p>
                    {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    {m.attachment_key && (
                      <TicketAttachment attachmentKey={m.attachment_key} attachmentName={m.attachment_name} attachmentType={m.attachment_type} />
                    )}
                  </div>
                ))}
              </div>

              {pendingFile && (
                <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-gray-300">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                  <button type="button" onClick={() => setPendingFile(null)} className="text-gray-500 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              <form onSubmit={sendReply} className="flex items-end gap-2">
                {canAttach && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*"
                      className="hidden"
                      onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="צירוף תמונה/וידאו/הקלטת קול"
                      className="btn-ghost shrink-0 px-3"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </>
                )}
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  className="input-field flex-1 resize-none"
                  placeholder="הקלידו תגובה למשתמש..."
                />
                <button type="submit" disabled={busy || (!reply.trim() && !pendingFile)} className="btn-primary shrink-0">
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
