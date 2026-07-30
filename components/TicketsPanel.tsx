"use client";
import { useEffect, useState } from "react";
import { Send, Loader2, CheckCircle2, RotateCcw, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Ticket, TicketMessage } from "@/types/database";

export default function TicketsPanel() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    await fetch(`/api/tickets/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply })
    });
    setReply("");
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

  if (loading) return <div className="card p-6 text-center text-gray-500">טוען פניות...</div>;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="flex flex-col gap-2 md:col-span-1">
        {tickets.length === 0 ? (
          <div className="card p-6 text-center text-sm text-gray-500">אין פניות תמיכה כרגע.</div>
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
              בחרו פנייה מהרשימה כדי לצפות בשיחה ולהגיב
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
                  // בסגנון וואטסאפ: ההודעות שאני (הצוות) שולח מופיעות אצלי בצד ימין, וההודעות
                  // הנכנסות מהמשתמש מופיעות בצד שמאל. "self-end"/"self-start" הם לוגיים לפי
                  // כיוון הטקסט (RTL כאן) - self-start = ימין, self-end = שמאל.
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender_role === "staff" ? "self-start bg-primary/20 text-white" : "self-end bg-surface2 text-gray-200"
                  }`}
                >
                  <p className="mb-1 text-xs font-bold text-gray-400">{m.sender_role === "staff" ? "צוות" : selected.user?.username ?? "משתמש"}</p>
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
                placeholder="הקלידו תגובה למשתמש..."
              />
              <button type="submit" disabled={busy || !reply.trim()} className="btn-primary shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
