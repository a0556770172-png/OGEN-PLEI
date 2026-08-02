"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Smartphone, Monitor } from "lucide-react";
import AppCard from "./AppCard";
import type { AppRow, Category } from "@/types/database";

// אפליקציות מובייל (קובץ APK) לעומת תוכנות מחשב (כל שאר סוגי הקבצים - EXE, MSI, ZIP וכו') -
// השיוך נקבע לפי סיומת הקובץ בפועל שהמפתח העלה, לא לפי הקטגוריה שנבחרה, כדי שהחלוקה
// תמיד תהיה מדויקת בלי תלות בבחירת קטגוריה שגויה.
function isApk(app: AppRow) {
  return app.file_name?.toLowerCase().endsWith(".apk");
}

export default function AppGrid({
  items,
  categories
}: {
  items: { app: AppRow; iconUrl: string | null }[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [mainTab, setMainTab] = useState<"apps" | "software">("apps");

  const appsCount = useMemo(() => items.filter(({ app }) => isApk(app)).length, [items]);
  const softwareCount = items.length - appsCount;

  const filtered = useMemo(() => {
    return items.filter(({ app }) => {
      const matchesTab = mainTab === "apps" ? isApk(app) : !isApk(app);
      const matchesQuery = app.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "all" || app.category === category;
      return matchesTab && matchesQuery && matchesCategory;
    });
  }, [items, query, category, mainTab]);

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
                <AppCard app={app} iconUrl={iconUrl} categories={categories} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
