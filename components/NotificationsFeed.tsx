"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2, Package, Sparkles, Lightbulb, Users, ShieldAlert } from "lucide-react";

type FeedItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  seen_at: string | null;
  created_at: string;
};

function iconFor(kind: string) {
  if (kind === "new_public") return <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />;
  if (kind === "forum_post" || kind === "forum_reply")
    return <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" />;
  if (kind === "community_request") return <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent" />;
  if (kind === "bot_abuse") return <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />;
  return <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" />;
}

export default function NotificationsFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications/feed")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        if (!active) return;
        setItems(j.items ?? []);
        setLoading(false);
        // סימון כנקרא לאחר צפייה
        if ((j.unread ?? 0) > 0) fetch("/api/notifications/feed", { method: "POST" }).catch(() => {});
      })
      .catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-10 text-center">
        <Bell className="h-8 w-8 text-gray-600" />
        <p className="text-sm text-gray-500">אין התראות עדיין.</p>
        <p className="text-xs text-gray-600">
          עקבו אחרי מפתחים, אפליקציות, דיונים בפורום ומשתמשים — וכל דבר חדש יופיע כאן.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((f) => {
        const inner = (
          <>
            {iconFor(f.kind)}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug text-white">{f.title}</span>
              {f.body && <span className="mt-0.5 block text-xs text-gray-400">{f.body}</span>}
              <span className="mt-1 block text-[11px] text-gray-600">
                {new Date(f.created_at).toLocaleString("he-IL", {
                  day: "numeric",
                  month: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </span>
            {!f.seen_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
          </>
        );
        return f.url ? (
          <Link key={f.id} href={f.url} className="card flex items-start gap-3 p-3.5 transition hover:border-primary/40">
            {inner}
          </Link>
        ) : (
          <div key={f.id} className="card flex items-start gap-3 p-3.5">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
