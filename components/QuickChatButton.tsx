"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// פיצ'ר 2b: כפתור צף לגישה מהירה ותמידית לצ'אט/הודעות, נגיש מכל עמוד. מוצג רק למשתמש
// מחובר, ומוסתר בעמודי ההודעות עצמם (שם הוא מיותר). מציג נקודת חיווי אם יש הודעות שלא נקראו.
export default function QuickChatButton() {
  const supabase = createClient();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setLoggedIn(!!user);
      if (user) {
        fetch("/api/notifications/unread")
          .then((r) => r.json())
          .then((json) => { if (active) setHasUnread((json?.totalUnread ?? 0) > 0); })
          .catch(() => {});
      }
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // לא מציגים בעמודי ההודעות עצמם (מיותר) או כשלא מחוברים.
  if (!loggedIn || pathname.startsWith("/messages")) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-6 left-6 z-40"
      >
        <Link
          href="/messages"
          aria-label="פתיחת הודעות"
          title="הודעות"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[#fff] shadow-glow transition-all duration-300 hover:bg-primary-light hover:shadow-[0_0_55px_rgb(var(--c-primary)/0.5)] active:scale-95"
        >
          <MessageCircle className="h-6 w-6" />
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-bg" />
            </span>
          )}
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
