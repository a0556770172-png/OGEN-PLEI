"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle, Siren } from "lucide-react";

type Conversation = { type: "ticket" | "council"; id: string; title: string; unreadCount: number };

// פעמון התראות כללי בניווט - לכל משתמש מחובר (לא רק צוות). קורא כל 20 שניות את אותו
// endpoint שכבר משמש בפנים את TicketsPanel/CouncilPanel (app/api/notifications/unread),
// ומציג תג אדום עם מספר ההודעות שלא נקראו. לחיצה על שיחה ספציפית מעבירה ישר אליה - בלי
// צורך לחפש אותה ידנית. זה בדיוק המנגנון שגורם למשתמש/מפתח לדעת מיד שהצוות שלח לו הודעה
// (ראו app/api/tickets/[id]/reply/route.ts ו-app/api/tickets/start/route.ts, ששולחים גם
// Web Push וגם מעלים את המספר הזה).
export default function NotificationBell({ dashboardBase }: { dashboardBase: string | null }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/notifications/unread");
        if (!res.ok) return;
        const json = await res.json();
        if (active) setConversations(json.conversations ?? []);
      } catch {
        // כשל בטעינת ההתראות לא צריך לשבור שום דבר אחר בניווט
      }
    }
    load();
    const interval = setInterval(load, 20000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  function hrefFor(c: Conversation) {
    if (c.type === "council") return `${dashboardBase ?? "/dashboard/admin"}?tab=council`;
    if (dashboardBase) return `${dashboardBase}?tab=tickets`;
    return `/support?ticket=${c.id}`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-400 transition hover:bg-surface2 hover:text-white"
        title="התראות"
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-2xl">
          {conversations.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-500">אין הודעות חדשות</p>
          ) : (
            <div className="flex flex-col gap-1">
              {conversations.map((c) => (
                <Link
                  key={`${c.type}-${c.id}`}
                  href={hrefFor(c)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-surface2"
                >
                  {c.type === "council" ? (
                    <Siren className="h-4 w-4 shrink-0 text-gold" />
                  ) : (
                    <MessageCircle className="h-4 w-4 shrink-0 text-primary-light" />
                  )}
                  <span className="flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">
                    {c.unreadCount}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
