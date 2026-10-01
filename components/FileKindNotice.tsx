"use client";
import { Smartphone, Monitor, FileArchive } from "lucide-react";
import { detectFileKind } from "@/lib/fileKind";

// סידור אוטומטי לפי סוג הקובץ (lib/fileKind.ts) - מוצג מתחת לבחירת הקובץ בטופס ההעלאה:
// APK -> אפליקציות, תוכנה -> תוכנות, ZIP -> המשתמש בוחר לאן.
export default function FileKindNotice({
  file,
  zipTarget,
  onZipTargetChange
}: {
  file: File | null;
  zipTarget: "apk" | "software";
  onZipTargetChange: (v: "apk" | "software") => void;
}) {
  if (!file) return null;
  const kind = detectFileKind(file.name);

  if (kind === "apk") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
        <Smartphone className="h-3.5 w-3.5 shrink-0" /> זוהה קובץ APK - יסודר אוטומטית ב<b>אפליקציות</b>, בקטגוריה שבחרתם.
      </div>
    );
  }
  if (kind === "software") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
        <Monitor className="h-3.5 w-3.5 shrink-0" /> זוהה קובץ תוכנה - יסודר אוטומטית ב<b>תוכנות</b>.
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs text-gray-300">
      <p className="mb-2 flex items-center gap-1.5 font-bold text-primary-light">
        <FileArchive className="h-3.5 w-3.5 shrink-0" /> זוהה קובץ ZIP - איפה לפרסם אותו?
      </p>
      <div className="flex flex-wrap gap-2">
        {([
          ["apk", "אפליקציות", Smartphone],
          ["software", "תוכנות", Monitor]
        ] as const).map(([val, label, Icon]) => (
          <button
            key={val}
            type="button"
            onClick={() => onZipTargetChange(val)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition ${
              zipTarget === val ? "bg-primary text-[#fff] shadow-glow" : "bg-surface2 text-gray-400 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
