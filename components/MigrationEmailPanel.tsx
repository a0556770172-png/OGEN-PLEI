"use client";
import { useEffect, useState } from "react";
import { Mail, Loader2, Send, CheckCircle2 } from "lucide-react";

type Status = { total: number; sent: number; remaining: number; lastSentAt: string | null };

export default function MigrationEmailPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/admin/broadcast-migration-email");
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function send() {
    if (!status) return;
    const ok = confirm(
      `שליחת הודעת "עברנו לבית חדש" ל-${status.remaining} משתמשים (מתוך ${status.total}) שעדיין לא קיבלו אותה, במייל מותאם אישית לכל אחד. להמשיך?`
    );
    if (!ok) return;

    setBusy(true);
    setResultMsg(null);
    const res = await fetch("/api/admin/broadcast-migration-email", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setResultMsg(j.error || "שגיאה בשליחה");
      return;
    }

    setStatus({ total: j.total, sent: j.sent, remaining: j.remaining, lastSentAt: j.lastSentAt });
    if (j.stoppedEarly) {
      setResultMsg(`נשלחו ${j.sentNow} מיילים ואז נעצר (${j.stopReason}). נשארו ${j.remaining} - אפשר ללחוץ שוב מאוחר יותר (לדוגמה מחר, אם זו מגבלת מכסה יומית).`);
    } else if (j.sentNow === 0) {
      setResultMsg("כל המשתמשים כבר קיבלו את ההודעה הזו.");
    } else {
      setResultMsg(`נשלחו בהצלחה ${j.sentNow} מיילים.`);
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-white">
        <Mail className="h-5 w-5 text-primary-light" /> הודעת מייל על המעבר לדומיין החדש
      </div>
      <p className="text-sm text-gray-400">
        שולח לכל המשתמשים הרשומים מייל מותאם אישית (בפנייה בשם המשתמש) שמודיע על המעבר ל-ogenplay.com, כולל אזהרה
        שקישורי הורדה ישנים שכבר שותפו הפסיקו לעבוד. אפשר ללחוץ שוב בבטחה - מי שכבר קיבל בהצלחה לא יקבל שוב, כך
        שאם השליחה נעצרת באמצע (למשל מגבלת מכסה יומית של ספק המייל) פשוט ממשיכים מאוחר יותר מאותה נקודה.
      </p>

      {status && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-300">סה&quot;כ משתמשים: <b className="text-white">{status.total}</b></span>
          <span className="text-emerald-400">כבר נשלח ל: <b>{status.sent}</b></span>
          <span className="text-amber-400">נותרו: <b>{status.remaining}</b></span>
          {status.lastSentAt && (
            <span className="text-gray-500">שליחה אחרונה: {new Date(status.lastSentAt).toLocaleString("he-IL")}</span>
          )}
        </div>
      )}

      <button
        onClick={send}
        disabled={busy || !status || status.remaining === 0}
        className="flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : status?.remaining === 0 ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {status?.remaining === 0 ? "נשלח לכולם" : `שליחה ל-${status?.remaining ?? "..."} משתמשים`}
      </button>

      {resultMsg && <p className="text-sm text-gray-300">{resultMsg}</p>}
    </div>
  );
}
