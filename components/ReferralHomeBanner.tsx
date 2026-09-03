"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Sparkles, X, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { REFERRAL } from "@/lib/constants";

const DISMISS_KEY = "ogen-referral-banner-v1";

// באנר חמוד וניתן-לסגירה בדף הבית שמספר על מערכת ההפניות. אחרי שמשתמש סוגר אותו, הוא
// נשמר כ"נסגר" ב-localStorage ולא יוצג שוב באותו דפדפן. שינוי המספר ב-DISMISS_KEY (v1->v2)
// יגרום לו להופיע שוב לכולם - שימושי אם משנים משמעותית את התנאים.
export default function ReferralHomeBanner() {
  const [visible, setVisible] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "dismissed";
    } catch {
      // localStorage חסום - נציג בכל זאת
    }
    if (dismissed) return;
    setVisible(true);
    createClient()
      .auth.getUser()
      .then(({ data }) => setLoggedIn(!!data.user))
      .catch(() => {});
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "dismissed");
    } catch {
      // אין דרך לשמור - הבאנר פשוט יחזור בטעינה הבאה, לא נורא
    }
  }

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -12, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-l from-primary/20 via-surface to-accent/10 p-4 shadow-glow sm:p-5">
            {/* עיגולי זוהר ברקע */}
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-14 left-1/3 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />

            <button
              onClick={dismiss}
              aria-label="סגירה"
              className="absolute left-2.5 top-2.5 z-10 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-4 sm:text-right">
              <motion.div
                animate={{ y: [0, -5, 0], rotate: [0, -6, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow"
              >
                <Gift className="h-6 w-6" />
              </motion.div>

              <div className="flex-1">
                <p className="flex items-center justify-center gap-1.5 font-black text-white sm:justify-start">
                  <Sparkles className="h-4 w-4 text-gold" />
                  הזמינו חברים לעוגן פליי — וקבלו על זה
                </p>
                <p className="mt-0.5 text-sm text-gray-300">
                  {loggedIn ? (
                    <>
                      יש לכם קישור הזמנה אישי בעמוד הפרופיל. כל חבר שנרשם דרכו מזכה אתכם ב-
                      <b className="text-accent">{REFERRAL.referrerPoints} מוניטין</b> + קרדיט להעלאת קובץ גדול, והוא מקבל{" "}
                      <b className="text-primary-light">{REFERRAL.joinerPoints} מוניטין</b> מתנה.
                    </>
                  ) : (
                    <>
                      נרשמים, ומשתפים קישור אישי עם חברים — כל חבר שמצטרף דרככם מזכה אתכם ב-
                      <b className="text-accent">{REFERRAL.referrerPoints} מוניטין</b> + קרדיט העלאה, וגם אתם מקבלים{" "}
                      <b className="text-primary-light">{REFERRAL.joinerPoints} מוניטין</b> על ההצטרפות.
                    </>
                  )}
                </p>
              </div>

              <Link
                href={loggedIn ? "/profile" : "/signup/user"}
                className="btn-primary shrink-0 whitespace-nowrap text-sm"
              >
                {loggedIn ? "לקישור האישי שלי" : "הרשמה מהירה"}
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
