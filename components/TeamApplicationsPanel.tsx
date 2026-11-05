"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronDown, ChevronUp, Check, X, MessageSquare, ShieldCheck, ExternalLink, Lock, Unlock, AlertCircle } from "lucide-react";
import { TEAM_QUESTIONS } from "@/lib/teamQuestions";
import { parseMitmachimUrl } from "@/lib/mitmachim";

interface Application {
  id: string;
  user_id: string;
  answers: Record<string, string>;
  status: "pending" | "interview" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user: { username: string; email: string; points: number; is_moderator: boolean; created_at: string } | null;
}

const STATUS_LABEL: Record<Application["status"], { label: string; cls: string }> = {
  pending: { label: "ממתינה", cls: "bg-gold/15 text-gold" },
  interview: { label: "לראיון", cls: "bg-primary/15 text-primary-light" },
  approved: { label: "אושרה", cls: "bg-accent/15 text-accent" },
  rejected: { label: "נדחתה", cls: "bg-red-500/15 text-red-400" }
};

type Filter = "all" | Application["status"];

// מועמדויות לצוות הפיקוח (מנהל בפועל בלבד): קריאת השאלון, הערה פנימית, סטטוס, מינוי לפיקוח, ופתיחה/סגירה של הגיוס.
export default function TeamApplicationsPanel() {
  const [apps, setApps] = useState<Application[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/team-applications", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error || "שגיאה בטעינה");
    } else {
      setApps(json.applications ?? []);
      setOpen(!!json.open);
      setNotes((prev) => {
        const next = { ...prev };
        for (const a of json.applications ?? []) if (next[a.id] === undefined) next[a.id] = a.admin_note ?? "";
        return next;
      });
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/admin/team-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "הפעולה נכשלה");
      await load();
    } catch (e: any) {
      setError(e.message || "הפעולה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  async function approveAndPromote(a: Application) {
    if (!confirm(`לאשר את ${a.user?.username} ולמנות אותו לצוות הפיקוח מיד?`)) return;
    setBusy(a.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${a.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote_moderator" })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "המינוי נכשל");
    } catch (e: any) {
      setError(e.message || "המינוי נכשל");
      setBusy(null);
      return;
    }
    await patch(a.id, { status: "approved", note: notes[a.id] });
  }

  async function toggleOpen() {
    const next = !open;
    if (!next && !confirm("לסגור את הגיוס? הבאנר יוסתר ולא יתקבלו מועמדויות חדשות.")) return;
    const res = await fetch("/api/admin/team-applications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ open: next })
    });
    if (res.ok) setOpen(next);
    else setError("לא הצלחנו לשנות את מצב הגיוס");
  }

  const counts: Record<string, number> = { all: apps.length };
  for (const a of apps) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const shown = apps.filter((a) => filter === "all" || a.status === filter);

  if (loading) return <div className="flex items-center gap-2 p-6 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> טוען...</div>;

  const sections: { title: string; ids: string[] }[] = [];
  for (const q of TEAM_QUESTIONS) {
    const last = sections[sections.length - 1];
    if (last && last.title === q.section) last.ids.push(q.id);
    else sections.push({ title: q.section, ids: [q.id] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-white"><ShieldCheck className="h-4 w-4" /> מועמדויות לצוות הפיקוח</h2>
          <p className="text-xs text-gray-500">
            המועמדים ממלאים שאלון בעמוד <Link href="/join-team" target="_blank" className="text-primary-light hover:underline">/join-team</Link>
            {" "}(הבאנר "רוצה להצטרף לצוות הפיקוח שלנו?" מוביל אליו). החלטות נשמרות כאן והמועמד מקבל התראה.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition ${
            open ? "border-accent/40 bg-accent/10 text-accent" : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}
        >
          {open ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {open ? "הגיוס פתוח (לחיצה לסגירה)" : "הגיוס סגור (לחיצה לפתיחה)"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["pending", "interview", "approved", "rejected", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === f ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"}`}
          >
            {f === "all" ? "הכל" : STATUS_LABEL[f].label} ({counts[f] ?? 0})
          </button>
        ))}
      </div>

      {shown.length === 0 && <div className="card p-8 text-center text-gray-500">אין מועמדויות בסטטוס הזה.</div>}

      {shown.map((a) => {
        const expanded = openId === a.id;
        const st = STATUS_LABEL[a.status];
        const mit = parseMitmachimUrl(a.answers.mitmachim);
        return (
          <div key={a.id} className="card overflow-hidden">
            <button type="button" onClick={() => setOpenId(expanded ? null : a.id)} className="flex w-full items-center gap-3 p-4 text-right">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">{a.answers.name || a.user?.username}</span>
                  <span className="text-xs text-gray-500">@{a.user?.username}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                  {a.user?.is_moderator && <span className="text-[11px] text-primary-light">כבר בפיקוח</span>}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  גיל {a.answers.age} · {a.answers.hoursPerDay} · {a.answers.seriousness} · הוגש {new Date(a.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>
              {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>

            {expanded && (
              <div className="flex flex-col gap-5 border-t border-border p-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <Link href={`/users/${a.user_id}`} target="_blank" className="inline-flex items-center gap-1 text-primary-light hover:underline">
                    <ExternalLink className="h-3 w-3" /> פרופיל באתר
                  </Link>
                  <span>{a.user?.points ?? 0} מוניטין</span>
                  <span>מייל: {a.user?.email}</span>
                  {mit.valid && mit.url && (
                    <a href={mit.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-light hover:underline">
                      <ExternalLink className="h-3 w-3" /> מתמחים טופ
                    </a>
                  )}
                </div>

                {sections.map((s) => (
                  <div key={s.title}>
                    <h3 className="mb-2 text-sm font-black text-white">{s.title}</h3>
                    <div className="flex flex-col gap-3">
                      {s.ids.map((id) => {
                        const q = TEAM_QUESTIONS.find((x) => x.id === id)!;
                        const v = a.answers[id];
                        return (
                          <div key={id}>
                            <p className="text-xs font-bold text-gray-400">{q.label}</p>
                            <p className={`whitespace-pre-wrap text-sm ${v ? "text-gray-200" : "text-gray-600"}`}>{v || "—"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-400">הערה פנימית (המועמד לא רואה)</label>
                  <textarea
                    value={notes[a.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                    rows={2}
                    maxLength={1000}
                    className="input-field w-full resize-none text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy === a.id} onClick={() => patch(a.id, { note: notes[a.id] })} className="btn-ghost text-xs">
                    שמירת הערה
                  </button>
                  <button type="button" disabled={busy === a.id} onClick={() => patch(a.id, { status: "interview", note: notes[a.id] })} className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-light hover:bg-primary/20">
                    <MessageSquare className="h-3.5 w-3.5" /> זימון לשיחה
                  </button>
                  <button type="button" disabled={busy === a.id} onClick={() => patch(a.id, { status: "approved", note: notes[a.id] })} className="inline-flex items-center gap-1 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/20">
                    <Check className="h-3.5 w-3.5" /> אישור
                  </button>
                  {!a.user?.is_moderator && (
                    <button type="button" disabled={busy === a.id} onClick={() => approveAndPromote(a)} className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-black text-[#111] hover:opacity-90">
                      <ShieldCheck className="h-3.5 w-3.5" /> אישור ומינוי לפיקוח
                    </button>
                  )}
                  <button type="button" disabled={busy === a.id} onClick={() => patch(a.id, { status: "rejected", note: notes[a.id] })} className="inline-flex items-center gap-1 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20">
                    <X className="h-3.5 w-3.5" /> דחייה
                  </button>
                  {busy === a.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
