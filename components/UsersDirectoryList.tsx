"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ShieldCheck, Package, Crown, User as UserIcon, Wifi, Coins, Loader2 } from "lucide-react";
import type { PublicUserSummary } from "@/lib/users-data";
import { useVisibleInterval } from "@/lib/useVisibleInterval";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const POLL_MS = 60 * 1000;
const PAGE_SIZE = 60;

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

// רשימת המשתמשים הציבורית. הדף נטען עם PAGE_SIZE המשתמשים הראשונים בלבד (לפי מוניטין); החיפוש
// והסינון "מחוברים כרגע" נעשים בשרת, והמשך הרשימה נטען בגלילה - במקום לשלוף ולשלוח אלפי
// משתמשים בכל כניסה לעמוד.
export default function UsersDirectoryList({ users: initialUsers, total: initialTotal }: { users: PublicUserSummary[]; total: number }) {
  const [users, setUsers] = useState<PublicUserSummary[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  // "ביקור אחרון" מתעדכן בצד הלקוח (heartbeat), ולכן רשימת המזהים ה"מחוברים כרגע" נשלפת בנפרד
  // (בקשה קלה ומשותפת בין כל הגולשים, ורק כשהלשונית מוצגת) והיא המקור לתג ולמונה.
  const [onlineIds, setOnlineIds] = useState<Set<string> | null>(null);

  const requestId = useRef(0);
  const firstRun = useRef(true);

  const fetchPage = useCallback(async (offset: number, q: string, online: boolean) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (online) params.set("online", "1");
      const res = await fetch(`/api/users/list?${params}`);
      const json = await res.json();
      if (id !== requestId.current || !Array.isArray(json.users)) return;
      setUsers((prev) => (offset === 0 ? json.users : [...prev, ...json.users]));
      setTotal(json.total ?? 0);
    } catch {
      // תקלת רשת זמנית - המשתמש יכול לגלול/לחפש שוב
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // שינוי חיפוש / סינון -> שליפה מחדש מההתחלה (עם השהיה קצרה בזמן הקלדה)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => fetchPage(0, query.trim(), onlyOnline), 300);
    return () => clearTimeout(t);
  }, [query, onlyOnline, fetchPage]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/users/online-status");
      const json = await res.json();
      if (Array.isArray(json.onlineIds)) setOnlineIds(new Set(json.onlineIds));
    } catch {
      // ממשיכים עם המידע הקיים (או עם ההערכה לפי חותמת הזמן)
    }
  }, []);
  useEffect(() => {
    poll();
  }, [poll]);
  useVisibleInterval(poll, POLL_MS);

  function isOnline(u: PublicUserSummary) {
    if (onlineIds) return onlineIds.has(u.id);
    return isOnlineByTimestamp(u.lastSeenAt);
  }

  const onlineCount = onlineIds ? onlineIds.size : users.filter((u) => isOnline(u)).length;

  const hasMore = users.length < total;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchPage(users.length, query.trim(), onlyOnline);
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, users.length, query, onlyOnline, fetchPage]);

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

      {users.length === 0 && !loading ? (
        <div className="card p-10 text-center text-gray-500">לא נמצאו משתמשים התואמים לחיפוש.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              prefetch={false}
              className="card flex items-center gap-4 p-4 transition hover:ring-1 hover:ring-primary/40"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
                {u.avatarUrl ? (
                  <Image src={u.avatarUrl} alt={u.username} fill sizes="48px" loading="lazy" className="object-cover" />
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold"><Coins className="h-3 w-3" /> {u.points.toLocaleString("he-IL")}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  הצטרפ/ה ב-{new Date(u.createdAt).toLocaleDateString("he-IL")} · {timeAgoLabel(u.lastSeenAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> טוען...
        </div>
      )}
      {hasMore && !loading && <div ref={sentinelRef} aria-hidden className="h-1 w-full" />}
    </div>
  );
}
