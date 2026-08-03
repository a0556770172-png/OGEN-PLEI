"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, Package, User } from "lucide-react";
import type { AppRow, Category } from "@/types/database";
import { formatFileSize } from "@/lib/format";

export default function AppCard({
  app,
  iconUrl,
  categories
}: {
  app: AppRow;
  iconUrl?: string | null;
  categories?: Category[];
}) {
  const category = categories?.find((c) => c.value === app.category)?.label ?? app.category;
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="card group relative overflow-hidden p-5"
    >
      <div className="absolute inset-x-0 top-0 h-px shimmer-border opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <Link href={`/apps/${app.id}`} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {/* h-16 w-16 קבוע לכל כרטיס - הריבוע עצמו תמיד באותו גודל בדיוק בכל האפליקציות.
              אם עדיין נראה "לא ישר", זה בגלל תוכן האייקון עצמו (שוליים שקופים/לבנים בתוך
              קובץ האייקון של אפליקציה מסוימת) ולא בגלל גודל הריבוע - זה לא ניתן לתיקון
              מה-CSS בלי לעבד מחדש את קובץ האייקון עצמו. */}
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
                <User className="h-3.5 w-3.5" /> {app.developer.username}
              </>
            )}
          </span>
          <span>{formatFileSize(app.file_size_bytes)}</span>
        </div>
      </Link>
    </motion.div>
  );
}
