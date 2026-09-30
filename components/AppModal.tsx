"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Package, User, Calendar, HardDrive, Smartphone, Wifi, WifiOff, HelpCircle, X, ExternalLink, Pin, Pencil } from "lucide-react";
import type { AppRow, Category } from "@/types/database";
import { formatFileSize } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import DownloadButton from "./DownloadButton";
import ReportAppButton from "./ReportAppButton";
import AppLikeButton from "./AppLikeButton";
import AppReviews from "./AppReviews";
import NotifyButton from "./NotifyButton";

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
  viewerLoggedIn = false,
  onClose
}: {
  app: AppRow;
  iconUrl?: string | null;
  categories?: Category[];
  viewerIsStaff?: boolean;
  viewerLoggedIn?: boolean;
  onClose: () => void;
}) {
  const category = categories?.find((c) => c.value === app.category)?.label ?? app.category;
  const isPaused = app.download_paused || (app.download_paused_until ? new Date(app.download_paused_until).getTime() > Date.now() : false);

  // סגירה עם אנימציית CSS: מסמנים "נסגר" (data-closing), וכשאנימציית היציאה של השכבה נגמרת -
  // קוראים ל-onClose. גיבוי בזמן למקרה שהאנימציה לא רצה.
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(0);
  const downOnBackdropRef = useRef(false);

  const finishClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current();
  }, []);

  const requestClose = useCallback(() => {
    if (closedRef.current) return;
    // משתמשים שביקשו להפחית אנימציות - סגירה מיידית (בלי להמתין לגיבוי בזמן)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }
    // סגירה באמצע אנימציית הפתיחה: היציאה מתחילה מהערכים הנוכחיים (ולא מ"גלוי לגמרי"),
    // אחרת השכבה הכהה קפצה לרגע לחושך מלא ורק אז דעכה - בדיוק ההבהוב שתיקנו.
    const o = overlayRef.current;
    const p = panelRef.current;
    if (o && p) {
      o.style.setProperty("--from-o", getComputedStyle(o).opacity);
      p.style.setProperty("--from-o", getComputedStyle(p).opacity);
      const t = getComputedStyle(p).transform;
      p.style.setProperty("--from-t", t && t !== "none" ? t : "none");
    }
    setClosing(true);
  }, [finishClose]);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(finishClose, 400);
    return () => clearTimeout(t);
  }, [closing, finishClose]);

  // נעילת גלילת הרקע + Escape + פוקוס - פעם אחת בפתיחה ופעם אחת בסגירה (לא בכל רינדור של
  // החנות), ולפני הציור (useLayoutEffect) כדי שהנעילה והפתיחה של החלונית יקרו באותו פריים.
  useLayoutEffect(() => {
    openedAtRef.current = performance.now();
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // צובע את שולי פס הגלילה בצבע הרקע הכהה, כדי שלא יישאר פס בהיר לא מוחשך בקצה המסך
    document.documentElement.classList.add("modal-open");
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.classList.remove("modal-open");
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [requestClose]);

  // לחיצה על הרקע סוגרת רק אם גם הלחיצה התחילה על הרקע (לא גרירת בחירת טקסט מתוך החלונית),
  // לא בלחיצה השנייה של לחיצה כפולה, ולא ב-300ms הראשונים (לחיצה כפולה על כרטיס פתחה וסגרה מיד).
  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !downOnBackdropRef.current) return;
    if (e.detail > 1 || performance.now() - openedAtRef.current < 300) return;
    requestClose();
  }

  const offline = app.offline_support && OFFLINE_SUPPORT_LABEL[app.offline_support];
  const OfflineIcon = offline ? offline.icon : null;

  // החלונית מוצגת ישירות תחת <body> (portal) ולא בתוך <main> - אחרת היא יורשת את שכבת ה-z
  // הנמוכה של main (10), והכותרת הדביקה של האתר (40) מוסתרת מעליה וחותכת את ראש החלונית.
  // בלי my-auto (מירכוז אנכי): התוכן שנטען אחר כך (לייקים, ביקורות) הגדיל את החלונית והמירכוז
  // "הקפיץ" אותה למעלה בערך שנייה אחרי הפתיחה. עכשיו היא מעוגנת תמיד מלמעלה.
  // האנימציות ב-CSS (modal-overlay/modal-panel ב-app/globals.css) ולא ב-framer-motion - ראו שם למה.
  // בלי backdrop-blur: טשטוש של כל המסך מעל רקע שזז כל הזמן היה כבד וגרם להבהובים; רקע כהה מספיק.
  // scrollbar-gutter:stable - לפס הגלילה של החלונית עצמה שמור מקום, כך שהיא לא זזה הצידה כשהוא מופיע.
  return createPortal(
    <div
      ref={overlayRef}
      onPointerDown={(e) => {
        downOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={onBackdropClick}
      onAnimationEnd={(e) => {
        // רק סוף אנימציית היציאה של השכבה עצמה (לא אנימציית הפתיחה, ולא אנימציות של רכיבים בפנים)
        if (e.target === e.currentTarget && e.animationName === "modal-overlay-out") finishClose();
      }}
      data-closing={closing ? "true" : undefined}
      className="modal-overlay fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/75 p-4 [scrollbar-gutter:stable] sm:p-8"
      dir="rtl"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={app.name}
        tabIndex={-1}
        className="modal-panel card relative w-full max-w-3xl p-6 outline-none sm:p-8"
      >
        <button
          onClick={requestClose}
          aria-label="סגירה"
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-gray-400 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative mx-auto flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-surface2 ring-1 ring-border sm:mx-0">
            {iconUrl ? (
              <Image src={iconUrl} alt={app.name} fill sizes="96px" className="object-cover" />
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
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {viewerLoggedIn && app.status === "approved" && app.source !== "public_suggestion" && (
                <NotifyButton
                  type="app"
                  targetId={app.id}
                  label="קבל התראה על גרסה חדשה"
                  size="sm"
                />
              )}
              {viewerIsStaff && (
                <Link
                  href={`/dashboard/developer/apps/${app.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold transition hover:bg-gold/20"
                >
                  <Pencil className="h-3.5 w-3.5" /> עריכת פוסט הפרסום (צוות)
                </Link>
              )}
            </div>
          </div>
        </div>

        {app.description_html && (
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="mb-3 text-lg font-bold text-white">תיאור מלא</h2>
            <div className="rich-content text-gray-300" dangerouslySetInnerHTML={{ __html: app.description_html }} />
          </div>
        )}

        <AppReviews appId={app.id} viewerIsStaff={viewerIsStaff} />

        <div className="mt-6 border-t border-border pt-4 text-center">
          <Link href={`/apps/${app.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-light transition hover:underline">
            <ExternalLink className="h-4 w-4" /> פתיחה בעמוד מלא
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
