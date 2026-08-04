"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2, Gift, Download, ShieldQuestion, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AppSuggestion } from "@/types/database";
import { formatFileSize } from "@/lib/format";

type VerifyResult = { status: string; visibleToPublic: boolean } | { error: string };

export default function SuggestionsQueue() {
  const supabase = createClient();
  const [suggestions, setSuggestions] = useState<AppSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});

  async function verify(appId: string) {
    setVerifyingId(appId);
    try {
      const res = await fetch(`/api/admin/apps/${appId}/verify`, { cache: "no-store" });
      const json = await res.json();
      setVerifyResults((prev) => ({ ...prev, [appId]: res.ok ? json : { error: json.error || "שגיאה בבדיקה" } }));
    } catch {
      setVerifyResults((prev) => ({ ...prev, [appId]: { error: "שגיאה בבדיקה" } }));
    }
    setVerifyingId(null);
  }

  // מציג רק הצעות שממתינות לאישור - הצעות שכבר אושרו נמצאות עכשיו בטאב "כל האפליקציות"
  // (הן הפכו לאפליקציה רגילה שם), ואין טעם שיישארו כאן גם כן וידחסו את התור.
  async function load() {
    const { data } = await supabase
      .from("app_suggestions")
      .select("*, suggester:profiles!app_suggestions_suggested_by_fkey(username, email, points)")
      .eq("status", "pending")
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
        <div key={s.id} className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            {!s.file_key && (
              <p className="mt-1 text-xs font-bold text-gold">אין קובץ מצורף להצעה זו - אישור לא יפרסם אותה אוטומטית בחנות.</p>
            )}
            {s.developer_name && (
              <p className="mt-1 text-xs text-gray-400">מפתח/חברת פיתוח שצוין: <span className="font-bold text-white">{s.developer_name}</span></p>
            )}
            {s.short_description && <p className="mt-1 text-sm text-gray-300">{s.short_description}</p>}
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
            {s.created_app_id && (
              <button
                onClick={() => verify(s.created_app_id!)}
                disabled={verifyingId === s.created_app_id}
                className="inline-flex items-center gap-1 rounded-xl bg-surface2 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white"
              >
                {verifyingId === s.created_app_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldQuestion className="h-3.5 w-3.5" />}
                בדיקת פרסום בוודאות
              </button>
            )}
            {s.status === "pending" ? (
              busyId === s.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <>
                  <button onClick={() => act(s.id, "approved")} className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/25">
                    <Check className="h-3.5 w-3.5" /> {s.file_key ? "אישור ופרסום בחנות (+5 נק')" : "אישור (+5 נק')"}
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

        {s.created_app_id && (
          <Link href={`/apps/${s.created_app_id}`} target="_blank" className="inline-flex w-fit items-center gap-1 text-xs font-bold text-primary-light hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> צפייה באפליקציה שפורסמה בחנות
          </Link>
        )}

        {s.created_app_id && verifyResults[s.created_app_id!] && (
          "error" in verifyResults[s.created_app_id!] ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              <XCircle className="h-4 w-4 shrink-0" /> {(verifyResults[s.created_app_id!] as { error: string }).error}
            </div>
          ) : (verifyResults[s.created_app_id!] as { visibleToPublic: boolean }).visibleToPublic ? (
            <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> כן, בוודאות - האפליקציה מוצגת כרגע בחנות לכל מבקר.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              לא, האפליקציה לא מוצגת בחנות כרגע (סטטוס: {(verifyResults[s.created_app_id!] as { status: string }).status}).
            </div>
          )
        )}
        </div>
      ))}
    </div>
  );
}
