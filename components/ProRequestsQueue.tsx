"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, MessageSquare } from "lucide-react";
import type { ProRequest } from "@/types/database";

export default function ProRequestsQueue({ requests }: { requests: ProRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    const res = await fetch(`/api/admin/pro/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminMessage: messages[id] ?? "" })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert("שגיאה בביצוע הפעולה");
  }

  if (requests.length === 0) {
    return <div className="card p-10 text-center text-gray-500">אין בקשות PRO ממתינות</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <div key={r.id} className="card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-white">{r.developer?.username}</p>
              <p className="text-xs text-gray-500">{r.developer?.email} · {r.developer?.points ?? 0} נקודות</p>
              {r.message && <p className="mt-1 text-sm text-gray-400">"{r.message}"</p>}
            </div>
            <div className="flex items-center gap-2">
              {busyId === r.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <>
                  <button onClick={() => act(r.id, "approve")} className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/25">
                    <Check className="h-3.5 w-3.5" /> אישור
                  </button>
                  <button onClick={() => act(r.id, "reject")} className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25">
                    <X className="h-3.5 w-3.5" /> דחייה
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0 text-gray-500" />
            <input
              value={messages[r.id] ?? ""}
              onChange={(e) => setMessages((m) => ({ ...m, [r.id]: e.target.value }))}
              placeholder="הודעה למפתח (אופציונלי - יוצג לו ליד הסטטוס)"
              className="input-field flex-1 py-1.5 text-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
