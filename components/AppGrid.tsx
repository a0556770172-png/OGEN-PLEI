"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import AppCard from "./AppCard";
import type { AppRow, Category } from "@/types/database";

export default function AppGrid({
  items,
  categories
}: {
  items: { app: AppRow; iconUrl: string | null }[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    return items.filter(({ app }) => {
      const matchesQuery = app.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "all" || app.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [items, query, category]);

  return (
    <section id="apps" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
          <input
            dir="rtl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש אפליקציה..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 sm:justify-start">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${category === "all" ? "bg-primary text-white" : "bg-surface2 text-gray-400 hover:text-white"}`}
          >
            הכל
          </button>
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${category === c.value ? "bg-primary text-white" : "bg-surface2 text-gray-400 hover:text-white"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-gray-500">
          לא נמצאו אפליקציות התואמות לחיפוש.
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
