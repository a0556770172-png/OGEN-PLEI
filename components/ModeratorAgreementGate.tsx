"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

// שער חובה שקופץ מייד לכל חבר צוות פיקוח (is_moderator) שעדיין לא חתם על הסכם התפקיד
// (moderator_agreement_signed_at is null) - בכל עמוד באתר, מיד עם הכניסה או אם כבר מחובר.
// חוסם גישה לכל האתר עד לחתימה + אישור כפול. מנהל בפועל (role === "admin") לא נדרש בכך,
// גם אם יש לו איזשהו is_moderator ישן - התפקיד שלו כבר עליון.
export default function ModeratorAgreementGate() {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checked, setChecked] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const [step, setStep] = useState<"read" | "final-confirm">("read");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setProfile(null); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (active) setProfile(data as Profile);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { sub.subscription.unsubscribe(); };
  }, [pathname]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true);
  }

  async function submitSignature() {
    setSubmitting(true);
    const res = await fetch("/api/moderator/sign-agreement", { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      setProfile((p) => (p ? { ...p, moderator_agreement_signed_at: new Date().toISOString() } : p));
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בשמירת החתימה, נסה שוב");
    }
  }

  const shouldShow = !!profile && profile.is_moderator && profile.role !== "admin" && !profile.moderator_agreement_signed_at;
  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">הסכם צוות פיקוח - עוגן פליי</h2>
            <p className="text-xs text-gray-500">חובה לקרוא ולחתום לפני הכניסה לממשק הפיקוח</p>
          </div>
        </div>

        {step === "read" && (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-gray-300"
            >
              <p className="mb-4 font-bold text-white">מסמך הבנות והגדרת תפקיד – חבר צוות פיקוח</p>

              <p className="mb-1 font-bold text-primary-light">1. מטרה ותפקיד</p>
              <p className="mb-4">
                חבר צוות הפיקוח משמש כזרוע הימנית של ההנהלה בניהול השוטף של האתר "עוגן פליי". תפקידו לשמור על רמת
                האיכות, הסדר וההתאמה לקהל היעד החרדי בכל תוכן שמפורסם באתר - כולל בדיקת אפליקציות ותוכנות, הצעות
                ציבוריות, ופניות משתמשים. הוא פועל מטעם ההנהלה ובסמכותה, אך בכפוף לכללים שלהלן.
              </p>

              <p className="mb-1 font-bold text-primary-light">2. זמינות</p>
              <p className="mb-4">
                מדובר בתפקיד עם התחייבות לאורך שנה מלאה, ולא באופן מזדמן. חבר הצוות מתחייב להיות זמין וקשוב באופן
                שוטף, ובמיוחד לכסות על ההנהלה בתקופות שבהן היא אינה זמינה כלל - ובראשן "זמן" הישיבה, שבהן מנהל
                האתר אינו ניתן להשגה כמעט לחלוטין. בתקופות אלו האחריות לתפעול השוטף של האתר עוברת בפועל לצוות
                הפיקוח.
              </p>

              <p className="mb-1 font-bold text-primary-light">3. בקרת איכות</p>
              <p className="mb-4">
                כל תוכן שמאושר לפרסום עובר בדיקה קפדנית. כלל מחייב: בקשה ציבורית (הצעת אפליקציה ע"י משתמש) תאושר
                <strong> רק </strong> אם מדובר באפליקציה עם למעלה ממיליון (1,000,000+) הורדות, <strong>או</strong>
                אפליקציה שמספקת תועלת יומיומית ברורה ומשמעותית למשתמש. בקשות שלא עומדות בקריטריון הזה יידחו, גם אם
                נראות "תמימות" או שימושיות באופן כללי.
              </p>

              <p className="mb-1 font-bold text-primary-light">4. ניהול משתמשים ואכיפה</p>
              <p className="mb-4">
                חבר הצוות אחראי לשמור על סדר וניקיון באתר - זיהוי וטיפול בספאם, תוכן פוגעני, ניצול לרעה של מערכת
                הנקודות/ההורדות, והתנהגות שאינה הולמת. הרשאות החסימה והנעילה ניתנות לשימוש ישיר, אך מחיקת חשבון
                משתמש לצמיתות אינה בסמכותו הבלעדית - כל בקשת מחיקה מועברת לאישור ההנהלה בפועל, ורק לאחר אישור
                מפורש ממנה מתבצעת המחיקה בפועל.
              </p>

              <p className="mb-1 font-bold text-primary-light">5. שיווק וקידום</p>
              <p className="mb-4">
                חבר הצוות מסייע בקידום האתר בפורומים ובקהילות רלוונטיות, ומייצג את האתר בכבוד ובאחריות בכל אינטראקציה
                ציבורית מטעמו.
              </p>

              <p className="mb-1 font-bold text-primary-light">6. מחויבות ארוכת טווח</p>
              <p className="mb-1">
                התפקיד דורש מחויבות אמיתית וארוכת טווח, גם כאשר מתעוררים קשיים טכניים או אתגרים בלתי צפויים באתר.
                חבר הצוות מתחייב שלא לנטוש את התפקיד באמצע תקופה קריטית, ולפעול תמיד לטובת האתר והקהילה.
              </p>
              <p className="mt-6 text-xs text-gray-500">
                בלחיצה על "קראתי ואני מסכים" ולאחריה על אישור סופי, הנך מצהיר שקראת את המסמך במלואו, הבנת אותו,
                ומקבל על עצמך את תנאיו במלואם.
              </p>
            </div>

            <div className="border-t border-border px-6 py-4">
              {!readToEnd && (
                <p className="mb-2 text-xs text-gold">יש לגלול עד סוף המסמך כדי להמשיך.</p>
              )}
              <label className={`mb-3 flex items-center gap-2 text-sm ${readToEnd ? "text-gray-300" : "text-gray-600"}`}>
                <input
                  type="checkbox"
                  disabled={!readToEnd}
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                קראתי בכובד ראש את ההסכם ואני מסכים לכל תנאיו
              </label>
              <button
                disabled={!checked}
                onClick={() => setStep("final-confirm")}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
              >
                המשך לאישור סופי
              </button>
            </div>
          </>
        )}

        {step === "final-confirm" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-black text-white">אישור אחרון</p>
              <p className="mt-2 text-sm text-gray-400">
                האם אתה בטוח שברצונך לחתום ולקבל על עצמך את תפקיד חבר צוות הפיקוח, כולל כל ההתחייבויות שפורטו
                במסמך? לאחר האישור תועבר לממשק הפיקוח.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button onClick={() => setStep("read")} className="btn-ghost flex-1" disabled={submitting}>
                חזרה למסמך
              </button>
              <button onClick={submitSignature} className="btn-primary flex-1" disabled={submitting}>
                {submitting ? "שומר..." : "אני מאשר וחותם סופית"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
