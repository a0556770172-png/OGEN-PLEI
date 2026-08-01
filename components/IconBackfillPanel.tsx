"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, CheckCircle2, XCircle, Terminal, ChevronDown, ChevronUp } from "lucide-react";

type ResultItem = { id: string; name: string; ok: boolean; reason?: string; detail?: string; ms: number };
type LogLine = { text: string; kind: "info" | "ok" | "fail" };

function formatSeconds(sec: number) {
  if (sec < 60) return `${Math.ceil(sec)} שניות`;
  const min = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${min} דק' ${s} שנ'`;
}

export default function IconBackfillPanel() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [succeeded, setSucceeded] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [ranAtLeastOnce, setRanAtLeastOnce] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const avgBatchMsRef = useRef<number | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pushLog(text: string, kind: LogLine["kind"] = "info") {
    setLogs((prev) => [...prev, { text: `[${new Date().toLocaleTimeString("he-IL")}] ${text}`, kind }]);
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function stopElapsedTimer() {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  async function runOnce() {
    const batchStarted = Date.now();
    pushLog("שולח בקשה לחלץ אצווה נוספת (עד 8 אפליקציות)...");
    try {
      const res = await fetch("/api/admin/apps/backfill-icons", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        pushLog(json.error || "שגיאה בחילוץ האייקונים", "fail");
        alert(json.error || "שגיאה בחילוץ האייקונים");
        setRunning(false);
        stopElapsedTimer();
        return;
      }
      setRanAtLeastOnce(true);
      setSucceeded((prev) => prev + json.succeeded);
      setFailedCount((prev) => prev + json.failed.length);

      if (json.processed === 0) {
        pushLog("לא נמצאו יותר אפליקציות שחסר להן אייקון. סיום.", "ok");
      } else {
        (json.results as ResultItem[]).forEach((r) => {
          const timeStr = `${(r.ms / 1000).toFixed(1)} שנ'`;
          if (r.ok) {
            pushLog(`✓ "${r.name}" — חולץ אייקון בהצלחה (${timeStr})`, "ok");
          } else {
            pushLog(`✗ "${r.name}" — נכשל: ${r.reason}${r.detail ? ` (${r.detail})` : ""} (${timeStr})`, "fail");
          }
        });
      }

      const batchMs = json.batchMs ?? Date.now() - batchStarted;
      avgBatchMsRef.current = avgBatchMsRef.current ? (avgBatchMsRef.current + batchMs) / 2 : batchMs;

      setRemaining(json.remaining);
      if (json.remaining > 0 && json.processed > 0) {
        // כל קריאה מטפלת עכשיו באפליקציה אחת בלבד (ראו הסבר ב-route.ts), אז מספר הקריאות
        // שנותרו שווה בדיוק למספר האפליקציות שנותרו.
        const eta = (json.remaining * (avgBatchMsRef.current ?? batchMs)) / 1000;
        setEtaSec(eta);
        pushLog(`נשארו ${json.remaining} אפליקציות בלי אייקון, ממשיך אוטומטית... (הערכה: כ-${formatSeconds(eta)})`);
        router.refresh();
        setTimeout(runOnce, 400);
        return;
      }

      setEtaSec(0);
      router.refresh();
      pushLog(`הסתיים. סה"כ ${succeeded + json.succeeded} הצליחו, ${failedCount + json.failed.length} נכשלו.`, "ok");
    } catch {
      pushLog("שגיאת רשת - התהליך נעצר", "fail");
      alert("שגיאה בחילוץ האייקונים");
    }
    setRunning(false);
    stopElapsedTimer();
  }

  function start() {
    setRunning(true);
    setLogs([]);
    setEtaSec(null);
    setRemaining(null);
    setSucceeded(0);
    setFailedCount(0);
    setElapsedSec(0);
    startTimeRef.current = Date.now();
    avgBatchMsRef.current = null;
    stopElapsedTimer();
    elapsedTimerRef.current = setInterval(() => {
      if (startTimeRef.current) setElapsedSec((Date.now() - startTimeRef.current) / 1000);
    }, 1000);
    pushLog("מתחיל תהליך חילוץ אייקונים למפרע...");
    runOnce();
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <ImagePlus className="h-4 w-4 text-primary-light" /> חילוץ אייקונים למפרע
      </div>
      <p className="text-xs text-gray-400">
        מריץ את מנגנון חילוץ האייקון האוטומטי על כל האפליקציות (APK / APKS) שכבר פורסמו בלי אייקון. תהליך אוטומטי, אין
        צורך להעלות מחדש שום דבר. עובד על אפליקציה אחת בכל פעם (כדי לא לחרוג ממגבלת הזמן של Vercel), אז יכול
        לקחת כמה דקות אם יש הרבה אפליקציות - אפשר לעקוב אחרי ההתקדמות בלוג למטה. אפליקציות עם קובץ גדול מ-35MB
        לא ניתנות לחילוץ אוטומטי (יופיע כישלון עם הסיבה "הקובץ גדול מדי") - עבורן יש להעלות אייקון ידנית.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={start} disabled={running} className="btn-primary text-sm">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {running ? "מריץ..." : "הרץ חילוץ אייקונים חסרים"}
        </button>
        {ranAtLeastOnce && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            {succeeded} הצליחו, {failedCount} נכשלו
          </span>
        )}
        {running && (
          <span className="inline-flex items-center gap-3 text-xs text-gray-400">
            <span>זמן שחלף: {formatSeconds(elapsedSec)}</span>
            {remaining !== null && <span>נותרו: {remaining}</span>}
            {etaSec !== null && etaSec > 0 && <span>הערכת זמן שנותר: {formatSeconds(etaSec)}</span>}
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setLogOpen((v) => !v)}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-gray-300 hover:text-white"
          >
            <Terminal className="h-3.5 w-3.5" />
            לוג פעילות ({logs.length})
            {logOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {logOpen && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.kind === "ok" ? "text-emerald-400" : l.kind === "fail" ? "text-red-400" : "text-gray-400"
                  }
                >
                  {l.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
