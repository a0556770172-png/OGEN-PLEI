"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, Package, User, Pin, ArrowUpCircle } from "lucide-react";
import type { AppRow, Category } from "@/types/database";
import { formatFileSize } from "@/lib/format";

// הכרטיס נפתח בחלונית צפה (Modal) במקום ניווט לעמוד נפרד, כדי לשמור על מקום הגלילה
// (פיצ'ר 2a). לחיצה על שם המעלה מובילה לעמוד המשתמש שלו (פיצ'ר 3b) - עם עצירת ההתפשטות
// כדי שלא ייפתח גם המודל. hasUpdate מציג סימון "עדכון זמין" (פיצ'ר 5).
export default function AppCard({
  app,
  iconUrl,
  categories,
  hasUpdate = false,
  onOpen
}: {
  app: AppRow;
  iconUrl?: string | null;
  categories?: Category[];
  hasUpdate?: boolean;
  onOpen?: () => void;
}) {
  const category = categories?.find((c) => c.value === app.category)?.label ?? app.category;

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`פתיחת ${app.name}`}
      className="card group relative cursor-pointer overflow-hidden p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="absolute inset-x-0 top-0 h-px shimmer-border opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* סימונים עדינים בפינה - נעוץ ע"י מנהל / עדכון גרסה זמין (לא מעמיסים על הכרטיס) */}
      {(app.pinned || hasUpdate) && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
          {hasUpdate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent ring-1 ring-accent/30">
              <ArrowUpCircle className="h-3 w-3" /> עדכון
            </span>
          )}
          {app.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold ring-1 ring-gold/30">
              <Pin className="h-3 w-3" /> נעוץ
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface2 ring-1 ring-border">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt={app.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-8 w-8 text-primary-light" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-white">{app.name}</h3>
            <p className="text-xs text-gray-500">{category} · גרסה {app.version}</p>
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-gray-400">{app.short_description}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" /> {app.downloads_count.toLocaleString("he-IL")} הורדות
            {app.developer?.username && (
              <>
                <span className="text-gray-700">·</span>
                <Link
                  href={`/users/${app.developer_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 transition hover:text-primary-light hover:underline"
                >
                  <User className="h-3.5 w-3.5" /> {app.developer.username}
                </Link>
              </>
            )}
          </span>
          <span>{formatFileSize(app.file_size_bytes)}</span>
        </div>
      </div>
    </motion.div>
  );
}
