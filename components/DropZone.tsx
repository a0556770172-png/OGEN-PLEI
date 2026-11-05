"use client";
import { useRef, useState } from "react";

// אזור גרירה והעלאה: גוררים קובץ/ים לתוכו, או לוחצים לבחירה רגילה. אפשר גם להדביק תמונה
// (Ctrl+V) כשהאזור בפוקוס - ההדבקה הכללית בעמוד מטופלת בטופס עצמו (ראו AppUploadForm).
export default function DropZone({
  accept,
  multiple = false,
  onFiles,
  onActivate,
  icon,
  title,
  hint,
  children
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  onActivate?: () => void;
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handleFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onPaste={handlePaste}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onDragEnter={(e) => { e.preventDefault(); setOver(true); onActivate?.(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handleFiles(e.dataTransfer?.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm transition ${
        over ? "border-primary bg-primary/10 text-white" : "border-white/15 bg-surface2/40 text-gray-400 hover:border-primary/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {icon}
      <span className="font-semibold">{title}</span>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
      {children}
    </div>
  );
}
