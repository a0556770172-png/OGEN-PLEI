"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SiteRulesContent from "./SiteRulesContent";
import type { Profile } from "@/types/database";

// שער חובה חד-פעמי שקופץ לכל חשבון (רשום מזמן או שנרשם עכשיו) שעדיין לא אישר את "חוקי
// האתר" (site_rules_accepted_at is null) - בכל עמוד באתר, מיד עם הכניסה או אם כבר מחובר.
// חוסם גישה לכל האתר עד לאישור. בניגוד ל-ModeratorAgreementGate (רלוונטי רק לצוות פיקוח),
// זה רלוונטי לכל משתמש רשום באתר, ולכן ה-z-index כאן גבוה יותר - כדי שיוצג ראשון אם שני
// השערים רלוונטיים בו-זמנית (למשל חבר צוות פיקוח חדש שגם לא אישר את חוקי האתר).
export default function SiteRulesGate() {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rulesHtml, setRulesHtml] = useState<string | null>(null);
  const [rulesVersion, setRulesVersion] = useState(1);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
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
      const { data: settings } = await supabase
        .from("site_settings")
        .select("site_rules_html, site_rules_version, site_rules_update_note")
        .eq("id", true)
        .single();
      if (active && settings) {
        setRulesHtml(settings.site_rules_html ?? null);
        setRulesVersion(settings.site_rules_version ?? 1);
        setUpdateNote(settings.site_rules_update_note ?? null);
      }
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

  async function submitAcceptance() {
    setSubmitting(true);
    const res = await fetch("/api/site-rules/accept", { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      setProfile((p) => (p ? { ...p, site_rules_accepted_at: new Date().toISOString(), site_rules_seen_version: rulesVersion } : p));
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בשמירת האישור, נסה שוב");
    }
  }

  // לא חוסמים משתמש חסום כאן - הוא ממילא מנותב ל-/banned ע"י middleware.ts, ואין טעם
  // להציג לו שער נוסף לפני שהוא בכלל מטופל. מציגים שוב גם למי שכבר אישר בעבר, אם הצוות
  // פרסם עדכון לחוקים מאז (site_rules_seen_version נמוך מהגרסה הנוכחית - ראו
  // components/SiteRulesEditorPanel.tsx).
  const shouldShow = !!profile && !profile.banned && (profile.site_rules_seen_version ?? 0) < rulesVersion;
  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">חוקי עוגן פליי</h2>
            <p className="text-xs text-gray-500">
              {(profile?.site_rules_seen_version ?? 0) > 0
                ? "חוקי האתר עודכנו - יש לקרוא ולאשר שוב לפני המשך השימוש באתר"
                : "חובה לקרוא ולאשר פעם אחת לפני המשך השימוש באתר"}
            </p>
          </div>
        </div>

        {step === "read" && (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-gray-300"
            >
              {(profile?.site_rules_seen_version ?? 0) > 0 && updateNote && (
                <div className="mb-5 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm text-gold">
                  <p className="mb-1 font-bold">עדכון מהצוות</p>
                  <p className="text-gray-300">{updateNote}</p>
                </div>
              )}
              <SiteRulesContent html={rulesHtml} />
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
                קראתי בכובד ראש את כל חוקי האתר ואני מסכים לכל תנאיהם
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
                האם אתה מאשר שקראת את כל חוקי האתר, הבנת אותם על כל השלכותיהם (כולל אפשרות חסימת חשבון במקרה של
                הפרה), ומקבל עליך לפעול לפיהם?
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button onClick={() => setStep("read")} className="btn-ghost flex-1" disabled={submitting}>
                חזרה למסמך
              </button>
              <button onClick={submitAcceptance} className="btn-primary flex-1" disabled={submitting}>
                {submitting ? "שומר..." : "אני מאשר"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
