"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Plus, MessageCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BotChat from "./BotChat";

// כפתור צף יחיד (פינה שמאלית-תחתונה) שמאחד את העוזר (AI) ואת ההודעות בין משתמשים.
// לחיצה פותחת חלונית: העוזר בפנים, וכפתור מעבר להודעות הרגילות + מעבר לעמוד המלא.
export default function BotWidget() {
  const supabase = createClient();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [live, setLive] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setLoggedIn(!!user);
      if (!user) {
        setLive(false);
        setHasUnread(false);
        return;
      }
      fetch("/api/bot/status").then((r) => r.json()).then((j) => active && setLive(!!j.live)).catch(() => {});
      fetch("/api/notifications/unread")
        .then((r) => r.json())
        .then((j) => active && setHasUnread((j?.totalUnread ?? 0) > 0))
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

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setOpen((o) => !o)}
        aria-label="עוזר עוגן פליי והודעות"
        title="עוזר עוגן פליי והודעות"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow transition-all duration-300 hover:shadow-[0_0_55px_rgb(var(--c-primary)/0.5)] active:scale-95"
      >
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
            className="fixed bottom-24 left-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col rounded-2xl border border-border bg-bg/95 p-4 shadow-2xl backdrop-blur-xl sm:left-6"
            dir="rtl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
                  <Bot className="h-4 w-4" />
                </div>
                <span className="text-sm font-black text-white">עוזר עוגן פליי</span>
              </div>
              <div className="flex items-center gap-1">
                {live && (
                  <button
                    onClick={() => setConversationId(null)}
                    title="שיחה חדשה"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-surface2 hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  title="הודעות בין משתמשים"
                  className="relative rounded-lg p-1.5 text-gray-400 transition hover:bg-surface2 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  {hasUnread && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-accent" />}
                </Link>
              </div>
            </div>

            {live ? (
              <>
                <BotChat variant="widget" conversationId={conversationId} onConversationChange={setConversationId} />
                <Link
                  href="/assistant"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary-light transition hover:underline"
                >
                  פתיחה בעמוד מלא <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface2 text-gray-500">
                  <Bot className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-400">העוזר החכם כבוי כרגע.</p>
                <Link href="/messages" onClick={() => setOpen(false)} className="btn-primary text-sm">
                  <MessageCircle className="h-4 w-4" /> מעבר להודעות
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
