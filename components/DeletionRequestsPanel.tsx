"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ShieldAlert } from "lucide-react";
import type { UserDeletionRequest } from "@/types/database";

// פאנל למנהל בפועל בלבד - מציג בקשות מחיקת משתמש שהגיש צוות פיקוח, וממתינות לאישורו.
// אישור מבצע בפועל את המחיקה הבלתי הפיכה; דחייה רק סוגרת את הבקשה בלי למחוק כלום.
export default function DeletionRequestsPanel({ requests }: { requests: UserDeletionRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    if (action === "approve") {
      const ok = window.confirm("לאשר את מחיקת המשתמש? הפעולה בלתי הפיכה - כל האפליקציות, הקבצים והחשבון שלו יימחקו לצמיתות.");
      if (!ok) return;
    }
    setBusyId(id);
    const res = await fetch(`/api/admin/deletion-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בביצוע הפעולה");
    }
  }

  if (requests.length === 0) {
    return <div className="card p-8 text-center text-gray-500">אין בקשות מחיקת משתמשים ממתינות.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <div key={r.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white">
                בקשה למחיקת המשתמש <span className="text-red-400">{r.target?.username ?? "לא ידוע"}</span>
              </p>
              <p className="text-xs text-gray-500">{r.target?.email}</p>
              <p className="mt-1 text-xs text-gray-400">
                הוגשה ע"י {r.requester?.username ?? "צוות פיקוח"}
                {r.reason ? ` · סיבה: ${r.reason}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {busyId === r.id ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <>
                <button
                  onClick={() => act(r.id, "approve")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25"
                >
                  <Check className="h-4 w-4" /> אשר מחיקה
                </button>
                <button
                  onClick={() => act(r.id, "reject")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-surface2/70"
                >
                  <X className="h-4 w-4" /> דחה
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
