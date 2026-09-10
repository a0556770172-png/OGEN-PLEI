"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(data.session ? "ok" : "invalid");
    });
    // גם אירוע PASSWORD_RECOVERY (אם ה-hash מטופל ע"י ה-SDK)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active && session) setReady("ok");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 6) {
      setError("הסיסמה צריכה להיות באורך 6 תווים לפחות.");
      return;
    }
    if (pw !== pw2) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      setError("לא הצלחנו לעדכן את הסיסמה. ייתכן שהקישור פג תוקף - בקש קישור חדש.");
      return;
    }
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => {
      router.push("/login?reset=1");
      router.refresh();
    }, 1800);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black">קביעת סיסמה חדשה</h1>
        </div>

        {ready === "checking" && (
          <div className="flex justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {ready === "invalid" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> הקישור לא תקין או שפג תוקפו.
            </div>
            <Link href="/forgot-password" className="btn-primary text-sm">
              בקשת קישור איפוס חדש
            </Link>
          </div>
        )}

        {ready === "ok" && !done && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">סיסמה חדשה</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                <input
                  dir="rtl"
                  type="password"
                  required
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="input-field pl-10"
                  placeholder="לפחות 6 תווים"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">אימות סיסמה</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                <input
                  dir="rtl"
                  type="password"
                  required
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="input-field pl-10"
                  placeholder="שוב את אותה סיסמה"
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "עדכון סיסמה"}
            </button>
          </form>
        )}

        {done && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> הסיסמה עודכנה! מעבירים אותך לכניסה…
          </div>
        )}
      </motion.div>
    </div>
  );
}
