"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Loader2, ExternalLink, HandHelping, X, Check, Trash2, RotateCcw, UploadCloud, Send, AlertCircle, Link2 } from "lucide-react";
import type { Category, CommunityRequest } from "@/types/database";

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "פתוחה למתנדבים", cls: "bg-gold/15 text-gold" },
  claimed: { label: "מתנדב בטיפול", cls: "bg-primary/15 text-primary-light" },
  fulfilled: { label: "בוצעה ✓", cls: "bg-accent/15 text-accent" },
  closed: { label: "נסגרה", cls: "bg-gray-500/15 text-gray-400" }
};

export default function CommunityBoard({
  currentUserId,
  isStaffUser,
  categories
}: {
  currentUserId: string | null;
  isStaffUser: boolean;
  categories: Category[];
}) {
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [sourceLink, setSourceLink] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/community-requests", { cache: "no-store" });
      const json = await res.json();
      setRequests(json.requests ?? []);
    } catch {
      setRequests([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("יש להזין שם אפליקציה/תוכנה"); return; }
    setSubmitting(true);
    const res = await fetch("/api/community-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, sourceLink, note, category })
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { setError(json.error || "שגיאה ביצירת הבקשה"); return; }
    setTitle(""); setSourceLink(""); setNote(""); setCategory("");
    setShowForm(false);
    load();
  }

  async function act(id: string, action: string) {
    setBusyId(id);
    const res = await fetch(`/api/community-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyId(null);
    if (res.ok) load();
    else {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "שגיאה בפעולה");
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את הבקשה?")) return;
    setBusyId(id);
    const res = await fetch(`/api/community-requests/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) load();
    else alert("שגיאה במחיקה");
  }

  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black">
            <Users className="h-7 w-7 text-primary-light" /> בקשות קהילתיות
          </h1>
          <p className="mt-1 text-gray-400">
            מבקשים אפליקציה או תוכנה? הדביקו קישור לבקשה מפורום חיצוני, ומתנדב יוריד ויעלה אותה עבורכם.
            {openCount > 0 && <span className="text-gold"> · {openCount} בקשות פתוחות למתנדבים</span>}
          </p>
        </div>
        {currentUserId && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm">
            {showForm ? <><X className="h-4 w-4" /> ביטול</> : <><Plus className="h-4 w-4" /> בקשה חדשה</>}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && currentUserId && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={submit}
            className="card overflow-hidden p-6"
          >
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-300">שם האפליקציה/תוכנה המבוקשת *</label>
                <input dir="rtl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: תוכנת עריכת וידאו X" className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-300">קישור לבקשה המקורית (פורום חיצוני)</label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                  <input dir="ltr" value={sourceLink} onChange={(e) => setSourceLink(e.target.value)} placeholder="https://..." className="input-field pl-10 text-left" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-gray-300">קטגוריה (רשות)</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                    <option value="">— ללא —</option>
                    {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-300">פרטים נוספים (רשות)</label>
                <textarea dir="rtl" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="גרסה מבוקשת, למה חשוב, וכו'" className="input-field resize-none" />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <button type="submit" disabled={submitting} className="btn-primary self-start text-sm">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} פרסום הבקשה
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!currentUserId && (
        <div className="card p-5 text-center text-sm text-gray-400">
          כדי לפרסם בקשה או להתנדב למילוי בקשות, <Link href="/login" className="font-bold text-primary-light hover:underline">התחברו</Link> לאתר.
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center p-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-gray-500">
          אין בקשות עדיין. היו הראשונים לפרסם בקשה!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => {
            const st = STATUS[r.status] ?? STATUS.open;
            const isRequester = currentUserId === r.requested_by;
            const isClaimer = currentUserId === r.claimed_by;
            const canClaim = currentUserId && r.status === "open";
            return (
              <div key={r.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-white">{r.title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    </div>
                    {r.note && <p className="text-sm text-gray-400">{r.note}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {r.requester?.username && <span>ביקש/ה: <Link href={`/users/${r.requested_by}`} className="text-gray-300 hover:text-primary-light hover:underline">{r.requester.username}</Link></span>}
                      {r.claimer?.username && <span>מתנדב: <Link href={`/users/${r.claimed_by}`} className="text-primary-light hover:underline">{r.claimer.username}</Link></span>}
                      {r.source_link && (
                        <a href={r.source_link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary-light hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> הבקשה המקורית
                        </a>
                      )}
                      {r.fulfilled_app_id && (
                        <Link href={`/apps/${r.fulfilled_app_id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                          <Check className="h-3.5 w-3.5" /> לאפליקציה שהועלתה
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canClaim && !isRequester && (
                      <button onClick={() => act(r.id, "claim")} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-xl bg-primary/15 px-3 py-2 text-xs font-bold text-primary-light transition hover:bg-primary/25">
                        <HandHelping className="h-3.5 w-3.5" /> אני מתנדב/ת
                      </button>
                    )}
                    {(isClaimer || isStaffUser) && r.status === "claimed" && (
                      <>
                        <Link href="/suggest-app" className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/25">
                          <UploadCloud className="h-3.5 w-3.5" /> העלאת הקובץ
                        </Link>
                        <button onClick={() => act(r.id, "fulfill")} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/25">
                          <Check className="h-3.5 w-3.5" /> סמן כבוצע
                        </button>
                        <button onClick={() => act(r.id, "unclaim")} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-xl bg-surface2 px-3 py-2 text-xs font-bold text-gray-400 transition hover:text-white">
                          <X className="h-3.5 w-3.5" /> ביטול התנדבות
                        </button>
                      </>
                    )}
                    {(isRequester || isStaffUser) && r.status !== "closed" && r.status !== "fulfilled" && (
                      <button onClick={() => act(r.id, "close")} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-xl bg-surface2 px-3 py-2 text-xs font-bold text-gray-400 transition hover:text-white">
                        <X className="h-3.5 w-3.5" /> סגירה
                      </button>
                    )}
                    {(isRequester || isStaffUser) && (r.status === "closed" || r.status === "fulfilled") && (
                      <button onClick={() => act(r.id, "reopen")} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-xl bg-surface2 px-3 py-2 text-xs font-bold text-gray-400 transition hover:text-white">
                        <RotateCcw className="h-3.5 w-3.5" /> פתיחה מחדש
                      </button>
                    )}
                    {(isRequester || isStaffUser) && (
                      <button onClick={() => remove(r.id)} disabled={busyId === r.id} className="rounded-xl p-2 text-red-400 transition hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
