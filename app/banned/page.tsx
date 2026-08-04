"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldAlert, Send, Loader2, AlertCircle, CheckCircle2, Clock, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

// עמוד ייעודי למשתמש חסום - מגיע לכאן אוטומטית מ-middleware.ts (וגם מיד אחרי התחברות, אם
// הוא חסום - ראו app/login/page.tsx). מציג את סיבת/משך החסימה, ומאפשר לכתוב ערעור (ואפילו
// להמשיך ולהוסיף הודעות נוספות) - זו הפעולה היחידה שמותרת למשתמש חסום באתר, דרך
// app/api/appeal/route.ts שבכוונה לא חוסם משתמשים חסומים כמו כל שאר ה-API באתר.
export default function BannedPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [appeal, setAppeal] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/appeal");
      const json = await res.json();
      if (res.ok) {
        setProfile(json.profile);
        setAppeal(json.appeal);
      }
    } catch {
      // אם הטעינה נכשלה, פשוט משאירים את המסך הבסיסי בלי הפרטים - לא קריטי
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("יש לכתוב הודעה (לפחות 5 תווים)");
      return;
    }
    setSending(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בשליחת הערעור");
      setMessage("");
      setSuccess(true);
      await load();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
        <p className="text-gray-400">יש להתחבר כדי לצפות בעמוד זה.</p>
        <Link href="/login" className="btn-primary">מעבר להתחברות</Link>
      </div>
    );
  }

  if (!profile.banned) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
        <CheckCircle2 className="h-8 w-8 text-accent" />
        <p className="text-gray-300">החשבון שלך אינו חסום.</p>
        <Link href="/" className="btn-primary">חזרה לדף הבית</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-white">החשבון שלך חסום</h1>
        {profile.ban_reason && <p className="mt-3 text-gray-300">סיבת החסימה: {profile.ban_reason}</p>}
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          {profile.ban_expires_at ? `החסימה בתוקף עד ${new Date(profile.ban_expires_at).toLocaleString("he-IL")}` : "החסימה היא לצמיתות"}
        </p>
        <button onClick={logout} className="mx-auto mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white">
          <LogOut className="h-3.5 w-3.5" /> התנתקות
        </button>
      </motion.div>

      {appeal?.admin_reply && (
        <div className="card p-6">
          <p className="mb-1 text-xs font-bold text-primary-light">תגובת הצוות</p>
          <p className="text-sm text-gray-300">{appeal.admin_reply}</p>
        </div>
      )}

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submitAppeal}
        className="card flex flex-col gap-4 p-6"
      >
        <div>
          <h2 className="font-bold text-white">{appeal ? "המשך הערעור" : "כתיבת ערעור"}</h2>
          <p className="text-xs text-gray-500">
            אפשר לכתוב כאן הסבר/בקשה לביטול החסימה. הצוות יבדוק ויגיב. אפשר להמשיך ולהוסיף הודעות בכל שלב, גם אם כבר קיבלת תגובה.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> ההודעה נשלחה לצוות.
          </div>
        )}

        {appeal?.message && (
          <div className="rounded-xl border border-white/10 bg-surface2 p-3 text-xs text-gray-400">
            <span className="font-bold text-gray-300">ההודעה האחרונה ששלחת: </span>
            {appeal.message}
          </div>
        )}

        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input-field resize-none"
          placeholder="נא לכתוב כאן את הערעור/ההסבר שלך..."
        />

        <button type="submit" disabled={sending} className="btn-primary w-full sm:w-auto">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          שליחה
        </button>
      </motion.form>
    </div>
  );
}
