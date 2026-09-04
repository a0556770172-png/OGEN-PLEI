"use client";
import { useEffect, useState } from "react";
import { Star, MessageSquare, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ReviewItem {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user?: { username: string } | null;
}

function StarRow({ value, onChange, size = "h-5 w-5" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star className={`${size} ${n <= value ? "fill-gold text-gold" : "text-gray-600"}`} />
        </button>
      ))}
    </div>
  );
}

// כפתור/שורה מעוצבת "תגובות" בעמוד האפליקציה - כוכבים פתוחים לכל משתמש מחובר, תגובת
// טקסט חופשית נפתחת אוטומטית אחרי 5 אפליקציות/תוכנות שהמדרג עצמו העלה (נבדק בשרת).
export default function AppReviews({ appId, viewerIsStaff = false }: { appId: string; viewerIsStaff?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/apps/${appId}/reviews`);
    const json = await res.json().catch(() => ({ reviews: [] }));
    setReviews(json.reviews ?? []);
    setAvgRating(json.avgRating ?? 0);
    setCount(json.count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
    createClient().auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
    });
  }, [appId]);

  useEffect(() => {
    if (!userId) return;
    const mine = reviews.find((r) => r.user_id === userId);
    if (mine) { setMyRating(mine.rating); setMyComment(mine.comment ?? ""); }
  }, [userId, reviews]);

  async function submit() {
    if (myRating < 1) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/apps/${appId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: myRating, comment: myComment })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error || "שגיאה בשליחה"); return; }
    await load();
  }

  async function removeMine() {
    setBusy(true);
    await fetch(`/api/apps/${appId}/reviews`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    setBusy(false);
    setMyRating(0);
    setMyComment("");
    await load();
  }

  // מחיקת תגובה של משתמש אחר - צוות פיקוח/ניהול בלבד.
  async function removeReview(targetUserId: string) {
    if (!confirm("למחוק את התגובה והדירוג של המשתמש הזה?")) return;
    setBusy(true);
    await fetch(`/api/apps/${appId}/reviews`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId })
    });
    setBusy(false);
    await load();
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface2 px-4 py-3 text-start transition hover:border-primary/40"
      >
        <span className="flex items-center gap-2 font-bold text-white">
          <MessageSquare className="h-4 w-4 text-primary-light" /> תגובות ודירוגים
        </span>
        <span className="flex items-center gap-2 text-sm text-gray-400">
          {count > 0 && (
            <>
              <StarRow value={Math.round(avgRating)} size="h-4 w-4" />
              <span>{avgRating.toFixed(1)} ({count.toLocaleString("he-IL")})</span>
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {userId && (
            <div className="card p-4">
              <p className="mb-2 text-sm font-bold text-gray-300">הדירוג והתגובה שלי</p>
              <StarRow value={myRating} onChange={setMyRating} />
              <textarea
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                rows={2}
                maxLength={400}
                className="input-field mt-2"
                placeholder="תגובה (אופציונלי - נפתח אחרי 5 אפליקציות/תוכנות שהעליתם)"
              />
              {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
              <div className="mt-2 flex gap-2">
                <button onClick={submit} disabled={busy || myRating < 1} className="btn-primary text-sm">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} שליחה
                </button>
                {myRating > 0 && (
                  <button onClick={removeMine} disabled={busy} className="btn-ghost text-sm text-red-400 hover:text-red-300">
                    <Trash2 className="h-4 w-4" /> מחיקת הדירוג שלי
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-sm text-gray-500">טוען...</p>
          ) : reviews.length === 0 ? (
            <p className="text-center text-sm text-gray-500">אין עדיין דירוגים או תגובות.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRow value={r.rating} size="h-3.5 w-3.5" />
                    <span className="text-xs font-bold text-gray-300">{r.user?.username ?? "משתמש"}</span>
                    <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString("he-IL")}</span>
                    {viewerIsStaff && r.user_id !== userId && (
                      <button
                        onClick={() => removeReview(r.user_id)}
                        disabled={busy}
                        className="ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold text-red-400 hover:bg-red-500/10"
                        title="מחיקת התגובה (פיקוח)"
                      >
                        <Trash2 className="h-3 w-3" /> מחיקה
                      </button>
                    )}
                  </div>
                  {r.comment && <p className="mt-1.5 text-sm text-gray-300">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
