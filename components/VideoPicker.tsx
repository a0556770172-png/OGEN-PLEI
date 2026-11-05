"use client";
import { useEffect, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import DropZone from "@/components/DropZone";
import { MAX_VIDEO_MB, MAX_VIDEO_BYTES, isAllowedVideoType } from "@/lib/media";

// בורר סרטון הסבר (אופציונלי): גרירה / בחירה, עם תצוגה מקדימה והסרה. הקובץ נשאר אצל הקורא.
export default function VideoPicker({
  file,
  onChange,
  onError
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  onError?: (message: string) => void;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!file) { setSrc(""); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!isAllowedVideoType(f.type)) { onError?.("אפשר להעלות סרטון MP4 או WEBM בלבד"); return; }
    if (f.size > MAX_VIDEO_BYTES) { onError?.(`הסרטון גדול מדי (מקסימום ${MAX_VIDEO_MB}MB)`); return; }
    onError?.("");
    onChange(f);
  }

  return (
    <DropZone
      accept="video/mp4,video/webm,video/quicktime"
      onFiles={pick}
      icon={<Clapperboard className="h-6 w-6 text-primary-light" />}
      title={file ? file.name : "גררו לכאן סרטון הסבר, או לחצו לבחירה"}
      hint={file ? `${(file.size / (1024 * 1024)).toFixed(1)}MB - לחצו כדי להחליף` : `MP4 / WEBM עד ${MAX_VIDEO_MB}MB · אפשר גם סרטון שנוצר בבינה מלאכותית (AI)`}
    >
      {file && src && (
        <div className="relative mt-2 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
          <video src={src} controls muted playsInline className="max-h-56 w-full rounded-lg border border-white/10 bg-black" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500"
            aria-label="הסרת הסרטון"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </DropZone>
  );
}
