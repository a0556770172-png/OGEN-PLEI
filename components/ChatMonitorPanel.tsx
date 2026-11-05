"use client";
import { useEffect, useState } from "react";
import { Search, Loader2, Eye, ArrowRight, MessagesSquare, RefreshCw } from "lucide-react";

interface ThreadRow { id: string; a: string; b: string; lastBody: string | null; lastAt: string; messages: number }
interface Hit { id: string; threadId: string; a: string; b: string; sender: string; body: string; createdAt: string }
interface Msg { id: string; sender: string; senderId: string; body: string; createdAt: string }
interface ThreadView { thread: { id: string; a: string; b: string; createdAt: string }; messages: Msg[] }

function fmt(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ניהול צ'אטים (מנהל בלבד): צפייה בשיחות הפרטיות בין משתמשים, חיפוש טקסט בכל ההודעות, וקריאת שיחה מלאה -
// לצורך זיהוי הפרות של חוקי האתר. צפייה בלבד; כל פתיחת שיחה נרשמת ב"מעקב פיקוח".
export default function ChatMonitorPanel() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [view, setView] = useState<ThreadView | null>(null);
  const [userFilter, setUserFilter] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function call(qs: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/chat-monitor${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "שגיאה בטעינה");
      return json;
    } catch (err: any) {
      setError(err.message || "שגיאה בטעינה");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadThreads(user = userFilter) {
    setHits(null);
    const json = await call(user.trim() ? `?user=${encodeURIComponent(user.trim())}` : "");
    if (json) setThreads(json.threads ?? []);
  }

  async function search() {
    if (!textQuery.trim()) {
      setHits(null);
      return;
    }
    const json = await call(`?q=${encodeURIComponent(textQuery.trim())}`);
    if (json) setHits(json.hits ?? []);
  }

  async function openThread(id: string) {
    const json = await call(`?thread=${id}`);
    if (json) setView(json);
  }

  useEffect(() => {
    loadThreads("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view) {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setView(null)} className="inline-flex items-center gap-1 text-sm text-primary-light hover:underline">
            <ArrowRight className="h-4 w-4" /> חזרה לרשימה
          </button>
          <button type="button" onClick={() => openThread(view.thread.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-300 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" /> רענון
          </button>
        </div>
        <h2 className="font-bold text-white">{view.thread.a} ↔ {view.thread.b}</h2>
        <p className="flex items-center gap-1 text-xs text-gray-500"><Eye className="h-3.5 w-3.5" /> צפייה בלבד · הפתיחה נרשמה ביומן</p>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-xl bg-black/20 p-3">
          {view.messages.length === 0 && <p className="text-sm text-gray-500">אין הודעות בשיחה.</p>}
          {view.messages.map((m) => {
            const isA = m.sender === view.thread.a;
            return (
              <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${isA ? "self-start bg-surface2" : "self-end bg-primary/20"}`}>
                <div className="mb-0.5 text-[11px] font-bold text-gray-400">{m.sender} · {fmt(m.createdAt)}</div>
                <div className="whitespace-pre-wrap break-words text-gray-100">{m.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-white"><MessagesSquare className="h-4 w-4" /> ניהול צ&apos;אטים</h2>
          <p className="text-xs text-gray-500">
            שיחות פרטיות בין משתמשים, לצורך בדיקת עמידה בחוקי האתר. צפייה בלבד. כל פתיחת שיחה נרשמת ב&quot;מעקב פיקוח&quot;.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <form onSubmit={(e) => { e.preventDefault(); loadThreads(); }} className="flex gap-2">
            <input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="input-field flex-1" placeholder="סינון לפי שם משתמש" />
            <button type="submit" className="rounded-xl border border-white/10 px-3 text-sm text-gray-300 hover:text-white">סנן</button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
            <input value={textQuery} onChange={(e) => setTextQuery(e.target.value)} className="input-field flex-1" placeholder="חיפוש טקסט בכל ההודעות" />
            <button type="submit" className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 text-sm text-gray-300 hover:text-white">
              <Search className="h-4 w-4" /> חפש
            </button>
          </form>
        </div>
        {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> טוען...</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>

      {hits ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-gray-300">תוצאות חיפוש ({hits.length})</p>
          {hits.length === 0 && <div className="card p-5 text-center text-gray-500">לא נמצאו הודעות.</div>}
          {hits.map((h) => (
            <button key={h.id} type="button" onClick={() => openThread(h.threadId)} className="card p-4 text-right transition hover:ring-1 hover:ring-primary/40">
              <div className="text-xs text-gray-500">{h.a} ↔ {h.b} · {h.sender} · {fmt(h.createdAt)}</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-200">{h.body}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-gray-300">שיחות אחרונות ({threads.length})</p>
          {!loading && threads.length === 0 && <div className="card p-5 text-center text-gray-500">אין שיחות.</div>}
          {threads.map((t) => (
            <button key={t.id} type="button" onClick={() => openThread(t.id)} className="card flex flex-col gap-1 p-4 text-right transition hover:ring-1 hover:ring-primary/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">{t.a} ↔ {t.b}</span>
                <span className="text-xs text-gray-500">{fmt(t.lastAt)}</span>
              </div>
              <p className="truncate text-sm text-gray-400">{t.lastBody ?? "עדיין אין הודעות"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
