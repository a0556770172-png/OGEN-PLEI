"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { UserRound, Mail, Lock, AtSign, AlertCircle, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UserSignupPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { username: form.username, role: "user" },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    setLoading(false);
    if (err) {
      setError(err.message.includes("already") ? "כתובת המייל כבר רשומה במערכת" : `שגיאה בהרשמה: ${err.message}`);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8 text-center">
          <MailCheck className="mx-auto mb-4 h-12 w-12 text-accent" />
          <h1 className="mb-2 text-xl font-bold">כמעט סיימנו!</h1>
          <p className="text-gray-400">
            שלחנו מייל אימות לכתובת <b className="text-white">{form.email}</b>. יש ללחוץ על הקישור במייל כדי להשלים את ההרשמה ולהתחבר.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
            <UserRound className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-black">הרשמה כמשתמש</h1>
          <p className="text-sm text-gray-400">כדי להוריד אפליקציות מהחנות</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">שם משתמש</label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" required minLength={3} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input-field pr-10" placeholder="השם שיוצג באתר" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">אימייל</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field pl-10" placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">סיסמה</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field pl-10" placeholder="לפחות 6 תווים" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full">
            {loading ? "נרשם..." : "הרשמה"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          יש לך כבר חשבון? <Link href="/login" className="font-semibold text-primary-light hover:underline">התחבר</Link>
          <br />
          רוצה לפרסם אפליקציות? <Link href="/signup/developer" className="font-semibold text-accent hover:underline">הרשמה כמפתח</Link>
        </div>
      </motion.div>
    </div>
  );
}
