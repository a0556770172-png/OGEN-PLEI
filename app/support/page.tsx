"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Plus, Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Ticket, TicketMessage } from "@/types/database";

export default function SupportPage() {
  const supabase = createClient();
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

  async function loadTickets() {
    const { data } = await supabase.from("tickets").select("*").order("updated_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
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
      body: JSON.stringify({ message: reply })
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error || "שגיאה בשליחת ההודעה");
      return;
    }
    setReply("");
    await openTicket(selected);
    await loadTickets();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black">פניות תמיכה</h1>
          <p className="text-gray-400">שאלה, בעיה, או בקשה? אפשר לפנות אלינו כאן ונחזור אליכם.</p>
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

              <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.sender_role === "staff" ? "self-start bg-surface2 text-gray-200" : "self-end bg-primary/20 text-white"
                    }`}
                  >
                    <p className="mb-1 text-xs font-bold text-gray-400">{m.sender_role === "staff" ? "צוות עוגן פליי" : "אני"}</p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={sendReply} className="flex items-end gap-2">
                <textarea
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
