"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Check, X, Loader2, ExternalLink, HandHelping, Award } from "lucide-react";
import type { CommunityRequest } from "@/types/database";

// לשונית "בקשות קהילה" (מנהל ופיקוח): בקשות שמתנדב/מבקש סימנו "בוצעה" וממתינות לאישור.
// אישור סוגר את הבקשה ונותן למתנדב את המוניטין (+20). דחייה מחזירה אותה למתנדב להמשך טיפול.
export default function CommunityReviewQueue() {
  const router = useRouter();
  const [requests, setRequests] = useState<CommunityRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/community-requests", { cache: "no-store" });
      const json = await res.json();
      setRequests((json.requests ?? []).filter((r: CommunityRequest) => r.status === "pending_review"));
    } catch {
      setRequests([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve_fulfill" | "reject_fulfill") {
    if (action === "reject_fulfill" && !confirm("לדחות? הבקשה תחזור למתנדב להמשך טיפול.")) return;
    setBusyId(id);
    const res = await fetch(`/api/community-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyId(null);
    if (res.ok) {
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== id));
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "שגיאה בפעולה");
    }
  }

  if (requests === null) {
    return (
      <div className="card flex items-center justify-center p-10 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-400">
        בקשות שסומנו "בוצעה" וממתינות לאישור. באישור הבקשה נסגרת כבוצעה, והמתנדב מקבל <b className="text-gold">20 מוניטין</b>.
        {" "}
        <Link href="/community" className="text-primary-light hover:underline">ללוח בקשות הקהילה המלא</Link>
      </p>
      {requests.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <Users className="mx-auto mb-2 h-8 w-8" />
          אין בקשות קהילה שממתינות לאישור 🎉
        </div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-start justify-between gap-3 p-5">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white">{r.title}</h3>
              {r.note && <p className="mt-0.5 text-sm text-gray-400">{r.note}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {r.requester?.username && <span>ביקש/ה: <span className="text-gray-300">{r.requester.username}</span></span>}
                <span className="inline-flex items-center gap-1">
                  <HandHelping className="h-3.5 w-3.5" /> סימן/ה בוצעה:{" "}
                  <span className="font-bold text-primary-light">{r.fulfiller?.username ?? r.claimer?.username ?? "?"}</span>
                </span>
                {r.claimer?.username && r.claimer.username !== r.fulfiller?.username && (
                  <span className="inline-flex items-center gap-1"><Award className="h-3.5 w-3.5" /> המוניטין ל: <span className="text-gold">{r.claimer.username}</span></span>
                )}
                {r.source_link && (
                  <a href={r.source_link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary-light hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> הבקשה המקורית
                  </a>
                )}
                {r.fulfilled_app_id && (
                  <Link href={`/apps/${r.fulfilled_app_id}`} target="_blank" className="inline-flex items-center gap-1 text-accent hover:underline">
                    <Check className="h-3.5 w-3.5" /> לאפליקציה שהועלתה
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => act(r.id, "approve_fulfill")}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/25"
              >
                {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} אישור ביצוע (+20 מוניטין)
              </button>
              <button
                onClick={() => act(r.id, "reject_fulfill")}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
              >
                <X className="h-3.5 w-3.5" /> דחייה - עוד לא בוצע
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
