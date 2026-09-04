"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import type { SiteReviewRow } from "@/lib/siteReviews";

export default function SiteReviewsPanel({ reviews }: { reviews: SiteReviewRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, method: "PATCH" | "DELETE", body?: any) {
    setBusy(id);
    await fetch(`/api/admin/site-reviews/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    setBusy(null);
    router.refresh();
  }

  const avg = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="card flex items-center gap-4 p-4">
        <span className="text-2xl font-black text-white">{avg || "—"}</span>
        <span className="text-sm text-gray-400">{reviews.length} ביקורות (כולל מוסתרות)</span>
      </div>

      {reviews.length === 0 ? (
        <p className="card p-6 text-center text-sm text-gray-500">אין ביקורות עדיין.</p>
      ) : (
        reviews.map((r) => (
          <div key={r.id} className={`card flex flex-col gap-2 p-4 ${r.hidden ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white">{r.username}</span>
              <span className="inline-flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${r.rating >= n ? "fill-gold text-gold" : "text-gray-600"}`} />
                ))}
              </span>
              <span className="text-xs text-gray-600">{new Date(r.created_at).toLocaleDateString("he-IL")}</span>
              {r.autoHidden ? (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">נחסם ע"י סינון AI</span>
              ) : r.hidden ? (
                <span className="rounded-full bg-gray-500/15 px-2 py-0.5 text-[10px] font-bold text-gray-400">מוסתר ידנית</span>
              ) : null}
            </div>
            {r.moderationReason && <p className="text-xs text-red-400">סיבת הסינון: {r.moderationReason}</p>}
            {r.comment && <p className="whitespace-pre-wrap text-sm text-gray-300">{r.comment}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => act(r.id, "PATCH", { hidden: !r.hidden })}
                disabled={busy === r.id}
                className="btn-ghost text-xs"
              >
                {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : r.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {r.hidden ? "הצגה" : "הסתרה"}
              </button>
              <button
                onClick={() => confirm("למחוק את הביקורת?") && act(r.id, "DELETE")}
                disabled={busy === r.id}
                className="rounded-lg px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="me-1 inline h-3.5 w-3.5" /> מחיקה
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
