"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Loader2, Send, Trash2, CheckCircle2 } from "lucide-react";

export default function SiteReviewForm({
  loggedIn,
  initial
}: {
  loggedIn: boolean;
  initial: { rating: number; comment: string | null } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [held, setHeld] = useState("");

  if (!loggedIn) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-gray-300">כדי לדרג ולכתוב על האתר צריך להתחבר.</p>
        <Link href="/login?redirect=/site-reviews" className="btn-primary">התחברות</Link>
      </div>
    );
  }

  async function save() {
    if (rating < 1) {
      setError("בחרו דירוג כוכבים");
      return;
    }
    setBusy(true);
    setError("");
    setHeld("");
    const res = await fetch("/api/site-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment })
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j.error || "שגיאה בשמירה");
      return;
    }
    if (j.held) {
      setHeld(j.message || "הביקורת נשמרה אך לא פורסמה - היא לא עברה את הסינון האוטומטי.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm("למחוק את הביקורת שלך?")) return;
    setBusy(true);
    await fetch("/api/site-reviews", { method: "DELETE" });
    setBusy(false);
    setRating(0);
    setComment("");
    router.refresh();
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="text-lg font-bold text-white">{initial ? "הביקורת שלך" : "מה דעתך על עוגן פליי?"}</h2>

      <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="transition-transform hover:scale-110"
            aria-label={`${n} כוכבים`}
          >
            <Star
              className={`h-8 w-8 ${
                (hover || rating) >= n ? "fill-gold text-gold" : "text-gray-600"
              }`}
            />
          </button>
        ))}
        {rating > 0 && <span className="ms-2 text-sm text-gray-400">{rating}/5</span>}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        maxLength={1500}
        placeholder="ספרו לכולם מה אתם אוהבים באתר, מה עוזר לכם, ומה אפשר לשפר..."
        className="input-field resize-none"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {held && (
        <p className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">{held}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {saved ? "פורסם!" : initial ? "עדכון הביקורת" : "פרסום הביקורת"}
        </button>
        {initial && (
          <button onClick={remove} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
            <Trash2 className="me-1 inline h-3.5 w-3.5" /> מחיקה
          </button>
        )}
      </div>
    </div>
  );
}
