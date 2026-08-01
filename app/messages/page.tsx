"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";

interface ThreadRow {
  id: string;
  otherUsername: string;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
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
        <div className="card p-6 text-center text-gray-500">טוען...</div>
      ) : threads.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <MessageSquareText className="mx-auto mb-2 h-8 w-8" />
          עדיין אין לכם שיחות. אפשר לפתוח שיחה מתוך הפרופיל הציבורי של משתמש אחר.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {threads.map((t) => (
            <Link key={t.id} href={`/messages/${t.id}`} className="card flex items-center justify-between gap-3 p-4 transition hover:border-primary/40">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">{t.otherUsername}</p>
                <p className="truncate text-sm text-gray-500">{t.lastMessage ?? "אין הודעות עדיין"}</p>
              </div>
              {t.unreadCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-[#fff]">
                  {t.unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
