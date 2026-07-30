"use client";
import { useEffect, useState } from "react";
import { Send, Loader2, MessagesSquare, Plus, CheckCircle2, RotateCcw, Siren } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CouncilThread, CouncilMessage, Profile } from "@/types/database";

// "ועדה" - ערוץ חירום/עדכונים משותף לכל צוות הפיקוח (לא פרטי כמו "הודעות" הרגילות).
// מנהל בפועל פותח ישירות; חבר צוות פיקוח רק מבקש, ואם עוד חבר צוות שונה מבקש תוך 24 שעות
// זה נפתח אוטומטית גם ללא אישור מנהל.
export default function CouncilPanel({ currentProfile }: { currentProfile: Profile }) {
  const supabase = createClient();
  const isAdmin = currentProfile.role === "admin";
  const [threads, setThreads] = useState<CouncilThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CouncilThread | null>(null);
  const [messages, setMessages] = useState<CouncilMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

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
    const { data } = await supabase
      .from("council_messages")
      .select("*, sender:profiles!council_messages_sender_id_fkey(username)")
      .eq("thread_id", thread.id)
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
      body: JSON.stringify({ message: reply })
    });
    setReply("");
    setBusy(false);
    await openThread(selected);
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

              <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.sender_id === currentProfile.id ? "self-end bg-primary/20 text-white" : "self-start bg-surface2 text-gray-200"
                    }`}
                  >
                    <p className="mb-1 text-xs font-bold text-gray-400">{m.sender?.username ?? "צוות"}</p>
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
