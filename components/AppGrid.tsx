"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Smartphone, Monitor, SlidersHorizontal, ArrowDownWideNarrow, ArrowDownAZ, HardDrive, Check, Bell, BellRing, Clock, Flame, X } from "lucide-react";
import AppCard from "./AppCard";
import AppModal from "./AppModal";
import type { AppRow, Category } from "@/types/database";
import { isApk } from "@/lib/appKind";

// ReviewQueue ועוד מייבאים את isApk מכאן
export { isApk };

// אפשרויות המיון (פיצ'ר 3) - "ברירת מחדל" שומרת על הסדר מהשרת (נעוצים קודם, ואז לפי חדשים).
type SortKey = "default" | "newest" | "downloads" | "name" | "size";
const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof ArrowDownAZ }[] = [
  { key: "default", label: "מומלצים (ברירת מחדל)", icon: Check },
  // "נוספו לאחרונה" - לפי תאריך ההוספה לחנות בלבד (בלי הנעוצים ובלי הקפצת עדכוני גרסה של ברירת המחדל)
  { key: "newest", label: "נוספו לאחרונה", icon: Clock },
  { key: "downloads", label: "הכי מורדים", icon: ArrowDownWideNarrow },
  { key: "name", label: "שם (א-ת)", icon: ArrowDownAZ },
  { key: "size", label: "גודל (גדול לקטן)", icon: HardDrive }
];

// כמה כרטיסים מציגים מההתחלה, ומוסיפים בכל פעם שמגיעים לסוף הרשימה בגלילה (פיצ'ר טעינה
// הדרגתית) - כדי שלא ייטענו כל מאות האפליקציות (ותמונות האייקון שלהן) בבת אחת, בזמן שרק
// שורה או שתיים מהן נראות בפועל על המסך. החיפוש/מיון/סינון ממשיכים לפעול על כל הרשימה
// המלאה כרגיל (items) - רק הרינדור בפועל של הכרטיסים מוגבל ומתרחב בהדרגה.
const PAGE_SIZE = 40;

