"use client";
import { useCallback, useRef, useState } from "react";
import { ShieldAlert, Globe, Lock, CheckCircle2 } from "lucide-react";

type AskOptions = {
  appName: string;
  // איזה סוג העלאה זו: פרטית (העלאה ישירה של מפתח) או ציבורית (הוספה למאגר / עדכון ציבורי)
  kind: "private" | "public";
  extra?: string;
};

// תזכורת שקופצת לצוות הפיקוח/המנהל בכל אישור אפליקציה (חדשה, הצעה ציבורית או גרסה חדשה):
// לבדוק שהמשתמש העלה אותה כחוק ובמקום הנכון - פרטי או ציבורי. שימוש:
//   const { ask, dialog } = useApprovalReminder();
//   if (!(await ask({ appName, kind }))) return;
//   ...ובתוך ה-JSX: {dialog}
export function useApprovalReminder() {
  const [opts, setOpts] = useState<AskOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback((o: AskOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpts(o);
    });
  }, []);

  function finish(ok: boolean) {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOpts(null);
  }

  const dialog = opts ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" dir="rtl" onClick={(e) => e.target === e.currentTarget && finish(false)}>
      <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-surface p-6">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-gold" />
          <h2 className="text-lg font-bold text-white">רגע לפני האישור</h2>
        </div>
        <p className="mb-3 text-sm text-gray-300">
          לפני שמאשרים את <b className="text-white">{opts.appName}</b> - בדקו שהמשתמש העלה אותה כחוק ובמקום הנכון:
        </p>
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/10 bg-surface2 p-3 text-sm text-gray-300">
          {opts.kind === "private" ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> : <Globe className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
          {opts.kind === "private" ? (
            <span>
              זו העלאה <b className="text-white">פרטית</b> - מותרת רק למי שפיתח את האפליקציה בעצמו או שהזכויות עליה שלו. אפליקציה של מישהו אחר
              צריכה לעלות כהצעה <b className="text-white">ציבורית</b> (הוספה למאגר).
            </span>
          ) : (
            <span>
              זו העלאה <b className="text-white">ציבורית</b> - מתאימה לאפליקציה של מפתח אחר. אם מי שהעלה הוא המפתח עצמו, המקום הנכון הוא העלאה
              <b className="text-white"> פרטית</b>.
            </span>
          )}
        </div>
        <ul className="mb-4 flex list-disc flex-col gap-1 pe-5 text-xs text-gray-400">
          <li>שהאפליקציה לא כבר קיימת באתר (כפילות)</li>
          <li>שהתוכן תקין לפי חוקי האתר</li>
        </ul>
        {opts.extra && <p className="mb-4 text-xs text-gold">{opts.extra}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => finish(true)} className="btn-primary flex-1">
            <CheckCircle2 className="h-4 w-4" /> בדקתי - אישור
          </button>
          <button onClick={() => finish(false)} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white">
            ביטול
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}
