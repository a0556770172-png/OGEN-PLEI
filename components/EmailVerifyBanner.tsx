"use client";
import { useEffect, useState } from "react";
import { MailWarning, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// באנר עדין שמופיע בכל האתר למשתמש מחובר שהמייל שלו עדיין לא אומת.
// השליחה יזומה ע"י המשתמש עצמו (לחיצה על כפתור) ולא אוטומטית בכל טעינה —
// כדי לא להעמיס על מכסת שליחת המיילים המוגבלת של Supabase (ראו גם: השבתת
// "Confirm email" חובה בהגדרות Supabase, כדי שהרשמה/כניסה לא ייחסמו בגלל זה).
export default function EmailVerifyBanner() {
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");

  useEffect(() => {
    let active = true;
    async function check() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!active) return;
      if (user && !user.email_confirmed_at) {
        setEmail(user.email ?? null);
      } else {
        setEmail(null);
      }
    }
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!email || dismissed) return null;

  async function resend() {
    if (!email) return;
    setSending(true);
    setSentMsg("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setSending(false);
    setSentMsg(
      error
        ? error.message.includes("rate limit")
          ? "כבר נשלח מייל לאחרונה — נסה שוב בעוד כמה דקות."
          : "השליחה נכשלה, נסה שוב."
        : "מייל אימות נשלח! בדוק את תיבת הדואר שלך (גם בספאם)."
    );
  }

  return (
    <div
      dir="rtl"
      className="relative z-20 mb-4 flex flex-col gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2">
        <MailWarning className="h-4 w-4 shrink-0" />
        <span>
          המייל שלך (<b>{email}</b>) עדיין לא מאומת. אפשר להמשיך להשתמש באתר כרגיל, אך מומלץ לאמת כדי לא לאבד גישה לחשבון בעתיד.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {sentMsg && <span className="text-xs text-gray-300">{sentMsg}</span>}
        <button
          onClick={resend}
          disabled={sending}
          className="whitespace-nowrap rounded-lg border border-gold/50 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
        >
          {sending ? "שולח..." : "לחץ כאן לאימות"}
        </button>
        <button onClick={() => setDismissed(true)} className="text-gray-400 transition hover:text-white" aria-label="סגור">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
