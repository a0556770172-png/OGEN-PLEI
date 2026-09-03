"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Plus, Maximize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BotChat from "./BotChat";

// כפתור צף לצ'אט-בוט - בפינה הימנית-תחתונה (כפתור הצ'אט בין משתמשים נמצא בשמאלית).
// מוצג רק למשתמש מחובר וכשהבוט מופעל בניהול. השיחה נשמרת ל-DB דרך ה-API.
export default function BotWidget() {
  const supabase = createClient();
  const pathname = usePathname();
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setLive(false);
        return;
      }
      try {
        const res = await fetch("/api/bot/status");
        const json = await res.json();
        if (active) setLive(!!json.live);
      } catch {
        if (active) setLive(false);
      }
    }
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // לא מציגים בעמוד היעודי של העוזר (מיותר שם).
  if (!live || pathname.startsWith("/assistant")) return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setOpen((o) => !o)}
        aria-label="עוזר עוגן פליי"
        title="עוזר עוגן פליי"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow transition-all duration-300 hover:shadow-[0_0_55px_rgb(var(--c-primary)/0.5)] active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-24 right-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col rounded-2xl border border-border bg-bg/95 p-4 shadow-2xl backdrop-blur-xl sm:right-6"
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
                <button
                  onClick={() => setConversationId(null)}
                  title="שיחה חדשה"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-surface2 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <Link
                  href="/assistant"
                  title="פתיחה בעמוד מלא"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-surface2 hover:text-white"
                >
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <BotChat variant="widget" conversationId={conversationId} onConversationChange={setConversationId} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
