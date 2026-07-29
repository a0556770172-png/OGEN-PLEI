"use client";
import { useEffect, useState } from "react";
import { Check, X, Loader2, Gift, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AppSuggestion } from "@/types/database";
import { formatFileSize } from "@/lib/format";

export default function SuggestionsQueue() {
  const supabase = createClient();
  const [suggestions, setSuggestions] = useState<AppSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("app_suggestions")
      .select("*, suggester:profiles!app_suggestions_suggested_by_fkey(username, email, points)")
      .order("status", { ascending: true })
      .order("created_at", { ascending: true });
    setSuggestions((data as unknown as AppSuggestion[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function download(id: string) {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/suggestions/${id}/download`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בהורדה");
      window.open(json.url, "_blank");
    } catch (err: any) {
      alert(err.message || "שגיאה בהורדת הקובץ");
    } finally {
      setDownloadingId(null);
    }
  }

  async function act(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    const res = await fetch(`/api/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    setBusyId(null);
    if (res.ok) await load();
    else alert("שגיאה בביצוע הפעולה");
  }

  if (loading) return <div className="card p-10 text-center text-gray-500">טוען הצעות...</div>;
  if (suggestions.length === 0) {
    return (
      <div className="card p-10 text-center text-gray-500">
        <Gift className="mx-auto mb-2 h-8 w-8" />
        אין הצעות אפליקציות כרגע.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-bold text-white">{s.app_name}</p>
            <p className="text-xs text-gray-500">
              הוצע ע"י {s.suggester?.username ?? s.suggester?.email} · {s.suggester?.points ?? 0} נק'
            </p>
            {s.file_name && (
              <p className="text-xs text-gray-500">
                קובץ: {s.file_name} {s.file_size_bytes ? `(${formatFileSize(s.file_size_bytes)})` : ""}
              </p>
            )}
            {s.note && <p className="mt-1 text-sm text-gray-400">"{s.note}"</p>}
          </div>
          <div className="flex items-center gap-2">
            {s.file_key && (
              <button
                onClick={() => download(s.id)}
                disabled={downloadingId === s.id}
                className="inline-flex items-center gap-1 rounded-xl bg-surface2 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white"
              >
                {downloadingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                הורדת הקובץ
              </button>
            )}
            {s.status === "pending" ? (
              busyId === s.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <>
                  <button onClick={() => act(s.id, "approved")} className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/25">
                    <Check className="h-3.5 w-3.5" /> אישור (+5 נק')
                  </button>
                  <button onClick={() => act(s.id, "rejected")} className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25">
                    <X className="h-3.5 w-3.5" /> דחייה
                  </button>
                </>
              )
            ) : (
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.status === "approved" ? "bg-accent/15 text-accent" : "bg-gray-500/15 text-gray-400"}`}>
                {s.status === "approved" ? "אושרה" : "נדחתה"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
