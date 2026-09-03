"use client";
import { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";

// פיצ'ר 2c: התאמה אישית של צבע הנושא (accent) של האתר. הבחירה נשמרת ב-localStorage ומוחלת
// מיד על ה-html (data-accent), כך שכל הצבעים הראשיים באתר משתנים בהתאם (ראו app/globals.css).
// ברירת המחדל (purple) זהה למראה המקורי של האתר.
const ACCENTS: { key: string; label: string; swatch: string }[] = [
  { key: "purple", label: "סגול (ברירת מחדל)", swatch: "124 92 255" },
  { key: "blue", label: "כחול", swatch: "56 132 255" },
  { key: "teal", label: "טורקיז", swatch: "20 184 166" },
  { key: "emerald", label: "ירוק", swatch: "16 185 129" },
  { key: "rose", label: "ורוד", swatch: "244 63 94" },
  { key: "amber", label: "כתום", swatch: "245 158 11" }
];

export default function AppearanceMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("purple");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-accent") || "purple";
    setCurrent(saved);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(key: string) {
    setCurrent(key);
    if (key === "purple") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", key);
    try {
      localStorage.setItem("ogen-accent", key);
    } catch {
      // localStorage חסום (מצב פרטי) - הבחירה פשוט לא תישמר בין ביקורים, לא קריטי.
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="התאמת צבע האתר"
        title="התאמת צבע האתר"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-gray-300 transition hover:border-primary/50 hover:text-white"
      >
        <Palette className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-44 rounded-2xl border border-border bg-surface p-2 shadow-card">
          <p className="px-2 pb-1.5 pt-1 text-xs font-bold text-gray-500">צבע האתר</p>
          <div className="grid grid-cols-3 gap-1.5">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                onClick={() => pick(a.key)}
                title={a.label}
                aria-label={a.label}
                className="group relative flex h-10 items-center justify-center rounded-xl ring-1 ring-border transition hover:ring-2 hover:ring-white/40"
                style={{ background: `rgb(${a.swatch})` }}
              >
                {current === a.key && <Check className="h-4 w-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