export default function AppGrid({
  items: initialItems,
  totalCount,
  totals,
  categories,
  updateAppIds = [],
  viewerIsStaff = false,
  loggedIn = false
}: {
  // הכרטיסים הראשונים בלבד (נשלחים בדף עצמו - טעינה ראשונה קלה); השאר נטענים ברקע מיד אחרי שהעמוד מוצג
  items: { app: AppRow; iconUrl: string | null }[];
  // כמה אפליקציות יש בסך הכול (כולל אלה שעוד לא נטענו) וחלוקה לאפליקציות/תוכנות - למונים ולטעינת השאר
  totalCount?: number;
  totals?: { apps: number; software: number };
  categories: Category[];
  updateAppIds?: string[];
  viewerIsStaff?: boolean;
  loggedIn?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [mainTab, setMainTab] = useState<"apps" | "software">("apps");
  // סרגל המיון מוסתר כברירת מחדל (פיצ'ר 3, דגש עיצובי - מניעת עומס), נפתח באייקון קטן ליד החיפוש.
  const [sort, setSort] = useState<SortKey>("default");
  const [sortOpen, setSortOpen] = useState(false);
  // פיצ'ר 2a: האפליקציה שנבחרה לפתיחה בחלונית צפה (Modal).
  const [activeId, setActiveId] = useState<string | null>(null);

  // חיפוש בתוכן פוסט הפרסום: רשימת הכרטיסים כבר לא נושאת את הטקסט המלא של כל פוסט, ולכן ההתאמה
  // לפי תוכן הפוסט מתבצעת בשרת (עם השהיה קצרה בזמן הקלדה) ומתווספת להתאמה המקומית לפי שם/תיאור קצר.
  const [remote, setRemote] = useState<{ q: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (q.length < 2) { setRemote(null); return; }
    let active = true;
    const t = setTimeout(() => {
      fetch(`/api/apps/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (active && j && Array.isArray(j.ids)) setRemote({ q, ids: new Set<string>(j.ids) }); })
        .catch(() => {});
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  // מנויי התראות לקטגוריות של המשתמש המחובר.
  const [catSubs, setCatSubs] = useState<Set<string>>(new Set());
  const [catBusy, setCatBusy] = useState(false);
  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/notifications/subscriptions")
      .then((r) => r.json())
      .then((j) => setCatSubs(new Set((j.subscriptions ?? []).filter((s: any) => s.type === "category").map((s: any) => s.targetId))))
      .catch(() => {});
  }, [loggedIn]);

  async function toggleCatSub(value: string) {
    if (catBusy) return;
    setCatBusy(true);
    const on = !catSubs.has(value);
    setCatSubs((prev) => {
      const n = new Set(prev);
      on ? n.add(value) : n.delete(value);
      return n;
    });
    await fetch("/api/notifications/subscribe", {
      method: on ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", targetId: value })
    }).catch(() => {});
    setCatBusy(false);
  }

  // טעינת שאר האפליקציות ברקע (אחרי הציור הראשון), כדי שחיפוש/מיון/סינון יעבדו על הרשימה המלאה
  const total = totalCount ?? initialItems.length;
  const [extra, setExtra] = useState<{ app: AppRow; iconUrl: string | null }[]>([]);
  const items = useMemo(() => (extra.length ? [...initialItems, ...extra] : initialItems), [initialItems, extra]);
  const allLoaded = items.length >= total;
  useEffect(() => {
    if (initialItems.length >= total) return;
    let cancelled = false;
    function load(attempt = 0) {
      fetch(`/api/apps/rest?skip=${initialItems.length}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (cancelled) return;
          if (j && Array.isArray(j.items)) setExtra(j.items);
          else if (attempt < 2) setTimeout(() => load(attempt + 1), 3000);
        })
        .catch(() => {
          if (!cancelled && attempt < 2) setTimeout(() => load(attempt + 1), 3000);
        });
    }
    const w = window as any;
    const handle = w.requestIdleCallback ? w.requestIdleCallback(() => load(), { timeout: 2500 }) : setTimeout(() => load(), 800);
    return () => {
      cancelled = true;
      if (w.requestIdleCallback && w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, [initialItems.length, total]);

  // "החמים שלנו": האפליקציות והתוכנות הכי מורדות בשבוע האחרון (api/apps/hot)
  const [hotOpen, setHotOpen] = useState(false);
  const [hotData, setHotData] = useState<{ id: string; week: number }[] | null>(null);
  const [hotLoading, setHotLoading] = useState(false);
  const hotOrder = useMemo(() => (hotOpen && hotData ? new Map(hotData.map((h, i) => [h.id, i])) : null), [hotOpen, hotData]);
  const hotWeek = useMemo(() => new Map((hotData ?? []).map((h) => [h.id, h.week])), [hotData]);
  async function toggleHot() {
    if (hotOpen) {
      setHotOpen(false);
      return;
    }
    setHotOpen(true);
    if (!hotData) {
      setHotLoading(true);
      try {
        const res = await fetch("/api/apps/hot");
        const json = await res.json();
        if (Array.isArray(json.items)) setHotData(json.items);
      } catch {
        // תקלה זמנית - לוחצים שוב לניסיון נוסף
        setHotOpen(false);
      } finally {
        setHotLoading(false);
      }
    }
  }

  const updates = useMemo(() => new Set(updateAppIds), [updateAppIds]);

  const loadedAppsCount = useMemo(() => items.filter(({ app }) => isApk(app)).length, [items]);
  const appsCount = allLoaded || !totals ? loadedAppsCount : totals.apps;
  const softwareCount = allLoaded || !totals ? items.length - loadedAppsCount : totals.software;

  // אינדקס חיפוש: לא רק שם - גם התיאור הקצר וכל הטקסט בפוסט הפרסום (description_html מנוקה מתגיות).
  const searchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const { app } of items) {
      const plain = (app.description_html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&[a-z]+;/gi, " ");
      map.set(app.id, `${app.name} ${app.short_description || ""} ${plain}`.toLowerCase());
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = items.filter(({ app }) => {
      // במצב "החמים" מציגים את הרשימה החמה מכל הסוגים (אפליקציות ותוכנות יחד)
      const matchesTab = hotOrder ? hotOrder.has(app.id) : mainTab === "apps" ? isApk(app) : !isApk(app);
      const matchesQuery =
        !q ||
        (searchIndex.get(app.id) ?? app.name.toLowerCase()).includes(q) ||
        (remote?.q === q && remote.ids.has(app.id));
      const matchesCategory = category === "all" || app.category === category;
      return matchesTab && matchesQuery && matchesCategory;
    });

    if (hotOrder) return [...list].sort((a, b) => hotOrder.get(a.app.id)! - hotOrder.get(b.app.id)!);
    if (sort === "default") return list;
    const sorted = [...list];
    if (sort === "newest") sorted.sort((a, b) => new Date(b.app.created_at).getTime() - new Date(a.app.created_at).getTime());
    else if (sort === "downloads") sorted.sort((a, b) => (b.app.downloads_count ?? 0) - (a.app.downloads_count ?? 0));
    else if (sort === "name") sorted.sort((a, b) => a.app.name.localeCompare(b.app.name, "he"));
    else if (sort === "size") sorted.sort((a, b) => (b.app.file_size_bytes ?? 0) - (a.app.file_size_bytes ?? 0));
    return sorted;
  }, [items, query, category, mainTab, sort, searchIndex, remote, hotOrder]);

  const activeItem = activeId ? items.find(({ app }) => app.id === activeId) ?? null : null;
  const closeModal = useCallback(() => setActiveId(null), []);

  // טעינה הדרגתית: מתחילים תמיד מ-PAGE_SIZE הראשונים, ומתאפסים בכל שינוי חיפוש/סינון/מיון/טאב
  // כדי שלא "ייתקע" מספר גבוה מתוצאה קודמת כשעוברים לתוצאה חדשה וקצרה יותר.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, category, mainTab, sort, hotOpen]);

  const visibleItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // גלילה לתחתית הרשימה -> טוענים עוד PAGE_SIZE כרטיסים. rootMargin נותן מרווח קטן כדי
  // שהטעינה הבאה תתחיל רגע לפני שמגיעים ממש לסוף, ולא תיראה כקפיצה/השהיה למשתמש.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  return (
    <section id="apps" className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:mx-auto sm:w-fit sm:min-w-[420px]">
        <button
          onClick={() => setMainTab("apps")}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-6 py-4 text-center transition-all duration-300 ${
            mainTab === "apps"
              ? "border-primary bg-primary/15 shadow-glow"
              : "border-border bg-surface text-gray-400 hover:border-primary/40"
          }`}
        >
          <Smartphone className={`h-6 w-6 ${mainTab === "apps" ? "text-primary-light" : "text-gray-500"}`} />
          <span className={`text-base font-black ${mainTab === "apps" ? "text-white" : "text-gray-300"}`}>אפליקציות</span>
          <span className="text-xs text-gray-500">{appsCount.toLocaleString("he-IL")} אפליקציות (APK)</span>
        </button>
        <button
          onClick={() => setMainTab("software")}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-6 py-4 text-center transition-all duration-300 ${
            mainTab === "software"
              ? "border-accent bg-accent/15 shadow-glow"
              : "border-border bg-surface text-gray-400 hover:border-accent/40"
          }`}
        >
          <Monitor className={`h-6 w-6 ${mainTab === "software" ? "text-accent" : "text-gray-500"}`} />
          <span className={`text-base font-black ${mainTab === "software" ? "text-white" : "text-gray-300"}`}>תוכנות</span>
          <span className="text-xs text-gray-500">{softwareCount.toLocaleString("he-IL")} תוכנות מחשב</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <input
              dir="rtl"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mainTab === "apps" ? "חיפוש אפליקציה..." : "חיפוש תוכנה..."}
              className="input-field pl-10"
            />
          </div>
          {/* אייקון סינון/מיון קטן ועדין ליד החיפוש - פותח/סוגר את סרגל המיון (פיצ'ר 3). */}
          <button
            onClick={() => setSortOpen((o) => !o)}
            aria-label="מיון"
            title="מיון"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
              sortOpen || sort !== "default"
                ? "border-primary/60 bg-primary/10 text-primary-light"
                : "border-border bg-surface2 text-gray-400 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          {/* "החמים שלנו" - האפליקציות והתוכנות הכי מבוקשות עכשיו */}
          <button type="button" onClick={toggleHot} aria-pressed={hotOpen} className={`fire-btn ${hotOpen ? "fire-btn-on" : ""}`}>
            <Flame className="fire-flame h-4 w-4" />
            <span>החמים שלנו</span>
          </button>
        </div>

        {/* סרגל המיון - מוסתר כברירת מחדל, מופיע רק בלחיצה על האייקון. */}
        <AnimatePresence>
          {sortOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface2/60 p-2">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSort(opt.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      sort === opt.key ? "bg-primary text-[#fff]" : "bg-surface text-gray-400 hover:text-white"
                    }`}
                  >
                    <opt.icon className="h-3.5 w-3.5" /> {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap justify-end gap-2 sm:justify-start">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${category === "all" ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"}`}
          >
            הכל
          </button>
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${category === c.value ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loggedIn && category !== "all" && (
          <button
            onClick={() => toggleCatSub(category)}
            disabled={catBusy}
            className={`inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              catSubs.has(category)
                ? "border border-primary/50 bg-primary/15 text-primary-light"
                : "border border-border bg-surface2 text-gray-400 hover:text-white"
            }`}
          >
            {catSubs.has(category) ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {catSubs.has(category)
              ? `מקבל התראות על חדש ב"${categories.find((c) => c.value === category)?.label ?? ""}"`
              : `קבל התראה על אפליקציה חדשה ב"${categories.find((c) => c.value === category)?.label ?? ""}"`}
          </button>
        )}
      </div>

      {hotOpen && (
        <div className="fire-banner flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-bold text-orange-200">
            <Flame className="h-4 w-4 shrink-0 text-orange-400" />
            החמים שלנו - האפליקציות והתוכנות הכי מבוקשות ב-7 הימים האחרונים
            {hotLoading && <span className="text-xs font-normal text-orange-300/80">(טוען...)</span>}
          </span>
          <button type="button" onClick={() => setHotOpen(false)} aria-label="סגירה" className="rounded-full p-1 text-orange-200 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-gray-500">
          לא נמצאו {mainTab === "apps" ? "אפליקציות" : "תוכנות"} התואמות לחיפוש.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {visibleItems.map(({ app, iconUrl }, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <AppCard
                  app={app}
                  iconUrl={iconUrl}
                  categories={categories}
                  hasUpdate={updates.has(app.id)}
                  heat={hotOrder ? hotWeek.get(app.id) ?? 0 : undefined}
                  viewerIsStaff={viewerIsStaff}
                  onOpen={() => setActiveId(app.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {hasMore && <div ref={sentinelRef} aria-hidden className="h-1 w-full" />}

      {/* החלונית מנהלת בעצמה את אנימציות הפתיחה/סגירה ב-CSS (ראו AppModal) - בלי AnimatePresence */}
      {activeItem && (
        <AppModal
          key={activeItem.app.id}
          app={activeItem.app}
          iconUrl={activeItem.iconUrl}
          categories={categories}
          viewerIsStaff={viewerIsStaff}
          viewerLoggedIn={loggedIn}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
