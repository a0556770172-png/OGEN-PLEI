"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, Package, Crown, User as UserIcon, Wifi } from "lucide-react";
import type { PublicUserSummary } from "@/lib/users-data";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const POLL_MS = 20 * 1000;

function isOnlineByTimestamp(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

function timeAgoLabel(dateStr: string | null) {
  if (!dateStr) return "מעולם לא";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 5) return "מחובר עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString("he-IL");
}

// רשימת המשתמשים הציבורית - חיפוש לפי שם, סינון "מחוברים כרגע" (5 דקות אחרונות), וסדר
// אלפביתי קבוע (לא לפי תאריך הצטרפות כמו קודם).
export default function UsersDirectoryList({ users }: { users: PublicUserSummary[] }) {
  const [query, setQuery] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);
  // רשימת המשתמשים נטענת פעם אחת בצד השרת בזמן הניווט לעמוד, אבל "ביקור אחרון" מתעדכן
  // בצד הלקוח (heartbeat) - כך שהתמונה הראשונית לא בהכרח תואמת את מי שמחובר ממש עכשיו,
  // ולא הייתה מתעדכנת בלי רענון ידני של הדף. לכן שולפים בנוסף, בפולינג קליינטי, רשימת
  // מזהים "מחוברים כרגע" עדכנית מהשרת - וזו המקור האמיתי לתג/למונה, לא תמונת ה-SSR הישנה.
  const [onlineIds, setOnlineIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/users/online-status");
        const json = await res.json();
        if (active && Array.isArray(json.onlineIds)) setOnlineIds(new Set(json.onlineIds));
      } catch {
        // אם השליפה נכשלת - ממשיכים עם המידע הקיים (או עם ההערכה לפי חותמת הזמן)
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { active = false; clearInterval(interval); };
  }, []);

  function isOnline(u: PublicUserSummary) {
    if (onlineIds) return onlineIds.has(u.id);
    return isOnlineByTimestamp(u.lastSeenAt);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => (!q || u.username.toLowerCase().includes(q)) && (!onlyOnline || isOnline(u)))
      .sort((a, b) => a.username.localeCompare(b.username, "he"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, query, onlyOnline, onlineIds]);

  const onlineCount = useMemo(() => users.filter((u) => isOnline(u)).length, [users, onlineIds]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
          <input
            dir="rtl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש משתמש לפי שם..."
            className="input-field pl-10"
          />
        </div>
        <button
          onClick={() => setOnlyOnline((v) => !v)}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
            onlyOnline ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-surface text-gray-300 hover:border-primary/40"
          }`}
        >
          <Wifi className="h-4 w-4" /> מחוברים כרגע ({onlineCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">לא נמצאו משתמשים התואמים לחיפוש.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((u) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="card flex items-center gap-4 p-4 transition hover:ring-1 hover:ring-primary/40"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt={u.username} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-5 w-5 text-primary-light" />
                )}
                {isOnline(u) && (
                  <span className="absolute bottom-0 left-0 h-3 w-3 rounded-full border-2 border-surface bg-accent" title="מחובר כרגע" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-white">{u.username}</p>
                  {u.role === "admin" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">מנהל</span>
                  )}
                  {u.is_moderator && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary-light"><ShieldCheck className="h-3 w-3" /> פיקוח</span>
                  )}
                  {(u.role === "developer" || u.role === "admin") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent"><Package className="h-3 w-3" /> מפתח · {u.appsCount} אפליקציות/תוכנות</span>
                  )}
                  {u.is_pro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold"><Crown className="h-3 w-3" /> PRO</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  הצטרפ/ה ב-{new Date(u.createdAt).toLocaleDateString("he-IL")} · {timeAgoLabel(u.lastSeenAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
