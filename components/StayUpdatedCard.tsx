"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BellRing, MessagesSquare, Megaphone, LogIn } from "lucide-react";
import NotifyButton from "./NotifyButton";
import EmailNotifyToggle from "./EmailNotifyToggle";
import { FEATURED_THREADS } from "@/lib/forumThreads";

const ICONS = [MessagesSquare, Megaphone];

// כרטיס קבוע בראש הפורום: השרשור ממתמחים טופ עבר לכאן, עקבו אחרי שרשור הדיונים ושרשור
// העדכונים, ואפשר לקבל את ההתראות גם במייל (שימושי במיוחד אם האתר עצמו נופל).
// מגיעים לכאן מהסיור בדף הבית (components/ForumMoveTour.tsx) עם ?tour=1 - אז הכרטיס מודגש.
export default function StayUpdatedCard({ loggedIn }: { loggedIn: boolean }) {
  const params = useSearchParams();
  const fromTour = params.get("tour") === "1";
  const ref = useRef<HTMLElement>(null);
  const [glow, setGlow] = useState(fromTour);

  useEffect(() => {
    if (!fromTour) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setGlow(false), 6000);
    return () => clearTimeout(t);
  }, [fromTour]);

  return (
    <section
      ref={ref}
      className={`rounded-3xl border bg-gradient-to-br from-primary/10 via-surface to-surface p-5 transition-shadow duration-700 ${
        glow ? "border-gold shadow-[0_0_0_4px_rgba(234,179,8,0.35),0_0_40px_rgba(234,179,8,0.35)]" : "border-primary/30"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
          <BellRing className="h-4 w-4" />
        </div>
        <h2 className="text-base font-black">השרשור ממתמחים טופ עבר לכאן!</h2>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">
        {'לחצו "עקבו" על שרשור הדיונים ועל שרשור העדכונים כדי להישאר מעודכנים. אפשר גם לקבל את ההתראות למייל - כך תקבלו עדכונים גם במקרה שהאתר נופל.'}
      </p>

      <div className="flex flex-col gap-2">
        {FEATURED_THREADS.map((t, i) => {
          const Icon = ICONS[i] ?? MessagesSquare;
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface2 p-3">
              <Icon className="h-5 w-5 shrink-0 text-primary-light" />
              <Link href={`/forum/${t.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="text-sm font-bold text-white">{t.title}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </Link>
              {loggedIn && (
                <NotifyButton type="forum_thread" targetId={t.id} label="עקבו" activeLabel="עוקבים" size="sm" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/30 bg-accent/5 p-3">
        <p className="text-xs text-gray-400">התראות מהשרשורים שאתם עוקבים אחריהם - גם במייל</p>
        {loggedIn ? (
          <EmailNotifyToggle size="sm" />
        ) : (
          <Link
            href="/login?redirect=/forum"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface2 px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white"
          >
            <LogIn className="h-4 w-4" /> התחברו כדי לעקוב
          </Link>
        )}
      </div>
    </section>
  );
}
