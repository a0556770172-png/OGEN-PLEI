"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle2, AlertCircle, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEVELOPER_TERMS } from "@/lib/constants";
import { readRefCode } from "@/lib/referralClient";

// מונע רינדור סטטי בזמן ה-build (ראו הסבר מפורט ב-app/login/page.tsx)
export const dynamic = "force-dynamic";

export default function DeveloperTermsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState<any>(null);
  const [checked, setChecked] = useState<boolean[]>(DEVELOPER_TERMS.map(() => false));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("dev_signup_form");
    if (!raw) {
      router.replace("/signup/developer");
      return;
    }
    setForm(JSON.parse(raw));
  }, [router]);

  const allChecked = checked.every(Boolean);
  const [upgradedInPlace, setUpgradedInPlace] = useState(false);

  async function handleAccept() {
    if (!allChecked || !form) return;
    setError("");
    setLoading(true);

    // אם המשתמש כבר מחובר עם אותו מייל (למשל נרשם קודם כ"משתמש רגיל" ורוצה גם להיות מפתח) —
    // אסור לקרוא שוב ל-signUp עם אותו מייל. Supabase, מטעמי אבטחה, מחזיר במקרה כזה "הצלחה" מזויפת
    // בלי לשלוח מייל ובלי לשנות כלום בפועל - זה בדיוק הבאג שתואר. במקום זה משדרגים ישירות את הפרופיל הקיים.
    const { data: sessionData } = await supabase.auth.getUser();
    const existingUser = sessionData?.user;

    if (existingUser && existingUser.email?.toLowerCase() === form.email.toLowerCase()) {
      try {
        const res = await fetch("/api/auth/upgrade-to-developer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: form.fullName, phone: form.phone })
        });
        const json = await res.json().catch(() => null);
        setLoading(false);
        if (!res.ok) {
          setError(json?.error || "שדרוג החשבון נכשל, נסה שוב");
          return;
        }
        sessionStorage.removeItem("dev_signup_form");
        setUpgradedInPlace(true);
        setDone(true);
      } catch {
        setLoading(false);
        setError("שדרוג החשבון נכשל, נסה שוב");
      }
      return;
    }

    if (existingUser && existingUser.email?.toLowerCase() !== form.email.toLowerCase()) {
      setLoading(false);
      setError(`אתה מחובר כרגע עם ${existingUser.email}. יש להתנתק קודם, או להשתמש באותו מייל שהזנת (${form.email}).`);
      return;
    }

    // לא מחובר כרגע - אך ייתכן שכבר יש חשבון קיים עם המייל הזה (למשל נרשם בעבר כ"משתמש רגיל"
    // ואומת את המייל אז, ועכשיו מתנתק/פותח דפדפן חדש ומנסה להירשם גם כמפתח). קריאה ל-signUp
    // במקרה כזה "מצליחה" בשקט מבלי לשלוח שום מייל אמיתי (הגנת Supabase נגד חשיפת מיילים קיימים) -
    // בדיוק הבאג שדווח. לכן בודקים קודם אם המייל כבר קיים, ואם כן מנסים להתחבר עם הסיסמה שהוזנה.
    try {
      const existsRes = await fetch("/api/auth/email-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email })
      });
      const existsJson = await existsRes.json().catch(() => ({}));

      if (existsJson.exists) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password
        });

        if (signInErr || !signInData?.user) {
          setLoading(false);
          setError(
            "כתובת המייל הזו כבר רשומה במערכת מהרשמה קודמת (למשל כמשתמש רגיל), אך הסיסמה שהזנת לא תואמת לחשבון הקיים. יש להתחבר עם הסיסמה הנכונה של אותו חשבון, ולאחר מכן ניתן יהיה לשדרג אותו לחשבון מפתח."
          );
          return;
        }

        // ההתחברות הצליחה - זה אכן החשבון הקיים שלו, משדרגים אותו במקום להירשם מחדש
        const res = await fetch("/api/auth/upgrade-to-developer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: form.fullName, phone: form.phone })
        });
        const json = await res.json().catch(() => null);
        setLoading(false);
        if (!res.ok) {
          setError(json?.error || "שדרוג החשבון נכשל, נסה שוב");
          return;
        }
        sessionStorage.removeItem("dev_signup_form");
        setUpgradedInPlace(true);
        setDone(true);
        return;
      }
    } catch {
      // אם בדיקת קיום המייל נכשלה מסיבה טכנית, ממשיכים בזהירות לניסיון הרשמה רגיל למטה
    }

    const ref = readRefCode();
    const { data: signUpData, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username,
          role: "developer",
          full_name: form.fullName,
          phone: form.phone,
          accepted_terms: true,
          ...(ref ? { ref } : {})
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (err) {
      setLoading(false);
      setError(err.message.includes("already") ? "כתובת המייל כבר רשומה במערכת" : `שגיאה בהרשמה: ${err.message}`);
      return;
    }
    sessionStorage.removeItem("dev_signup_form");

    // אם Supabase כבר החזיר session מיידית, או שההגדרה שלנו לא דורשת אימות מייל ואפשר
    // להתחבר מיידית עם אותם פרטים - אין טעם להטעות ולומר "שלחנו לך מייל, לך תבדוק".
    if (signUpData.session) {
      setLoading(false);
      router.push("/profile");
      router.refresh();
      return;
    }
    try {
      const settingsRes = await fetch("/api/settings");
      const settingsJson = await settingsRes.json();
      if (!settingsJson.requireEmailVerification) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (!signInErr) {
          setLoading(false);
          router.push("/profile");
          router.refresh();
          return;
        }
      }
    } catch {
      // אם בדיקת ההגדרה נכשלה מסיבה טכנית, ממשיכים בזהירות למסך "בדוק את המייל" למטה
    }

    setLoading(false);
    setDone(true);
  }

  if (done && upgradedInPlace) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-accent" />
          <h1 className="mb-2 text-xl font-bold">החשבון שלך שודרג למפתח!</h1>
          <p className="mb-6 text-gray-400">אין צורך באימות מייל נוסף — כבר היית מאומת. אפשר להתחיל מיד להעלות אפליקציות.</p>
          <a href="/profile" className="btn-primary inline-flex w-full justify-center">
            למעבר לפרופיל שלי
          </a>
        </motion.div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8 text-center">
          <MailCheck className="mx-auto mb-4 h-12 w-12 text-accent" />
          <h1 className="mb-2 text-xl font-bold">בקשתך התקבלה!</h1>
          <p className="text-gray-400">שלחנו מייל אימות לכתובת <b className="text-white">{form?.email}</b>. לאחר האימות תוכל להתחבר ולהתחיל להעלות אפליקציות.</p>
        </motion.div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-gold shadow-glow">
            <ShieldAlert className="h-6 w-6 text-[#fff]" />
          </div>
          <h1 className="text-2xl font-black">תנאי שימוש לחשבון מפתח</h1>
          <p className="text-sm text-gray-400">יש לקרוא ולאשר את כל הסעיפים לפני השלמת ההרשמה</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {DEVELOPER_TERMS.map((term, i) => (
            <label
              key={i}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface2 p-4 transition hover:border-primary/40"
            >
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => {
                  const next = [...checked];
                  next[i] = e.target.checked;
                  setChecked(next);
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-sm leading-relaxed text-gray-300">
                <b className="text-white">{i + 1}.</b> {term}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={handleAccept}
          disabled={!allChecked || loading}
          className="btn-primary mt-6 w-full"
        >
          <CheckCircle2 className="h-4 w-4" />
          {loading ? "יוצר חשבון..." : "אני מאשר את כל התנאים ומשלים הרשמה"}
        </button>
      </motion.div>
    </div>
  );
}
