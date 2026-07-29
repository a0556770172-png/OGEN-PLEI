"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, CheckCircle2 } from "lucide-react";

export default function IconBackfillPanel() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ succeeded: number; failedCount: number; remaining: number } | null>(null);

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
      setSummary((prev) => ({
        succeeded: (prev?.succeeded ?? 0) + json.succeeded,
        failedCount: (prev?.failedCount ?? 0) + json.failed.length,
        remaining: json.remaining
      }));
      router.refresh();
      // אם נשארו עוד אפליקציות ללא אייקון, ממשיכים אוטומטית לאצווה הבאה
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
        {summary && !running && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            {summary.succeeded} אייקונים חולצו בהצלחה{summary.failedCount > 0 ? `, ${summary.failedCount} נכשלו (בד"כ אייקון אדפטיבי שהמנגנון לא יודע להרכיב)` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
