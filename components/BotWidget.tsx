"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Plus, MessageCircle, ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BotChat from "./BotChat";

// כפתור צף יחיד (פינה שמאלית-תחתונה) שמאחד את העוזר (AI) ואת ההודעות בין משתמשים.
// לחיצה פותחת חלונית: העוזר בפנים, וכפתור מעבר להודעות הרגילות + מעבר לעמוד המלא.
export default function BotWidget() {
  const supabase = createClient();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [live, setLive] = useState(false);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ text: string; followUps: string[] } | null>(null);
  const [pendingSend, setPendingSend] = useState<string | null>(null);

  const hasUnread = unread > 0;

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setLoggedIn(!!user);
      if (!user) {
        setLive(false);
        setUnread(0);
        return;
      }
      fetch("/api/bot/status")
        .then((r) => r.json())
        .then((j) => {
          if (!active || !j.live) return;
          setLive(true);
          // הודעת פתיחה יזומה - קופצת כ-peek פעם ביום.
          const today = new Date().toISOString().slice(0, 10);
          let shownToday = false;
          try {
            shownToday = localStorage.getItem("ogen-bot-peek") === today;
          } catch {
            // ignore
          }
          if (!shownToday) {
            fetch("/api/bot/opener")
              .then((r) => r.json())
              .then((op) => {
                if (!active || !op.opener || !op.showAuto) return;
                setPeek({ text: op.opener, followUps: op.followUps ?? [] });
                try {
                  localStorage.setItem("ogen-bot-peek", today);
                } catch {
                  // ignore
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
      fetch("/api/notifications/unread")
        .then((r) => r.json())
        .then((j) => active && setUnread(j?.totalUnread ?? 0))
        .catch(() => {});
    }
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // בעמוד העוזר המלא הכפתור מיותר.
  if (!loggedIn || pathname.startsWith("/assistant")) return null;

  function openFromPeek(msg?: string) {
    setPeek(null);
    setConversationId(null);
    if (msg) setPendingSend(msg);
    setOpen(true);
  }

  return (
    <>
      <AnimatePresence>
        {peek && !open && live && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="fixed bottom-24 left-4 z-40 w-[calc(100vw-2rem)] max-w-[320px] overflow-hidden rounded-2xl border border-primary/40 bg-bg/95 shadow-2xl backdrop-blur-xl sm:left-6"
            dir="rtl"
          >
            <div className="h-1 w-full bg-gradient-to-l from-primary via-accent to-primary" />
            <div className="p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
                  <Bot className="h-4 w-4" />
                </div>
                <button onClick={() => openFromPeek()} className="flex-1 text-right text-sm leading-relaxed text-gray-200">
                  {peek.text}
                </button>
                <button
                  onClick={() => setPeek(null)}
                  aria-label="סגירה"
                  className="shrink-0 rounded-lg p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {peek.followUps.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 ps-10">
                  {peek.followUps.slice(0, 3).map((f) => (
                    <button
                      key={f}
                      onClick={() => openFromPeek(f)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary-light transition hover:bg-primary/20"
                    >
                      <Sparkles className="h-3 w-3" /> {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          setPeek(null);
          setOpen((o) => !o);
        }}
        aria-label="עוזר עוגן פליי והודעות"
        title="עוזר עוגן פליי והודעות"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary to-accent text-[#fff] shadow-glow transition-shadow duration-300 hover:shadow-[0_0_55px_rgb(var(--c-primary)/0.55)]"
      >
        {!open && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40" style={{ animationDuration: "3s" }} />}
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        {!open && hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-bg" />
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-24 left-4 z-40 flex w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-border bg-bg/95 shadow-2xl backdrop-blur-xl sm:left-6"
            dir="rtl"
          >
            <div className="h-1 w-full bg-gradient-to-l from-primary via-accent to-primary" />
            <div className="flex flex-col p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-sm font-black leading-none text-white">עוזר עוגן פליי</span>
                  {live && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-accent">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" /> מחובר
                    </span>
                  )}
                </div>
              </div>
              {live && (
                <button
                  onClick={() => setConversationId(null)}
                  title="שיחה חדשה"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-surface2 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* מעבר בולט להודעות בין משתמשים - כפתור מלא ברוחב עם חיווי הודעות שלא נקראו */}
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className={`mb-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                hasUnread
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-surface2 text-gray-300 hover:border-primary/40 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> הודעות בין משתמשים
              </span>
              {hasUnread ? (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-black text-[#0b0b10]">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : (
                <ArrowLeft className="h-4 w-4 opacity-50" />
              )}
            </Link>

            {live ? (
              <>
                <BotChat
                  variant="widget"
                  conversationId={conversationId}
                  onConversationChange={setConversationId}
                  onNavigate={() => setOpen(false)}
                  autoSend={pendingSend}
                />
                <Link
                  href="/assistant"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary-light transition hover:underline"
                >
                  פתיחה בעמוד מלא <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface2 text-gray-500">
                  <Bot className="h-5 w-5" />
                </div>
                <p className="text-sm text-gray-400">העוזר החכם כבוי כרגע.</p>
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
