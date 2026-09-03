"use client";
import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Package, User, Calendar, HardDrive, Smartphone, Wifi, WifiOff, HelpCircle, X, ExternalLink, Pin, Pencil } from "lucide-react";
import type { AppRow, Category } from "@/types/database";
import { formatFileSize } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import DownloadButton from "./DownloadButton";
import ReportAppButton from "./ReportAppButton";
import AppLikeButton from "./AppLikeButton";
import AppReviews from "./AppReviews";

// פיצ'ר 2a: עמוד האפליקציה נפתח בחלונית צפה מעל הדף הנוכחי (במקום ניווט מלא), כדי לשמור
// על רצף הגלישה ומקום הגלילה. הנתונים כבר קיימים בכרטיס (מהעמוד הראשי), ורכיבי הלקוח
// הקיימים (הורדה/לייק/ביקורות/דיווח) טוענים את שאר המידע בעצמם - בדיוק כמו בעמוד המלא.
const OFFLINE_SUPPORT_LABEL: Record<string, { label: string; icon: typeof Wifi }> = {
  offline: { label: "פועלת גם אופליין", icon: WifiOff },
  online: { label: "חייבת אינטרנט", icon: Wifi },
  unknown: { label: "תמיכה באופליין לא ידועה", icon: HelpCircle }
};

export default function AppModal({
  app,
  iconUrl,
  categories,
  viewerIsStaff = false,
  onClose
}: {
  app: AppRow;
  iconUrl?: string | null;
  categories?: Category[];
  viewerIsStaff?: boolean;
  onClose: () => void;
}) {
  const category = categories?.find((c) => c.value === app.category)?.label ?? app.category;
  const isPaused = app.download_paused || (app.download_paused_until ? new Date(app.download_paused_until).getTime() > Date.now() : false);

  // נעילת גלילת הרקע + סגירה ב-Escape כל עוד המודל פתוח.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const offline = app.offline_support && OFFLINE_SUPPORT_LABEL[app.offline_support];
  const OfflineIcon = offline ? offline.icon : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="card relative my-auto w-full max-w-3xl p-6 sm:p-8"
      >
        <button
          onClick={onClose}
          aria-label="סגירה"
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-gray-400 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="mx-auto flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-surface2 ring-1 ring-border sm:mx-0">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt={app.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-12 w-12 text-primary-light" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-right">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-black text-white">{app.name}</h1>
              <StatusBadge status={app.status} />
              {app.pinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold"><Pin className="h-3 w-3" /> נעוץ</span>
              )}
            </div>
            <p className="mb-4 text-gray-400">{app.short_description}</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 sm:justify-start">
              <Link href={`/users/${app.developer_id}`} className="inline-flex items-center gap-1 transition hover:text-primary-light hover:underline">
                <User className="h-3.5 w-3.5" /> הועלה ע"י {app.developer?.username ?? "מפתח"}
              </Link>
              <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {formatFileSize(app.file_size_bytes)}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> גרסה {app.version}</span>
              <span>{category}</span>
              {app.min_android_version && (
                <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> {app.min_android_version}</span>
              )}
              {offline && OfflineIcon && (
                <span className="inline-flex items-center gap-1"><OfflineIcon className="h-3.5 w-3.5" /> {offline.label}</span>
              )}
            </div>
            {app.developer_name && (
              <p className="mt-1.5 text-xs text-gray-500">מפתח/חברת הפיתוח המקורית: <span className="text-gray-300">{app.developer_name}</span></p>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <DownloadButton
                appId={app.id}
                status={app.status}
                downloadsCount={app.downloads_count}
                isPaused={isPaused}
                extra={
                  <>
                    <ReportAppButton appId={app.id} />
                    <AppLikeButton appId={app.id} />
                  </>
                }
              />
            </div>
            {viewerIsStaff && (
              <Link
                href={`/dashboard/developer/apps/${app.id}/edit`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold transition hover:bg-gold/20"
              >
                <Pencil className="h-3.5 w-3.5" /> עריכת פוסט הפרסום (צוות)
              </Link>
            )}
          </div>
        </div>

        {app.description_html && (
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="mb-3 text-lg font-bold text-white">תיאור מלא</h2>
            <div className="rich-content text-gray-300" dangerouslySetInnerHTML={{ __html: app.description_html }} />
          </div>
        )}

        <AppReviews appId={app.id} />

        <div className="mt-6 border-t border-border pt-4 text-center">
          <Link href={`/apps/${app.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-light transition hover:underline">
            <ExternalLink className="h-4 w-4" /> פתיחה בעמוד מלא
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
