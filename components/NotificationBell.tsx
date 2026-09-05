"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle, Siren, Package, Sparkles, Lightbulb, Users, ShieldAlert } from "lucide-react";

type Conversation = { type: "ticket" | "council"; id: string; title: string; unreadCount: number };
type FeedItem = { id: string; kind: string; title: string; body: string; url: string | null; seen_at: string | null; created_at: string };

// פעמון התראות בניווט לכל משתמש מחובר. שני מקורות:
//  1. מרכז ההתראות (feed) - מנויים: מפתח פרסם/עדכן, אפליקציה ציבורית חדשה, קטגוריה (ראו lib/notifications.ts)
//  2. הודעות שלא נקראו בשיחות (tickets / council) - כמו קודם
export default function NotificationBell({ dashboardBase }: { dashboardBase: string | null }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedUnread, setFeedUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [c, f] = await Promise.all([
          fetch("/api/notifications/unread").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/notifications/feed").then((r) => (r.ok ? r.json() : null))
        ]);
        if (!active) return;
        if (c) setConversations(c.conversations ?? []);
        if (f) {
          setFeed(f.items ?? []);
          setFeedUnread(f.unread ?? 0);
        }
      } catch {
        // כשל בטעינת ההתראות לא צריך לשבור שום דבר אחר בניווט
      }
    }
    load();
    const interval = setInterval(load, 25000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const convTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const total = convTotal + feedUnread;

  function hrefForConv(c: Conversation) {
    if (c.type === "council") return `${dashboardBase ?? "/dashboard/admin"}?tab=council`;
    if (dashboardBase) return `${dashboardBase}?tab=tickets`;
    return `/support?ticket=${c.id}`;
  }

  function openPanel() {
    const next = !open;
    setOpen(next);
    if (next && feedUnread > 0) {
      fetch("/api/notifications/feed", { method: "POST" }).catch(() => {});
      setFeedUnread(0);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openPanel}
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
        <div className="absolute end-0 top-full z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-2xl">
          {feed.length === 0 && conversations.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-500">אין התראות חדשות</p>
          ) : (
            <div className="flex flex-col gap-1">
              {conversations.map((c) => (
                <Link
                  key={`${c.type}-${c.id}`}
                  href={hrefForConv(c)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-surface2"
                >
                  {c.type === "council" ? (
                    <Siren className="h-4 w-4 shrink-0 text-gold" />
                  ) : (
                    <MessageCircle className="h-4 w-4 shrink-0 text-primary-light" />
                  )}
                  <span className="flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">{c.unreadCount}</span>
                </Link>
              ))}

              {feed.map((f) => (
                <Link
                  key={f.id}
                  href={f.url ?? "/"}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-surface2 ${
                    f.seen_at ? "text-gray-400" : "text-gray-200"
                  }`}
                >
                  {f.kind === "new_public" ? (
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  ) : f.kind === "forum_post" || f.kind === "forum_reply" ? (
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  ) : f.kind === "community_request" ? (
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  ) : f.kind === "bot_abuse" ? (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  ) : (
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" />
                  )}
                  <span className="flex-1">
                    <span className="block font-semibold leading-snug">{f.title}</span>
                    <span className="text-xs text-gray-500">{new Date(f.created_at).toLocaleDateString("he-IL")}</span>
                  </span>
                  {!f.seen_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
