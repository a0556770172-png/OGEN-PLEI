"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Lock, Share2, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AdInterstitial from "./AdInterstitial";
import { shouldShowAd } from "@/lib/adThrottle";
import type { AppStatus } from "@/types/database";

function ShareButton({ appId }: { appId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // תמיד בונים את הכתובת הקנונית של עמוד האפליקציה מ-appId - ולא window.location.href,
    // כי כשהאפליקציה נפתחת בחלונית צפה (Modal) מדף הבית, ה-URL בשורת הכתובת עדיין מצביע
    // על דף הבית, וזה גרם לשיתוף קישור לאתר הכללי במקום לאפליקציה עצמה.
    const url = `${window.location.origin}/apps/${appId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // גיבוי למקרה שה-clipboard API חסום (למשל דפדפן ישן/הרשאות) - מציגים prompt עם הקישור
      window.prompt("העתיקו את הקישור:", url);
    }
  }

  return (
    <button onClick={handleShare} className="btn-primary">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "הקישור הועתק!" : "שיתוף"}
    </button>
  );
}

export default function DownloadButton({
  appId,
  status,
  downloadsCount,
  isPaused,
  extra
}: {
  appId: string;
  status: AppStatus;
  downloadsCount: number;
  isPaused?: boolean;
  // כפתורים נוספים (כמו "דיווח על האפליקציה") שצריכים לשבת באותה שורה בדיוק, באותו גובה -
  // מוצג בתוך אותו div של flex-wrap כדי שלא ייווצר קינון עקום שדוחף אותו למקום מוזר.
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(downloadsCount);
  const [alreadyDownloaded, setAlreadyDownloaded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    fetch(`/api/apps/${appId}/download-status`)
      .then((r) => r.json())
      .then((json) => setAlreadyDownloaded(!!json.alreadyDownloaded))
      .catch(() => {});
  }, [appId]);

  async function actuallyDownload() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/download/${appId}`, { method: "POST" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "אירעה שגיאה בהורדה");
      return;
    }
    setCount((c) => c + 1);
    setAlreadyDownloaded(true);
    window.location.href = json.url;
  }

  async function handleDownload() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/apps/${appId}`);
      return;
    }
    // אם המשתמש כבר הוריד את האפליקציה הזו בעבר - שואלים לפני שממשיכים, כדי למנוע הורדה
    // כפולה בטעות (למשל לחיצה שוב על אותה אפליקציה מבלי לשים לב).
    if (alreadyDownloaded) {
      setConfirmOpen(true);
      return;
    }
    // "פרסומת" קצרה של 3 שניות לפני ההורדה בפועל - קידום אפשרות הפרסום באתר.
    // עד 3 פעמים ביום לכל דפדפן, כדי לא להטריד יותר מדי משתמשים שמורידים הרבה.
    if (shouldShowAd()) setShowAd(true);
    else await actuallyDownload();
  }

  if (status !== "approved") {
    return (
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <div className="flex flex-wrap items-center gap-2">
          <button disabled className="btn-ghost opacity-60">האפליקציה אינה זמינה להורדה כעת</button>
          <ShareButton appId={appId} />
          {extra}
        </div>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <div className="flex flex-wrap items-center gap-2">
          <button disabled className="btn-ghost opacity-60">המפתח השהה זמנית את ההורדה של האפליקציה הזו</button>
          <ShareButton appId={appId} />
          {extra}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={handleDownload} disabled={loading} className="btn-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {loading ? "מכין הורדה..." : `הורדה (${count.toLocaleString("he-IL")})`}
        </button>
        <ShareButton appId={appId} />
        {extra}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="flex items-center gap-1 text-xs text-gray-500"><Lock className="h-3 w-3" /> נדרשת התחברות להורדה</p>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gold/30 bg-surface p-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="font-bold text-white">כבר הורדתם את האפליקציה הזו בעבר</p>
            <p className="mt-1 text-sm text-gray-400">רוצים להוריד אותה שוב בכל זאת?</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white">
                אל תוריד
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  if (shouldShowAd()) setShowAd(true);
                  else actuallyDownload();
                }}
                className="btn-primary flex-1 justify-center"
              >
                הורד בכל זאת
              </button>
            </div>
          </div>
        </div>
      )}

      {showAd && <AdInterstitial onDone={() => { setShowAd(false); actuallyDownload(); }} />}
    </div>
  );
}
