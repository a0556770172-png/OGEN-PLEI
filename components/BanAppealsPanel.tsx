"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareWarning, Send, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { BanAppeal } from "@/types/database";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "ממתין לתגובה", cls: "bg-gold/15 text-gold" },
  resolved: { label: "נפתר", cls: "bg-accent/15 text-accent" },
  rejected: { label: "נדחה", cls: "bg-red-500/15 text-red-400" }
};

// טאב "ערעורי חסימה" - צוות (מנהל/פיקוח) רואה כאן את כל הערעורים שמשתמשים חסומים כתבו
// (דרך app/banned/page.tsx), ויכול להגיב ולסמן כ"נפתר"/"נדחה". אם המשתמש עדיין חסום הוא
// יכול להמשיך לכתוב הודעות נוספות אחרי התגובה - זה מה שמחזיר את הסטטוס ל"ממתין" שוב.
export default function BanAppealsPanel({ appeals }: { appeals: BanAppeal[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  async function respond(id: string, status: "resolved" | "rejected" | "pending") {
    const adminReply = (replyDrafts[id] ?? "").trim();
    setBusyId(id);
    const res = await fetch(`/api/admin/ban-appeals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminReply: adminReply || undefined })
    });
    setBusyId(null);
    if (res.ok) {
      setReplyDrafts((d) => ({ ...d, [id]: "" }));
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בשליחת התגובה");
    }
  }

  if (appeals.length === 0) {
    return <div className="card p-8 text-center text-gray-500">אין עדיין ערעורי חסימה.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {appeals.map((a) => {
        const status = STATUS_LABEL[a.status] ?? STATUS_LABEL.pending;
        return (
          <div key={a.id} className="card flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <MessageSquareWarning className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold text-white">{a.user?.username ?? "משתמש"}</p>
                  <p className="text-xs text-gray-500">{a.user?.email}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.cls}`}>{status.label}</span>
            </div>

            {a.user?.banned && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-gray-400">
                <span className="font-bold text-red-400">חסום כרגע</span>
                {a.user.ban_reason ? ` · סיבה: ${a.user.ban_reason}` : ""}
                {" · "}
                {a.user.ban_expires_at ? `עד ${new Date(a.user.ban_expires_at).toLocaleString("he-IL")}` : "לצמיתות"}
                <span className="mt-1 block text-gray-500">"סימון כנפתר" רק סוגר את הערעור - כדי לבטל את החסימה בפועל יש לעשות זאת בטאב "משתמשים".</span>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-surface2 p-3 text-sm text-gray-300">
              <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" /> {new Date(a.updated_at).toLocaleString("he-IL")}
              </p>
              {a.message}
            </div>

            {a.admin_reply && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-gray-300">
                <p className="mb-1 text-xs font-bold text-primary-light">תגובת הצוות הקודמת</p>
                {a.admin_reply}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={replyDrafts[a.id] ?? ""}
                onChange={(e) => setReplyDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                placeholder="תגובה למשתמש (אופציונלי)..."
                className="input-field flex-1"
              />
              {busyId === a.id ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin self-center text-gray-400" />
              ) : (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => respond(a.id, "resolved")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/25"
                  >
                    <CheckCircle2 className="h-4 w-4" /> סימון כנפתר
                  </button>
                  <button
                    onClick={() => respond(a.id, "rejected")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25"
                  >
                    <XCircle className="h-4 w-4" /> דחייה
                  </button>
                  <button
                    onClick={() => respond(a.id, "pending")}
                    title="שלח תגובה בלי לשנות סטטוס"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-surface2/70"
                  >
                    <Send className="h-4 w-4" /> שליחת תגובה בלבד
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
