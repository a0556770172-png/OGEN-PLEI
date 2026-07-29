"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Anchor, LayoutDashboard, LogOut, Menu, X, ShieldCheck, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function Navbar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) { setProfile(null); setAvatarUrl(null); setLoading(false); }
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (active) { setProfile(data as Profile); setLoading(false); }
      // מעדכן "ביקור אחרון" בכל טעינת עמוד/ניווט - לא קריטי, נכשל בשקט אם יש בעיה
      fetch("/api/profile/heartbeat", { method: "POST" }).catch(() => {});
      if ((data as Profile)?.avatar_key) {
        fetch("/api/profile/avatar-url")
          .then((r) => r.json())
          .then((json) => { if (active) setAvatarUrl(json.url ?? null); })
          .catch(() => {});
      } else if (active) {
        setAvatarUrl(null);
      }
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  // "אזור מפתח" עבר לתוך עמוד הפרופיל (ראו /profile) ואינו קישור נפרד בתפריט יותר.
  // מי שהוא גם מפתח וגם פיקוח (is_moderator מתווסף על גבי role, לא מחליף אותו) מקבל
  // גם קישור ניהול/פיקוח ליד הפרופיל, כדי לא לאבד גישה לאף אחד מהם.
  const adminHref = profile?.role === "admin" ? "/dashboard/admin" : null;
  const moderatorHref = profile?.is_moderator && profile.role !== "admin" ? "/dashboard/moderator" : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 group justify-self-start">
          <motion.div
            whileHover={{ rotate: -12, scale: 1.08 }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-glow"
          >
            <Anchor className="h-5 w-5 text-white" />
          </motion.div>
          <span className="text-lg font-black tracking-tight">
            עוגן <span className="text-gradient">פליי</span>
          </span>
        </Link>

        <nav className="col-start-2 hidden items-center gap-6 justify-self-center md:flex">
          {!loading && !profile && (
            <>
              <Link href="/signup/user" className="btn-primary text-sm">הרשמה</Link>
              <Link href="/login" className="text-sm font-medium text-gray-300 transition hover:text-white">
                כניסה
              </Link>
            </>
          )}
          <Link href="/" className="text-sm font-medium text-gray-300 transition hover:text-white">
            החנות
          </Link>
          <Link href="/users" className="text-sm font-medium text-gray-300 transition hover:text-white">
            משתמשים
          </Link>
          <Link href="/about" className="text-sm font-medium text-gray-300 transition hover:text-white">
            אודות
          </Link>
          {!loading && profile && (
            <div className="flex items-center gap-3">
              <Link href="/profile" className="flex items-center gap-2 text-sm text-gray-400 transition hover:text-white">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={profile.username} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-primary-light" />
                  )}
                </div>
                <span>
                  שלום, <span className="font-bold text-white">{profile.username}</span>
                  {profile.role === "developer" && (
                    <span className="ms-1 text-xs text-primary-light">({profile.is_pro ? "PRO" : "רגיל"})</span>
                  )}
                </span>
              </Link>
              <Link href="/support" className="text-sm font-medium text-gray-300 transition hover:text-white">
                פניות תמיכה
              </Link>
              {adminHref && (
                <Link href={adminHref} className="btn-ghost text-sm">
                  <LayoutDashboard className="h-4 w-4" /> ניהול
                </Link>
              )}
              {moderatorHref && (
                <Link href={moderatorHref} className="btn-ghost text-sm">
                  <ShieldCheck className="h-4 w-4" /> פיקוח
                </Link>
              )}
              <button onClick={logout} className="btn-ghost text-sm">
                <LogOut className="h-4 w-4" />
                יציאה
              </button>
            </div>
          )}
        </nav>

        <button className="justify-self-end md:hidden" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-border/60 px-4 py-4 md:hidden"
        >
          <div className="flex flex-col gap-3">
            {!profile ? (
              <>
                <Link href="/signup/user" onClick={() => setOpen(false)}>הרשמה</Link>
                <Link href="/login" onClick={() => setOpen(false)}>כניסה</Link>
              </>
            ) : null}
            <Link href="/" onClick={() => setOpen(false)}>החנות</Link>
            <Link href="/users" onClick={() => setOpen(false)}>משתמשים</Link>
            <Link href="/about" onClick={() => setOpen(false)}>אודות</Link>
            {profile && (
              <>
                <Link href="/profile" onClick={() => setOpen(false)}>הפרופיל שלי</Link>
                <Link href="/support" onClick={() => setOpen(false)}>פניות תמיכה</Link>
                {adminHref && <Link href={adminHref} onClick={() => setOpen(false)}>ניהול</Link>}
                {moderatorHref && <Link href={moderatorHref} onClick={() => setOpen(false)}>פיקוח</Link>}
                <button onClick={logout} className="text-right text-red-400">יציאה</button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </header>
  );
}
