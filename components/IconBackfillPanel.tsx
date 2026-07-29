"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type FailedItem = { id: string; ok: boolean; reason?: string; detail?: string };

export default function IconBackfillPanel() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [ranAtLeastOnce, setRanAtLeastOnce] = useState(false);

  async function runOnce() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/apps/backfill-icons", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "שגיאה בחילוץ האייקונים");
        setRunning(false);
        return;
      }
      setRanAtLeastOnce(true);
      setSucceeded((prev) => prev + json.succeeded);
      setFailed((prev) => [...prev, ...json.failed]);
      router.refresh();
      if (json.remaining > 0 && json.processed > 0) {
        setTimeout(runOnce, 400);
        return;
      }
    } catch {
      alert("שגיאה בחילוץ האייקונים");
    }
    setRunning(false);
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <ImagePlus className="h-4 w-4 text-primary-light" /> חילוץ אייקונים למפרע
      </div>
      <p className="text-xs text-gray-400">
        מריץ את מנגנון חילוץ האייקון האוטומטי על כל האפליקציות (APK) שכבר פורסמו בלי אייקון. תהליך אוטומטי, אין צורך
        להעלות מחדש שום דבר.
      </p>
      <div className="flex items-center gap-3">
        <button onClick={runOnce} disabled={running} className="btn-primary text-sm">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {running ? "מריץ..." : "הרץ חילוץ אייקונים חסרים"}
        </button>
        {ranAtLeastOnce && !running && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            {succeeded} הצליחו, {failed.length} נכשלו
          </span>
        )}
      </div>

      {failed.length > 0 && !running && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> פירוט הכשלים (שימושי לאבחון):
          </div>
          {failed.map((f, i) => (
            <div key={`${f.id}-${i}`} className="text-xs text-gray-400">
              <span className="font-mono text-gray-500">{f.id.slice(0, 8)}...</span> — {f.reason}
              {f.detail && <span className="text-gray-500"> ({f.detail})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
