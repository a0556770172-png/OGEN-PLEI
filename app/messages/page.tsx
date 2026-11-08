"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Ban, MessageSquareText, User as UserIcon } from "lucide-react";

interface ThreadRow {
  id: string;
  otherUsername: string;
  otherAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageDeleted: boolean;
  lastMessageFromMe: boolean;
  lastMessageAt: string;
  unreadCount: number;
}

// זמן קצר לרשימה: היום -> שעה; אתמול -> "אתמול"; השבוע -> יום; אחרת -> תאריך
function listTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diff === 0) return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "אתמול";
  if (diff < 7) return d.toLocaleDateString("he-IL", { weekday: "long" });
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
}

// תיבת הצ'אטים בין משתמשים - נגישה רק למי שכבר יש לו לפחות שיחה אחת (נפתחת מכפתור
// "פתיחת שיחה" בפרופיל ציבורי, שמופיע רק למי שעבר את סף 10 האפליקציות/הצעות).
export default function MessagesInboxPage() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dm/threads")
      .then((r) => r.json())
      .then((json) => setThreads(json.threads ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black">צ'אטים</h1>
        <p className="text-gray-400">שיחות בין משתמשים - מיועד לצורך טכני בנושא האפליקציות והתוכנות שהעליתם. פרטים בעמוד <Link href="/about" className="text-primary-light hover:underline">ההסברים</Link>.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card flex items-center gap-3 p-4">
              <span className="h-12 w-12 animate-pulse rounded-full bg-surface2" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-32 animate-pulse rounded bg-surface2" />
                <span className="block h-3 w-52 animate-pulse rounded bg-surface2" />
              </span>
            </div>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <MessageSquareText className="mx-auto mb-2 h-8 w-8" />
          עדיין אין לכם שיחות. אפשר לפתוח שיחה מתוך הפרופיל הציבורי של משתמש אחר.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {threads.map((t) => {
            const unread = t.unreadCount > 0;
            return (
              <Link
                key={t.id}
                href={`/messages/${t.id}`}
                className={`card flex items-center gap-3 p-3.5 transition hover:border-primary/40 hover:bg-surface2/40 ${unread ? "border-primary/40" : ""}`}
              >
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
                  {t.otherAvatarUrl ? (
                    <Image src={t.otherAvatarUrl} alt={t.otherUsername} fill sizes="48px" loading="lazy" className="object-cover" />
                  ) : (
                    <UserIcon className="h-6 w-6 text-primary-light" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-white ${unread ? "font-black" : "font-bold"}`}>{t.otherUsername}</p>
                    <span className={`shrink-0 text-[11px] ${unread ? "font-bold text-primary-light" : "text-gray-500"}`}>{listTime(t.lastMessageAt)}</span>
                  </div>
                  <p className={`flex items-center gap-1 truncate text-sm ${unread ? "font-semibold text-gray-200" : "text-gray-500"}`}>
                    {t.lastMessageDeleted ? (
                      <span className="inline-flex items-center gap-1 italic">
                        <Ban className="h-3.5 w-3.5" /> ההודעה נמחקה
                      </span>
                    ) : t.lastMessage === null ? (
                      "אין הודעות עדיין"
                    ) : (
                      <>
                        {t.lastMessageFromMe && <span className="shrink-0 text-gray-500">אתם:</span>}
                        <span className="truncate">{t.lastMessage}</span>
                      </>
                    )}
                  </p>
                </div>
                {unread && (
                  <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-[#fff]">
                    {t.unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
