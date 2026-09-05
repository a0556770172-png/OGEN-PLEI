"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Smartphone, Monitor, SlidersHorizontal, ArrowDownWideNarrow, ArrowDownAZ, HardDrive, Check, Bell, BellRing } from "lucide-react";
import AppCard from "./AppCard";
import AppModal from "./AppModal";
import type { AppRow, Category } from "@/types/database";

// אפליקציות מובייל (APK/APKS) לעומת תוכנות מחשב (כל שאר סוגי הקבצים - EXE, MSI, ZIP וכו') -
// השיוך נקבע לפי סיומת הקובץ בפועל שהמפתח העלה, לא לפי הקטגוריה שנבחרה, כדי שהחלוקה
// תמיד תהיה מדויקת בלי תלות בבחירת קטגוריה שגויה. בודקים גם file_name וגם file_key (מפתח
// האחסון ב-R2) - כדי שקובץ יסווג נכון גם אם אחד מהשדות חסר/לא מעודכן מסיבה כלשהי.
// באג שתוקן: קבצי .apks (חבילת APK מפוצלת) לא זוהו כי הבדיקה חיפשה ".apk" בלבד -
// הם נפלו בטעות ל"תוכנות" והנפיחו את הספירה שם.
const APK_EXTENSIONS = [".apk", ".apks", ".xapk"];

function endsWithAny(value: string | null | undefined, suffixes: string[]) {
  const v = value?.toLowerCase().trim();
  if (!v) return false;
  return suffixes.some((s) => v.endsWith(s));
}

function isApk(app: AppRow) {
  return endsWithAny(app.file_name, APK_EXTENSIONS) || endsWithAny(app.file_key, APK_EXTENSIONS);
}

// אפשרויות המיון (פיצ'ר 3) - "ברירת מחדל" שומרת על הסדר מהשרת (נעוצים קודם, ואז לפי חדשים).
type SortKey = "default" | "downloads" | "name" | "size";
const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof ArrowDownAZ }[] = [
  { key: "default", label: "מומלצים (ברירת מחדל)", icon: Check },
  { key: "downloads", label: "הכי מורדים", icon: ArrowDownWideNarrow },
  { key: "name", label: "שם (א-ת)", icon: ArrowDownAZ },
  { key: "size", label: "גודל (גדול לקטן)", icon: HardDrive }
];

export default function AppGrid({
  items,
  categories,
  updateAppIds = [],
  viewerIsStaff = false,
  loggedIn = false
}: {
  items: { app: AppRow; iconUrl: string | null }[];
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

  const updates = useMemo(() => new Set(updateAppIds), [updateAppIds]);

  const appsCount = useMemo(() => items.filter(({ app }) => isApk(app)).length, [items]);
  const softwareCount = items.length - appsCount;

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
      const matchesTab = mainTab === "apps" ? isApk(app) : !isApk(app);
      const matchesQuery = !q || (searchIndex.get(app.id) ?? app.name.toLowerCase()).includes(q);
      const matchesCategory = category === "all" || app.category === category;
      return matchesTab && matchesQuery && matchesCategory;
    });

    if (sort === "default") return list;
    const sorted = [...list];
    if (sort === "downloads") sorted.sort((a, b) => (b.app.downloads_count ?? 0) - (a.app.downloads_count ?? 0));
    else if (sort === "name") sorted.sort((a, b) => a.app.name.localeCompare(b.app.name, "he"));
    else if (sort === "size") sorted.sort((a, b) => (b.app.file_size_bytes ?? 0) - (a.app.file_size_bytes ?? 0));
    return sorted;
  }, [items, query, category, mainTab, sort, searchIndex]);

  const activeItem = activeId ? items.find(({ app }) => app.id === activeId) ?? null : null;

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

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-gray-500">
          לא נמצאו {mainTab === "apps" ? "אפליקציות" : "תוכנות"} התואמות לחיפוש.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {filtered.map(({ app, iconUrl }, i) => (
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
                  onOpen={() => setActiveId(app.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {activeItem && (
          <AppModal
            app={activeItem.app}
            iconUrl={activeItem.iconUrl}
            categories={categories}
            viewerIsStaff={viewerIsStaff}
            viewerLoggedIn={loggedIn}
            onClose={() => setActiveId(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
