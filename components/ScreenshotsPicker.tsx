"use client";
import { useEffect, useState } from "react";
import { Images, X } from "lucide-react";
import DropZone from "@/components/DropZone";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-surface2" onClick={(e) => e.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt={file.name} className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500"
        aria-label="הסרה"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// בורר צילומי מסך: גרירה / הדבקה (Ctrl+V) / בחירה, עם תצוגה מקדימה והסרה. הקבצים נשארים
// אצל הקורא (files) והוא אחראי להעלות אותם.
export default function ScreenshotsPicker({
  files,
  onChange,
  max = 8,
  onError
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  onError?: (message: string) => void;
}) {
  function add(incoming: File[]) {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    const ok = images.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (images.length < incoming.length) onError?.("אפשר להוסיף כצילומי מסך קבצי תמונה בלבד");
    else if (ok.length < images.length) onError?.("חלק מהתמונות גדולות מדי (מקסימום 5MB לתמונה) ולא נוספו");
    else if (files.length + ok.length > max) onError?.(`אפשר להוסיף עד ${max} צילומי מסך`);
    else onError?.("");
    onChange([...files, ...ok].slice(0, max));
  }

  // הדבקה (Ctrl+V) בכל מקום בעמוד שאינו שדה טקסט
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const pasted = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!pasted.length) return;
      e.preventDefault();
      add(pasted);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return (
    <DropZone
      accept="image/*"
      multiple
      onFiles={add}
      icon={<Images className="h-6 w-6 text-primary-light" />}
      title="גררו צילומי מסך לכאן, הדביקו (Ctrl+V), או לחצו לבחירה"
      hint={`${files.length}/${max} - PNG / JPG / WEBP עד 5MB לתמונה`}
    >
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {files.map((f, i) => (
            <Thumb key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => onChange(files.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
    </DropZone>
  );
}
