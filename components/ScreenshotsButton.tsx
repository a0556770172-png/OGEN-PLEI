"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Images, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { screenshotUrl } from "@/lib/appPath";

type Item = { type: "video" | "image"; url: string };

// כפתור "איך זה נראה?" - פותח גלריית מדיה של האפליקציה: סרטון ההסבר (מתנגן אוטומטית) ואחריו
// צילומי המסך. משמש גם בחלונית הצפה (AppModal) וגם בעמוד האפליקציה המלא. לא מוצג כשאין מדיה.
export default function ScreenshotsButton({
  keys,
  videoKey,
  appName
}: {
  keys?: string[] | null;
  videoKey?: string | null;
  appName: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const items: Item[] = [
    ...(videoKey ? [{ type: "video" as const, url: screenshotUrl(videoKey) }] : []),
    ...(keys ?? []).map((k) => ({ type: "image" as const, url: screenshotUrl(k) }))
  ];
  const count = items.length;

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);

  useEffect(() => {
    if (!open) return;
    // capture + stopImmediatePropagation: Escape סוגר רק את הגלריה ולא גם את חלונית האפליקציה שמאחוריה
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
      } else if (e.key === "ArrowLeft") {
        next();
      } else if (e.key === "ArrowRight") {
        prev();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, close, next, prev]);

  const current = items[index];

  // ניגון אוטומטי של הסרטון בפתיחה: קודם עם קול (הפתיחה היא לחיצה של המשתמש, ולכן מותר),
  // ואם הדפדפן חוסם - מנגנים בלי קול (המשתמש יכול להפעיל קול מהפקדים).
  useEffect(() => {
    if (!open || current?.type !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [open, index, current?.type]);

  if (count === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setIndex(0); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-light transition hover:bg-primary/20"
      >
        <Images className="h-3.5 w-3.5" /> איך זה נראה?
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 p-4"
            dir="rtl"
            onClick={(e) => { e.stopPropagation(); close(); }}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`איך ${appName} נראית`}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); close(); }}
              className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="סגירה"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative flex w-full max-w-5xl flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {count > 1 && (
                <button
                  type="button"
                  onClick={prev}
                  className="absolute right-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25"
                  aria-label="הקודם"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
              {current.type === "video" ? (
                <video
                  key={current.url}
                  ref={videoRef}
                  src={current.url}
                  controls
                  playsInline
                  loop
                  preload="auto"
                  className="max-h-[75vh] max-w-full rounded-xl bg-black"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.url}
                  alt={`צילום מסך של ${appName}`}
                  className="max-h-[75vh] max-w-full rounded-xl object-contain"
                  onClick={count > 1 ? next : undefined}
                />
              )}
              {count > 1 && (
                <button
                  type="button"
                  onClick={next}
                  className="absolute left-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25"
                  aria-label="הבא"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
            </div>

            {count > 1 && (
              <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
                {items.map((it, i) => (
                  <button
                    key={it.url}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    {it.type === "video" ? (
                      <span className="flex h-full w-full items-center justify-center bg-surface2 text-primary-light"><Play className="h-5 w-5" /></span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">{index + 1} / {count}{current.type === "video" ? " · סרטון הסבר" : ""}</p>
          </div>,
          document.body
        )}
    </>
  );
}
