"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Smartphone, Monitor, SlidersHorizontal, ArrowDownWideNarrow, ArrowDownAZ, HardDrive, Check } from "lucide-react";
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
  updateAppIds = []
}: {
  items: { app: AppRow; iconUrl: string | null }[];
  categories: Category[];
  updateAppIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [mainTab, setMainTab] = useState<"apps" | "software">("apps");
  // סרגל המיון מוסתר כברירת מחדל (פיצ'ר 3, דגש עיצובי - מניעת עומס), נפתח באייקון קטן ליד החיפוש.
  const [sort, setSort] = useState<SortKey>("default");
  const [sortOpen, setSortOpen] = useState(false);
  // פיצ'ר 2a: האפליקציה שנבחרה לפתיחה בחלונית צפה (Modal).
  const [activeId, setActiveId] = useState<string | null>(null);

  const updates = useMemo(() => new Set(updateAppIds), [updateAppIds]);

  const appsCount = useMemo(() => items.filter(({ app }) => isApk(app)).length, [items]);
  const softwareCount = items.length - appsCount;

  const filtered = useMemo(() => {
    const list = items.filter(({ app }) => {
      const matchesTab = mainTab === "apps" ? isApk(app) : !isApk(app);
      const matchesQuery = app.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "all" || app.category === category;
      return matchesTab && matchesQuery && matchesCategory;
    });

    if (sort === "default") return list;
    const sorted = [...list];
    if (sort === "downloads") sorted.sort((a, b) => (b.app.downloads_count ?? 0) - (a.app.downloads_count ?? 0));
    else if (sort === "name") sorted.sort((a, b) => a.app.name.localeCompare(b.app.name, "he"));
    else if (sort === "size") sorted.sort((a, b) => (b.app.file_size_bytes ?? 0) - (a.app.file_size_bytes ?? 0));
    return sorted;
  }, [items, query, category, mainTab, sort]);

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
            onClose={() => setActiveId(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
