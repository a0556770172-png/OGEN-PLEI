"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// חשוב: בלי זה, Next.js מנסה לרנדר את הדף הזה כ-HTML סטטי כבר בזמן ה-build עצמו
// (לפני שמשתני הסביבה של Vercel זמינים בפועל), מה שגורם לקריסת ה-build עם שגיאת
// "Supabase URL and API key are required". force-dynamic דוחה את הרינדור לזמן הבקשה בפועל.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const confirmed = params.get("confirmed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError("אימייל או סיסמה שגויים, או שהחשבון עדיין לא אומת במייל.");
      setLoading(false);
      return;
    }

    // בדיקת ההגדרה שהמנהל שולט בה (טאב "הגדרות" בפאנל הניהול): האם אימות מייל חובה
    // כדי להתחבר. זו אכיפה שלנו בקוד, בנפרד מהגדרת "Confirm email" של Supabase עצמו.
    if (!data.user.email_confirmed_at) {
      try {
        const settingsRes = await fetch("/api/settings");
        const settingsJson = await settingsRes.json();
        if (settingsJson.requireEmailVerification) {
          await supabase.auth.signOut();
          setError("יש לאמת את כתובת המייל שלך לפני ההתחברות. בדוק את תיבת הדואר שלך (גם בספאם).");
          setLoading(false);
          return;
        }
      } catch {
        // אם בדיקת ההגדרה נכשלה מסיבה כלשהי, לא חוסמים את המשתמש - עדיף חוויה שוטפת
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, banned, is_moderator")
      .eq("id", data.user.id)
      .single();

    if (profile?.banned) {
      await supabase.auth.signOut();
      setError("החשבון שלך נחסם. פנה למנהל האתר לפרטים.");
      setLoading(false);
      return;
    }

    const redirect = params.get("redirect");
    // פיקוח (is_moderator) מתווסף על גבי התפקיד הבסיסי - מי שהוא גם מפתח וגם פיקוח
    // מגיע כאן ראשית לפאנל הפיקוח, ויכול לעבור לאזור המפתח שלו דרך התפריט העליון.
    const dest =
      redirect ||
      (profile?.role === "admin" ? "/dashboard/admin"
      : profile?.is_moderator ? "/dashboard/moderator"
      : profile?.role === "developer" ? "/profile"
      : "/");

    router.push(dest);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="עוגן פליי" className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-black">כניסה לעוגן פליי</h1>
          <p className="text-sm text-gray-400">התחברות עובדת אותו דבר למשתמשים ולמפתחים</p>
        </div>

        {confirmed && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> המייל אומת בהצלחה! כעת ניתן להתחבר.
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">אימייל</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-10" placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">סיסמה</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pl-10" placeholder="••••••••" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full">
            {loading ? "מתחבר..." : "התחבר"}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-gray-400">
          <span>אין לך חשבון עדיין?</span>
          <div className="flex gap-4">
            <Link href="/signup/user" className="font-semibold text-primary-light hover:underline">הרשמה כמשתמש</Link>
            <Link href="/signup/developer" className="font-semibold text-accent hover:underline">הרשמה כמפתח</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
